import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("community reports queue review without sybil-triggered automatic hiding", async () => {
  const source = await readFile(new URL("../api/community-report.js", import.meta.url), "utf8");
  assert.match(source, /Report received for moderator review/);
  assert.doesNotMatch(source, /moderation_state\s*=\s*CASE|count\(\*\).*>=\s*3/s);
});
