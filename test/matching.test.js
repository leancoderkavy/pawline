import test from "node:test";
import assert from "node:assert/strict";
import { ANY_LIFESTYLE, matchPets, rankPets, scorePet } from "../src/matching.js";

const pets = [
  { name: "Local dog", species: "Dog", city: "Pasadena, CA", distance: 5, lifestyles: ["Calm & cozy"] },
  { name: "Active dog", species: "Dog", city: "Los Angeles, CA", distance: 2, lifestyles: ["Active & outdoorsy"] },
  { name: "Local cat", species: "Cat", city: "Pasadena, CA", distance: 3, lifestyles: ["Calm & cozy"] },
];

test("filters by species and lifestyle", () => {
  assert.deepEqual(
    matchPets(pets, { species: "Dog", lifestyle: "Calm & cozy" }).map((pet) => pet.name),
    ["Local dog"],
  );
});

test("prioritizes the requested city before distance", () => {
  assert.deepEqual(
    matchPets(pets, { lifestyle: ANY_LIFESTYLE, location: "Pasadena, California" }).map((pet) => pet.name),
    ["Local cat", "Local dog", "Active dog"],
  );
});

test("does not mutate the source list", () => {
  const original = pets.map((pet) => pet.name);
  matchPets(pets, { species: "Dog" });
  assert.deepEqual(pets.map((pet) => pet.name), original);
});

test("ranks explicit listing evidence above unknown compatibility", () => {
  const ranked = rankPets([
    { id: 1, species: "Dog", size: "Medium", description: "Active and good with kids.", distance: 8 },
    { id: 2, species: "Dog", size: "Large", description: "Quiet adult-only home.", distance: 2 },
  ], { species: "Dog", home: "Apartment or condo", energy: "Active", kids: "Yes" });
  assert.equal(ranked[0].pet.id, 1);
  assert.ok(ranked[0].reasons.some((reason) => reason.includes("active")));
});

test("turns missing listing facts into shelter questions", () => {
  const result = scorePet(
    { species: "Cat", size: "Small", description: "Sweet companion." },
    { kids: "Yes", pets: "Dogs", alone: "Often" },
  );
  assert.ok(result.questions.some((question) => question.includes("children")));
  assert.ok(result.questions.some((question) => question.includes("dogs")));
  assert.equal(result.considerations.length, 0);
});

test("never assigns a perfect score when evidence is incomplete", () => {
  const result = scorePet({ species: "Dog", description: "" }, { species: "Dog", energy: "Calm" });
  assert.ok(result.score < 100);
});
