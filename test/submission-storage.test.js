import test from "node:test";
import assert from "node:assert/strict";

import extractSubmission from "../api/extract-submission.js";
import { normalizeExtractionMeta, submissionStorageReady } from "../api/submissions.js";

test("submission storage requires both private file and audit tables", () => {
  assert.equal(submissionStorageReady({
    submission_files: "pet_submission_files",
    submission_log: "pet_submission_log",
  }), true);
  assert.equal(submissionStorageReady({ submission_files: "pet_submission_files" }), false);
  assert.equal(submissionStorageReady({ submission_log: "pet_submission_log" }), false);
});

test("submission extraction metadata is shape-constrained and bounded", () => {
  assert.equal(normalizeExtractionMeta(null), null);
  assert.equal(normalizeExtractionMeta({ inputTokens: 12 }), null);
  assert.deepEqual(normalizeExtractionMeta({
    model: ` model-${"x".repeat(300)} `,
    inputTokens: -4,
    outputTokens: 99_000_000,
    privatePrompt: "must not persist",
  }), {
    model: `model-${"x".repeat(154)}`,
    inputTokens: 0,
    outputTokens: 10_000_000,
  });
});

test("both extraction and submission handlers cap attachment count", async () => {
  const { readFile } = await import("node:fs/promises");
  const [extraction, submission, app] = await Promise.all([
    readFile(new URL("../api/extract-submission.js", import.meta.url), "utf8"),
    readFile(new URL("../api/submissions.js", import.meta.url), "utf8"),
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(extraction, /const MAX_FILES = 8/);
  assert.match(submission, /const MAX_FILES = 8/);
  assert.match(app, /candidate\.length > 8/);
});

test("document extraction rejects anonymous requests before validating files or calling AI", async () => {
  const result = { statusCode: 200, body: null };
  const response = {
    setHeader() {},
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };

  await extractSubmission({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { files: [] },
    socket: { remoteAddress: "127.0.0.1" },
  }, response);

  assert.equal(result.statusCode, 401);
  assert.equal(result.body?.error, "Sign in with Pawline to use this feature.");
});
