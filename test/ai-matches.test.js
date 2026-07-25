import test from "node:test";
import assert from "node:assert/strict";
import { validateMatchRequest, validateModelResult } from "../api/matches.js";

const answers = {
  home: "House",
  energy: "Balanced",
  kids: "No",
  pets: "None",
  alone: "Sometimes",
  experience: "Some experience",
  species: "Dog",
};

test("AI match requests require explicit consent", () => {
  assert.match(validateMatchRequest({ answers, pets: [] }).error, /Consent/);
});

test("AI match requests allow only bounded public listing facts", () => {
  const result = validateMatchRequest({
    consentToAiProcessing: true,
    answers,
    pets: [{
      id: "dog-1",
      name: "Buddy",
      species: "Dog",
      description: "Friendly listing text",
      contactEmail: "not-sent@example.test",
    }],
  });
  assert.equal(result.value.pets[0].id, "dog-1");
  assert.equal("contactEmail" in result.value.pets[0], false);
});

test("AI output rejects unknown pets and overconfident scores", () => {
  assert.throws(() => validateModelResult({
    matches: [{
      petId: "unknown",
      score: 99,
      reasons: ["A reason"],
      considerations: [],
      questions: ["Ask the shelter"],
    }],
  }, ["dog-1"]), /validation/);
});

test("AI output accepts a cautious evidence-grounded match", () => {
  const matches = validateModelResult({
    matches: [{
      petId: "dog-1",
      score: 82,
      reasons: ["The listed size fits the selected home."],
      considerations: [],
      questions: ["Ask the shelter about time alone."],
    }],
  }, ["dog-1"]);
  assert.equal(matches[0].score, 82);
});
