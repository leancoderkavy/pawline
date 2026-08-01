import test from "node:test";
import assert from "node:assert/strict";
import { buildRescueGroupsUrl } from "../api/_rescuegroups.js";

test("RescueGroups requests preserve the v5 API path", () => {
  const url = buildRescueGroupsUrl(
    "https://api.rescuegroups.org/v5",
    "/public/animals/search/available/dogs/",
    { limit: 24, page: 1 },
  );

  assert.equal(url.origin, "https://api.rescuegroups.org");
  assert.equal(url.pathname, "/v5/public/animals/search/available/dogs/");
  assert.equal(url.searchParams.get("limit"), "24");
  assert.equal(url.searchParams.get("page"), "1");
});
