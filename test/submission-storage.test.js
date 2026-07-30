import test from "node:test";
import assert from "node:assert/strict";

import { submissionStorageReady } from "../api/submissions.js";

test("submission storage requires both private file and audit tables", () => {
  assert.equal(submissionStorageReady({
    submission_files: "pet_submission_files",
    submission_log: "pet_submission_log",
  }), true);
  assert.equal(submissionStorageReady({ submission_files: "pet_submission_files" }), false);
  assert.equal(submissionStorageReady({ submission_log: "pet_submission_log" }), false);
});
