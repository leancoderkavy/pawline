import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { notificationStatus } from "../api/_email.js";

test("submission notification status reflects actual delivery outcomes", () => {
  assert.equal(notificationStatus({ configured: false }), "not_configured");
  assert.equal(notificationStatus({ configured: true, attempted: 2, sent: 2 }), "sent");
  assert.equal(notificationStatus({ configured: true, attempted: 2, sent: 1 }), "partial_failure");
  assert.equal(notificationStatus({ configured: true, attempted: 2, sent: 0 }), "failed");
});

test("email delivery has a bounded provider timeout", async () => {
  const source = await readFile(new URL("../api/_email.js", import.meta.url), "utf8");
  assert.match(source, /signal: AbortSignal\.timeout\(10000\)/);
});
