import test from "node:test";
import assert from "node:assert/strict";
import { scorePet, rankPets, matchPets } from "../src/matching.js";
import { resultFreshness } from "../src/listingEvidence.js";

test("negated and conflicting household evidence never becomes a positive match", () => {
  for (const description of ["Not good with kids. Not good with dogs. Not good with cats.", "Good with kids but no kids in the home. Good with dogs but no dogs. Good with cats but no cats."]) {
    const result = scorePet({ description }, { kids: "Yes", pets: "Dogs and cats" });
    assert.equal(result.reasons.length, 0);
    assert.equal(result.considerations.length, 2);
    assert.equal(result.score, 0);
  }
});
test("names, breeds and unknown facts are not behavioral evidence", () => {
  const result = scorePet({ name: "Calm", breed: "Active", size: "Small" }, { energy: "Calm", home: "Apartment or condo", kids: "Yes", pets: "Dogs", alone: "Often" });
  assert.equal(result.score, 0);
  assert.equal(result.reasons.length, 0);
  assert.equal(result.questions.length, 5);
});
test("uncertain compatibility stays a question", () => {
  for (const description of ["May be good with kids", "Unknown whether good with kids", "Might be good with kids"]) {
    assert.equal(scorePet({ description }, { kids: "Yes" }).reasons.length, 0);
  }
});
test("active listings surface a calm household conflict", () => {
  assert.equal(scorePet({ description: "Energetic and playful" }, { energy: "Calm" }).considerations.length, 1);
});
test("missing and invalid distance sort behind known distance without mutating input", () => {
  const pets = [{ id: 1 }, { id: 2, distance: "" }, { id: 3, distance: 4 }, { id: 4, distance: -1 }, { id: 5, distance: 0 }];
  assert.deepEqual(matchPets(pets).slice(0, 2).map(p => p.id), [5, 3]);
  assert.deepEqual(rankPets(pets).slice(0, 2).map(p => p.pet.id), [5, 3]);
  assert.equal(pets[0].id, 1);
});
test("freshness distinguishes observation, age, invalid values and unavailable status", () => {
  const now = Date.parse("2026-09-10T12:00:00Z");
  assert.equal(resultFreshness({ lastObservedAt: "2026-09-10T11:00:00Z" }, now), "Recently seen in source feed");
  assert.match(resultFreshness({ verified_at: "2026-09-01T00:00:00Z" }, now), /Older/);
  for (const value of ["bad", "", "2027-01-01T00:00:00Z"]) assert.equal(resultFreshness({ verifiedAt: value }, now), "Confirm with the shelter");
  assert.equal(resultFreshness({ status: "adopted", lastObservedAt: "2026-09-10T11:00:00Z" }, now), "Status needs confirmation");
});


test("saved applications retain their official shelter route across sessions", async () => {
  const { applicationResponse } = await import("../api/adoption-applications.js");
  const { safeHttpUrl } = await import("../src/adopterJourney.js");
  const application = applicationResponse({ id: "application", source_url: "https://shelter.example/pets/123", status: "draft" });
  assert.equal(safeHttpUrl(application.sourceUrl), "https://shelter.example/pets/123");
  assert.equal(application.applicationEnabled, false);
  assert.equal(safeHttpUrl(applicationResponse({ source_url: "javascript:alert(1)" }).sourceUrl), "");
});
