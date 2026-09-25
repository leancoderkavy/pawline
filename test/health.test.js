import test from "node:test";
import assert from "node:assert/strict";
import { createHealthHandler, getHealth } from "../api/health.js";
import healthHandler from "../api/health.js";

test("health counts every live direct pet provider", () => {
  const health = getHealth({});

  assert.equal(health.publicOpenDataProviders, 2);
  assert.equal(health.officialDirectPetProviders, 3);
  assert.equal(health.activePetProviders, 3);
});

test("health endpoint rejects mutation methods", async () => {
  const result = { status: null, body: null, allow: null };
  const response = {
    setHeader(name, value) { if (name === "Allow") result.allow = value; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  await healthHandler({ method: "POST" }, response);
  assert.equal(result.status, 405);
  assert.equal(result.allow, "GET");
});

test("health reports chat ready only after required schema is present", async () => {
  const environment = { CLERK_SECRET_KEY: "configured", DATABASE_URL: "configured" };
  const response = () => ({ setHeader() {}, status() { return this; }, json(body) { return body; } });
  const handler = row => createHealthHandler({ environment, getDatabase: () => async () => [row] });
  const complete = { conversations: "direct_conversations", messages: "direct_messages", reports: "direct_message_reports", state: "direct_conversation_state", calls: "direct_video_calls", signals: "direct_video_signals", conversation_status: true, message_client_id: true };
  assert.equal((await handler(complete)({ method: "GET" }, response())).directMessagingReady, true);
  assert.equal((await handler({ ...complete, state: null })({ method: "GET" }, response())).directMessagingReady, false);
  assert.equal((await handler({ ...complete, conversation_status: false })({ method: "GET" }, response())).directMessagingReady, false);
});

test("health requires a sender address before enabling email", () => {
  const incomplete = getHealth({
    RESEND_API_KEY: "configured",
    PAWLINE_MODERATION_EMAIL: "configured",
  });
  const complete = getHealth({
    RESEND_API_KEY: "configured",
    PAWLINE_FROM_EMAIL: "Pawline <notifications@pawlineadopt.com>",
    PAWLINE_MODERATION_EMAIL: "configured",
  });

  assert.equal(incomplete.emailConfigured, false);
  assert.equal(complete.emailConfigured, true);
});

test("health reports the AI SEO pipeline only when every private dependency is configured", () => {
  const incomplete = getHealth({ DATABASE_URL: "configured", TAVILY_API_KEY: "configured", CRON_SECRET: "configured" });
  const complete = getHealth({
    DATABASE_URL: "configured", TAVILY_API_KEY: "configured", CRON_SECRET: "configured",
    SEO_PIPELINE_SECRET: "configured", AI_GATEWAY_API_KEY: "configured",
  });
  assert.equal(incomplete.aiSeoPipelineConfigured, false);
  assert.equal(complete.aiSeoPipelineConfigured, true);
});
