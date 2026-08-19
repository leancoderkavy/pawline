import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("request-time storage helpers never perform schema DDL", () => {
  for (const path of [
    "api/favorites.js",
    "api/submissions.js",
    "api/_community.js",
    "api/_direct.js",
    "api/_tavily-discovery.js",
    "api/_ai-seo-pipeline.js",
    "api/_shelter-outreach.js",
  ]) {
    assert.doesNotMatch(read(path), /CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX/i, path);
  }
});

test("web discovery fails closed when its migration is absent", async () => {
  const { requireDiscoverySchema } = await import("../api/_tavily-discovery.js");
  const database = async () => [{ web_discoveries: false }];
  await assert.rejects(requireDiscoverySchema(database), /migration is missing/);
});
