import test from "node:test";
import assert from "node:assert/strict";
import { validatePrivacyRequest } from "../api/privacy-requests.js";

test("privacy requests accept bounded access, correction, and deletion requests", () => {
  for (const type of ["access", "correction", "deletion", "other"]) {
    assert.deepEqual(validatePrivacyRequest({ type, email: " User@Example.com ", details: "Help" }), {
      type, email: "user@example.com", details: "Help",
    });
  }
});

test("privacy requests reject invalid type, address, and oversized details", () => {
  assert.match(validatePrivacyRequest({ type: "erase", email: "a@b.com" }).error, /type/);
  assert.match(validatePrivacyRequest({ type: "access", email: "invalid" }).error, /email/);
  assert.match(validatePrivacyRequest({ type: "access", email: "a@b.com", details: "x".repeat(2001) }).error, /2,000/);
});
