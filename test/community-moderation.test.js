import test from "node:test";
import assert from "node:assert/strict";
import { moderateMessage } from "../api/_community.js";
import { normalizeLinkPreview } from "../api/community-messages.js";

test("community moderation allows ordinary pet discussion and keeps links", () => {
  const result = moderateMessage("Found this dog near Green Lake https://example.org/pets/123");
  assert.equal(result.allowed, true);
  assert.deepEqual(result.urls, ["https://example.org/pets/123"]);
});

test("community moderation blocks email addresses", () => {
  const result = moderateMessage("Email me at person@example.org");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "email");
});

test("community moderation blocks obfuscated email addresses", () => {
  const result = moderateMessage("Contact me at person (at) example (dot) org");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "email");
});

test("community moderation blocks spaced-dot email obfuscation", () => {
  const result = moderateMessage("Contact person at example . org");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "email");
});

test("community moderation blocks fully spelled phone numbers", () => {
  const result = moderateMessage("Call five five five one two three four five six seven");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "phone");
});

test("community moderation blocks exact street addresses", () => {
  const result = moderateMessage("The stray is at 123 Main Street");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "exact_address");
});

test("community moderation blocks spelled-out exact street addresses", () => {
  const result = moderateMessage("Meet at one two three Main Street");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "exact_address");
});

test("community moderation blocks payment scams", () => {
  const result = moderateMessage("Send a gift card before you meet the dog");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "sale");
});

test("community moderation strips zero-width format characters before privacy checks", () => {
  assert.equal(moderateMessage("person\u200B@example.org").code, "email");
  assert.equal(moderateMessage("555\u200B 123\u200B 4567").code, "phone");
  assert.equal(moderateMessage("123\u200B Main Street").code, "exact_address");
});

test("community messages cannot self-declare a provider-verified listing", () => {
  const preview = normalizeLinkPreview({
    sourceUrl: "https://example.org/pets/123",
    verificationState: "provider_verified",
  }, ["https://example.org/pets/123"]);
  assert.equal(preview.verificationState, "needs_confirmation");
});
