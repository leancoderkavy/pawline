import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const execFileAsync = promisify(execFile);

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

test("migration dry run parses and verifies local migration artifacts without a database connection", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, ["scripts/migrate.mjs", "--dry-run"], {
    cwd: new URL("..", import.meta.url), env: { PATH: process.env.PATH },
  });
  assert.equal(stderr, "");
  assert.match(stdout, /dry run passed/i);
  assert.match(stdout, /no database connection used/i);
});
