import test from "node:test";
import assert from "node:assert/strict";
import { getHealth } from "../api/health.js";
import healthHandler from "../api/health.js";

test("health counts every live direct pet provider", () => {
  const health = getHealth({});

  assert.equal(health.publicOpenDataProviders, 2);
  assert.equal(health.officialDirectPetProviders, 3);
  assert.equal(health.activePetProviders, 3);
});

test("health endpoint rejects mutation methods", () => {
  const result = { status: null, body: null, allow: null };
  const response = {
    setHeader(name, value) { if (name === "Allow") result.allow = value; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  healthHandler({ method: "POST" }, response);
  assert.equal(result.status, 405);
  assert.equal(result.allow, "GET");
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
