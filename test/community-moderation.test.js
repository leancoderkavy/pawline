import test from "node:test";
import assert from "node:assert/strict";
import { moderateMessage } from "../api/_community.js";

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

test("community moderation blocks exact street addresses", () => {
  const result = moderateMessage("The stray is at 123 Main Street");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "exact_address");
});

test("community moderation blocks payment scams", () => {
  const result = moderateMessage("Send a gift card before you meet the dog");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "sale");
});
