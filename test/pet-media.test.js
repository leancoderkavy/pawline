import test from "node:test";
import assert from "node:assert/strict";

import { petMediaErrorStatus } from "../api/pet-media.js";

test("pet media reports an unavailable schema as a service dependency failure", () => {
  assert.equal(petMediaErrorStatus({ code: "42P01" }), 503);
});

test("pet media preserves a generic server error for unexpected failures", () => {
  assert.equal(petMediaErrorStatus(new Error("unexpected")), 500);
});
