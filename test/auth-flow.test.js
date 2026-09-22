import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEmail,
  normalizePhone,
  startEmailSignUp,
  startSignIn,
  verifySignInCode,
} from "../src/authFlow.js";

test("phone sign-in normalizes to E.164 and sends the OTP through the factor-specific API", async () => {
  const calls = [];
  const signIn = {
    phoneCode: {
      sendCode: async (params) => {
        calls.push(params);
        return { error: null };
      },
    },
  };

  const result = await startSignIn({
    signIn,
    method: "phone-code",
    phone: "(415) 555-0100",
  });

  assert.deepEqual(calls, [{ phoneNumber: "+14155550100" }]);
  assert.deepEqual(result, { status: "verify", kind: "phone-signin" });
});

test("password sign-in finalizes only after Clerk marks the attempt complete", async () => {
  const calls = [];
  const signIn = {
    status: "complete",
    password: async (params) => {
      calls.push(["password", params]);
      return { error: null };
    },
    finalize: async () => {
      calls.push(["finalize"]);
      return { error: null };
    },
  };

  const result = await startSignIn({
    signIn,
    method: "email-password",
    email: "  ADOPTER@example.com ",
    password: "correct horse battery staple",
  });

  assert.deepEqual(calls, [
    ["password", { emailAddress: "adopter@example.com", password: "correct horse battery staple" }],
    ["finalize"],
  ]);
  assert.deepEqual(result, { status: "complete" });
});

test("email OTP remains the default passwordless sign-in path", async () => {
  const calls = [];
  const signIn = {
    emailCode: {
      sendCode: async (params) => {
        calls.push(params);
        return { error: null };
      },
    },
  };

  const result = await startSignIn({ signIn, method: "email-code", email: "hello@example.com" });

  assert.deepEqual(calls, [{ emailAddress: "hello@example.com" }]);
  assert.deepEqual(result, { status: "verify", kind: "email-signin" });
});

test("optional password sign-up still verifies the required email before finalizing", async () => {
  const calls = [];
  const signUp = {
    status: "missing_requirements",
    unverifiedFields: ["email_address"],
    password: async (params) => {
      calls.push(["password", params]);
      return { error: null };
    },
    verifications: {
      sendEmailCode: async () => {
        calls.push(["send-email-code"]);
        return { error: null };
      },
    },
  };

  const result = await startEmailSignUp({
    signUp,
    email: "NEW@example.com",
    password: "correct horse battery staple",
    usePassword: true,
  });

  assert.deepEqual(calls, [
    ["password", { emailAddress: "new@example.com", password: "correct horse battery staple" }],
    ["send-email-code"],
  ]);
  assert.deepEqual(result, { status: "verify", kind: "email-signup" });
});

test("phone verification finalizes the completed sign-in", async () => {
  const calls = [];
  const signIn = {
    status: "complete",
    phoneCode: {
      verifyCode: async ({ code }) => {
        calls.push(["verify", code]);
        return { error: null };
      },
    },
    finalize: async () => {
      calls.push(["finalize"]);
      return { error: null };
    },
  };

  const result = await verifySignInCode({ signIn, kind: "phone-signin", code: "123456" });

  assert.deepEqual(calls, [["verify", "123456"], ["finalize"]]);
  assert.deepEqual(result, { status: "complete" });
});

test("identifier normalization rejects ambiguous phone input", () => {
  assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone("415-555-0100"), "+14155550100");
  assert.equal(normalizePhone("123"), "");
});
