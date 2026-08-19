import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  cleanupUsageLimits,
  consumeUsage,
  consumeUsageChain,
  createUsageFallbackLimiter,
  requestClientKey,
} from "../api/_usage-limit.js";

test("durable usage limits enforce the returned atomic database count", async () => {
  const allowedDatabase = async () => [{ request_count: 3 }];
  const blockedDatabase = async () => [{ request_count: 4 }];
  const options = { scope: "test", subject: "member", limit: 3, windowMs: 60_000 };
  assert.equal(await consumeUsage(allowedDatabase, options), true);
  assert.equal(await consumeUsage(blockedDatabase, options), false);
});

test("a denied scoped limit does not consume a later shared or recipient limit", async () => {
  const scopes = [];
  const database = async (strings, ...values) => {
    scopes.push(values[0]);
    return [{ request_count: values[0] === "subject" ? 4 : 1 }];
  };
  const result = await consumeUsageChain(database, [
    { scope: "subject", subject: "member", limit: 3, windowMs: 60_000 },
    { scope: "shared", subject: "all", limit: 200, windowMs: 60_000 },
  ]);
  assert.deepEqual(result, { allowed: false, deniedScope: "subject" });
  assert.deepEqual(scopes, ["subject"]);
});

test("bounded fallback limits reset per window and retain separate client quotas", () => {
  const reserve = createUsageFallbackLimiter({ clientLimit: 2, globalLimit: 3, windowMs: 1_000 });

  assert.equal(reserve("client-one", 10), true);
  assert.equal(reserve("client-one", 10), true);
  assert.equal(reserve("client-one", 10), false);
  assert.equal(reserve("client-two", 10), true);
  assert.equal(reserve("client-three", 10), false);
  assert.equal(reserve("client-three", 1_000), true);
});

test("the schema provides the shared usage limit table", async () => {
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS usage_limits/);
  assert.match(schema, /PRIMARY KEY \(scope, subject, window_started_at\)/);
});

test("client quota keys are stable pseudonyms and never store the raw address", () => {
  const request = { headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.1" } };
  const first = requestClientKey(request, { USAGE_LIMIT_SALT: "test-a" });
  assert.equal(first, requestClientKey(request, { USAGE_LIMIT_SALT: "test-a" }));
  assert.notEqual(first, requestClientKey(request, { USAGE_LIMIT_SALT: "test-b" }));
  assert.doesNotMatch(first, /203\.0\.113\.42/);
  assert.match(first, /^client:[a-f0-9]{64}$/);
});

test("expired durable quota records can be removed with bounded retention", async () => {
  const calls = [];
  const database = async (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return [{ deleted: 1 }, { deleted: 1 }];
  };
  assert.equal(await cleanupUsageLimits(database, 999), 2);
  assert.match(calls[0].sql, /DELETE FROM usage_limits/);
  assert.deepEqual(calls[0].values, [30]);
});

test("migration verification accounts for every core table and critical index", async () => {
  const migration = await readFile(new URL("../scripts/migrate.mjs", import.meta.url), "utf8");
  for (const name of [
    "sources", "ingestion_runs", "ratings", "adoption_events",
    "pets_source_external_unique", "usage_limits_expiry", "direct_messages_conversation_created",
  ]) {
    assert.match(migration, new RegExp(`public\\.${name}`));
  }
});

test("every paid public-facing AI path uses durable limits and structured output", async () => {
  const parseLink = await readFile(new URL("../api/community-parse-link.js", import.meta.url), "utf8");
  assert.match(parseLink, /consumeUsageChain\(database/);
  assert.match(parseLink, /community_link_parse_user/);
  assert.match(parseLink, /community_link_parse_global/);
  assert.match(parseLink, /Output\.object/);
  assert.doesNotMatch(parseLink, /JSON\.parse\(.*result\.text/);
  const outreach = await readFile(new URL("../api/_shelter-outreach.js", import.meta.url), "utf8");
  assert.match(outreach, /consumeUsageChain\(database/);
  assert.match(outreach, /shelter_outreach_generation_month/);
  assert.match(outreach, /shelter_outreach_generation_day/);
  assert.match(outreach, /Output\.object/);
  assert.doesNotMatch(outreach, /JSON\.parse\(.*result\.text/);
});
