import test from "node:test";
import assert from "node:assert/strict";
import { getHealth } from "../api/health.js";

test("health counts every live direct pet provider", () => {
  const health = getHealth({});

  assert.equal(health.publicOpenDataProviders, 2);
  assert.equal(health.officialDirectPetProviders, 3);
  assert.equal(health.activePetProviders, 3);
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
