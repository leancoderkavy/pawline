import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  APPLICATION_STATUS,
  buildApplicationCoachRequest,
  containsDirectContactDetails,
  createApplicationDraft,
  nextApplicationStatus,
  normalizeAdopterProfile,
  profileReadiness,
  safeHttpUrl,
  validateApplicationCoachSuggestion,
} from "../src/adopterJourney.js";
import { validateApplicationCoachServerRequest } from "../api/application-coach.js";
import { cleanAnswerMap, cleanSharedFields } from "../api/adoption-applications.js";
import { normalizeAdopterProfileInput } from "../api/adopter-profile.js";

test("profile readiness exposes omitted preferences instead of assuming a match", () => {
  const profile = normalizeAdopterProfile({ species: "Dog", home: "House", energy: "Active" });
  const readiness = profileReadiness(profile);
  assert.equal(readiness.complete, 2);
  assert.deepEqual(readiness.missing, ["kids", "pets", "alone", "experience"]);
  assert.equal(profile.species, "Dog");
});

test("application drafts never treat legacy listing ownership as organization participation", () => {
  const draft = createApplicationDraft({
    id: "pet-1",
    name: "Miso",
    shelter: "Pawline Rescue",
    claimed_by_clerk_user_id: "legacy-owner",
    sourceUrl: "https://example.org/pets/miso",
  }, { householdName: "A household" });
  assert.equal(draft.organizationClaimed, false);
  assert.equal(draft.status, "draft");
  assert.equal(nextApplicationStatus(draft), "draft");
  assert.equal(draft.sourceUrl, "https://example.org/pets/miso");
});

test("application drafts only recognize explicit canonical organization claim state", () => {
  const draft = createApplicationDraft({ id: "pet-2", organization_claimed: true }, {});
  assert.equal(draft.organizationClaimed, true);
  assert.equal(nextApplicationStatus(draft), "draft");
  assert.equal(APPLICATION_STATUS.submitted.label, "Submitted");
});

test("coach requests require consent and reject direct contact details before provider use", () => {
  assert.match(buildApplicationCoachRequest({ question: "Care plan", answer: "I will walk daily" }).error, /Consent/);
  assert.match(buildApplicationCoachRequest({
    question: "Care plan", answer: "Email me at person@example.com", consentToAiProcessing: true,
  }).error, /Remove/);
  assert.equal(containsDirectContactDetails("Call 555-555-0199"), true);
  assert.deepEqual(buildApplicationCoachRequest({
    question: "Care plan", answer: "I can provide a morning walk and evening training session.", consentToAiProcessing: true,
  }).value, {
    task: "application_coach",
    schemaVersion: 1,
    consentToAiProcessing: true,
    question: "Care plan",
    answer: "I can provide a morning walk and evening training session.",
  });
});

test("server coach validation independently rejects the signed-in user's identity", () => {
  const rejected = validateApplicationCoachServerRequest({
    question: "Care plan",
    answer: "Jordan Example will arrange walks.",
    consentToAiProcessing: true,
  }, { displayName: "Jordan Example", email: "jordan@example.com" });
  assert.match(rejected.error, /identifying names/);
});

test("coach suggestions are schema bounded and listing links are http(s) only", () => {
  assert.deepEqual(validateApplicationCoachSuggestion({
    suggestion: "I will arrange care every morning and evening.",
    explanation: "This is more specific about the routine.",
    missingDetails: ["How will care work during travel?"],
  }), {
    suggestion: "I will arrange care every morning and evening.",
    explanation: "This is more specific about the routine.",
    missingDetails: ["How will care work during travel?"],
  });
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("https://example.org/official"), "https://example.org/official");
  assert.equal(validateApplicationCoachSuggestion({
    suggestion: "This will improve your approval chance.", explanation: "Adds detail.", missingDetails: [],
  }), null);
});

test("server-owned profile and application helpers allowlist fields before persistence", () => {
  assert.deepEqual(normalizeAdopterProfileInput({
    preferences: { species: "Dog", energy: "Not a real option", ignored: "no" },
    household: { name: "  Martinez home ", collaborators: ["Alex", "Alex", "Sam"], accessibility: "step-free access", ignored: "no" },
  }), {
    preferences: {
      species: "Dog", home: "", energy: "", kids: "", pets: "", alone: "", experience: "", distance: "25",
    },
    household: { name: "Martinez home", collaborators: ["Alex", "Sam"], accessibility: "step-free access" },
    consent: { profileVersion: "adopter-profile-v1" },
  });
  assert.deepEqual(cleanAnswerMap({ carePlan: "  Morning walks  ", unknown: "do not retain", schedule: 42 }), {
    carePlan: "Morning walks",
  });
  assert.deepEqual(cleanSharedFields({ core: ["carePlan"], addOn: [] }, { carePlan: "Morning walks", schedule: "At home" }, {}), {
    core: ["carePlan"], addOn: [],
  });
  assert.equal(cleanSharedFields({ core: ["schedule"], addOn: [] }, { carePlan: "Morning walks" }, {}), null);
});

test("adoption outcomes and thirty-day check-ins remain server-confirmed", async () => {
  const experience = await readFile(new URL("../src/AdopterExperience.jsx", import.meta.url), "utf8");

  assert.match(experience, /authorizedJson\(getToken, "\/api\/adoption-outcomes",/);
  assert.match(experience, /authorizedJson\(getToken, "\/api\/adoption-checkins"\)/);
  assert.match(experience, /application\.status === "adoption_pending"/);
  assert.match(experience, /checkinDue/);
  assert.match(experience, /Pawline waits for the organization’s matching confirmation/);
  assert.match(experience, /Your optional 30-day check-in opens on/);
});

test("held applications state the invitation outcome without claiming answers were shared", async () => {
  const experience = await readFile(new URL("../src/AdopterExperience.jsx", import.meta.url), "utf8");

  assert.match(experience, /function HeldApplicationNotice/);
  assert.match(experience, /invite_queued:/);
  assert.match(experience, /invite_already_queued:/);
  assert.match(experience, /manual_contact_required:/);
  assert.match(experience, /No answers have been shared with the organization/);
  assert.match(experience, /<HeldApplicationNotice application=\{application\} \/>/);
});
