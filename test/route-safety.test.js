import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("provider-backed public routes reserve durable capacity", async () => {
  for (const path of ["api/pets.js", "api/events.js", "api/geocode.js", "api/map.js", "api/matches.js"]) {
    assert.match(await read(path), /consumeUsage(?:Chain)?\(/, path);
  }
});

test("authenticated mutation and realtime routes reserve durable capacity", async () => {
  for (const path of [
    "api/ably-token.js", "api/community-messages.js", "api/community-parse-link.js",
    "api/community-report.js", "api/direct-conversations.js", "api/direct-messages.js",
    "api/direct-message-report.js", "api/extract-submission.js", "api/favorites.js", "api/submissions.js",
  ]) {
    const source = await read(path) + (path.startsWith("api/direct-") ? await read("api/_direct.js") : "");
    assert.match(source, /requireUser/, path);
    assert.match(source, /consumeUsage(?:Chain)?\(/, path);
  }
});

test("UUID-backed public and report handlers use canonical UUID validation", async () => {
  const canonical = /\[0-9a-f\]\{8\}.*\[0-9a-f\]\{4\}.*\[1-5\]\[0-9a-f\]\{3\}/s;
  for (const path of ["api/community-report.js", "api/direct-message-report.js", "api/pet-media.js"]) {
    const source = await read(path) + (path === "api/direct-message-report.js" ? await read("api/_direct.js") : "");
    assert.match(source, canonical, path);
  }
});

test("direct reports queue moderator review without an unreachable auto-hide threshold", async () => {
  const source = await read("api/direct-message-report.js");
  assert.match(source, /Report received for moderator review/);
  assert.doesNotMatch(source, /moderation_state\s*=\s*CASE|count\(\*\).*>=\s*3/s);
});
