import test from "node:test";
import assert from "node:assert/strict";
import {
  SHELTER_DATA_POINTS,
  buildShelterConfirmationDraft,
  shelterOutreachStatus,
  validateShelterEnrichment,
} from "../api/_shelter-outreach.js";
import { sendShelterConfirmationEmail } from "../api/_email.js";
import shelterOutreachHandler from "../api/shelter-outreach.js";

const candidate = {
  sourceUrl: "https://example.org/adopt",
  sourceDomain: "example.org",
  evidence: [{
    sourceUrl: "https://example.org/adopt",
    title: "Example Humane Society adoption",
    snippet: "Example Humane Society lists adoptable dogs and cats. Contact shelter@example.org for adoption questions.",
  }],
};

const enrichment = {
  organizationName: "Example Humane Society",
  officialDomain: "example.org",
  location: null,
  adoptionUrl: "https://example.org/adopt",
  listingUrl: "https://example.org/adopt",
  feedUrl: null,
  feedFormat: "html",
  supportedSpecies: ["Dog", "Cat"],
  freshnessEvidence: null,
  termsUrl: null,
  attribution: "Example Humane Society",
  publicContactEmail: "shelter@example.org",
  contactRole: "Shelter team",
  evidence: [{ sourceUrl: "https://example.org/adopt", fields: ["organizationName", "adoptionUrl", "supportedSpecies", "publicContactEmail"] }],
  uncertainties: ["No public feed documentation was supplied."],
};

function responseCapture() {
  const result = { status: null, body: null };
  return {
    result,
    setHeader() { return this; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
}

test("shelter enrichment keeps every data point tied to supplied evidence", () => {
  const validated = validateShelterEnrichment(enrichment, candidate);
  assert.equal(validated.error, undefined);
  assert.equal(validated.value.organizationName, "Example Humane Society");
  assert.deepEqual(validated.value.supportedSpecies, ["Dog", "Cat"]);
  assert.equal(validated.value.publicContactEmail, "shelter@example.org");
  assert.equal(SHELTER_DATA_POINTS.includes("termsUrl"), true);
});

test("shelter enrichment rejects invented evidence, URLs, and contacts", () => {
  assert.match(validateShelterEnrichment({ ...enrichment, evidence: [{ sourceUrl: "https://other.example/adopt", fields: ["organizationName"] }] }, candidate).error, /supplied public evidence/);
  assert.match(validateShelterEnrichment({ ...enrichment, listingUrl: "https://example.org/hidden-feed" }, candidate).error, /URLs may only repeat/);
  assert.match(validateShelterEnrichment({ ...enrichment, publicContactEmail: "invented@example.org" }, candidate).error, /appears verbatim/);
});

test("confirmation drafts are deterministic and do not claim verification", () => {
  const draft = buildShelterConfirmationDraft({
    ...candidate,
    contactName: "Alex",
    data: { ...enrichment },
  });
  assert.match(draft.subject, /Example Humane Society/);
  assert.match(draft.text, /not treat this as a verified source/i);
  assert.match(draft.text, /one-time confirmation request/i);
});

test("outreach status keeps AI and sending independently opt-in", () => {
  const disabled = shelterOutreachStatus({ DATABASE_URL: "configured", AI_GATEWAY_API_KEY: "configured", SHELTER_OUTREACH_SECRET: "configured" });
  const enabled = shelterOutreachStatus({
    DATABASE_URL: "configured", AI_GATEWAY_API_KEY: "configured", SHELTER_OUTREACH_SECRET: "configured",
    SHELTER_OUTREACH_AI_ENABLED: "true", SHELTER_OUTREACH_SEND_ENABLED: "true",
    RESEND_API_KEY: "configured", PAWLINE_FROM_EMAIL: "Pawline <hello@example.org>", PAWLINE_MODERATION_EMAIL: "team@example.org",
  });
  assert.equal(disabled.aiConfigured, true);
  assert.equal(disabled.aiEnabled, false);
  assert.equal(disabled.sendingEnabled, false);
  assert.equal(enabled.aiEnabled, true);
  assert.equal(enabled.sendingEnabled, true);
});

test("outreach operator endpoint fails closed before its private credential is configured", async () => {
  const saved = process.env.SHELTER_OUTREACH_SECRET;
  delete process.env.SHELTER_OUTREACH_SECRET;
  try {
    const response = responseCapture();
    await shelterOutreachHandler({ method: "GET", headers: {}, query: {} }, response);
    assert.equal(response.result.status, 503);
  } finally {
    if (saved === undefined) delete process.env.SHELTER_OUTREACH_SECRET;
    else process.env.SHELTER_OUTREACH_SECRET = saved;
  }
});

test("Resend shelter confirmation requests use a stable idempotency key", async () => {
  const original = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    PAWLINE_FROM_EMAIL: process.env.PAWLINE_FROM_EMAIL,
    PAWLINE_MODERATION_EMAIL: process.env.PAWLINE_MODERATION_EMAIL,
  };
  process.env.RESEND_API_KEY = "test-key";
  process.env.PAWLINE_FROM_EMAIL = "Pawline <hello@example.org>";
  process.env.PAWLINE_MODERATION_EMAIL = "team@example.org";
  let request;
  try {
    const result = await sendShelterConfirmationEmail({
      to: "shelter@example.org", subject: "Confirm", text: "Please confirm.", idempotencyKey: "shelter-confirmation/test/1",
      fetchImpl: async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({ id: "email_123" }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    });
    assert.equal(result.id, "email_123");
    assert.equal(request.options.headers["Idempotency-Key"], "shelter-confirmation/test/1");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
