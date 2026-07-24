import test from "node:test";
import assert from "node:assert/strict";
import { ANY_LIFESTYLE, matchPets } from "../src/matching.js";

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
