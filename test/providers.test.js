import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalSpecies,
  cleanText,
  normalizeDatabasePet,
  normalizeKingCountyPet,
  normalizeMontgomeryPet,
} from "../api/pets.js";

test("normalizes Montgomery County adoptable pet records", () => {
  const pet = normalizeMontgomeryPet({
    animalid: "A123",
    petname: "*BLOOM",
    animaltype: "CAT",
    breed: "DOMESTIC SH",
    petage: "4 YEARS",
    petsize: "SMALL",
    sex: "S",
    url: { url: "http://www.petharbor.com/image/A123" },
  }, 0);

  assert.equal(pet.id, "montgomery-A123");
  assert.equal(pet.name, "BLOOM");
  assert.equal(pet.species, "Cat");
  assert.equal(pet.sex, "Spayed Female");
  assert.match(pet.image, /^https:/);
  assert.match(pet.source, /Live/);
});

test("normalizes King County adoptable pet records", () => {
  const pet = normalizeKingCountyPet({
    animal_id: "A456",
    animal_name: "Buddy",
    animal_type: "Dog",
    animal_breed: "Pit Bull / Mix",
    animal_gender: "Neutered Male",
    age: "3 YEARS",
    city: "KENT",
    state: "WA",
    image: { url: "https://petharbor.com/image/A456" },
    link: { url: "https://petharbor.com/pet/A456" },
    memo: "Friendly</p> dog &amp; companion",
  }, 1);

  assert.equal(pet.id, "king-A456");
  assert.equal(pet.species, "Dog");
  assert.equal(pet.city, "KENT, WA, United States");
  assert.equal(pet.description, "Friendly dog & companion");
  assert.match(pet.source, /Live/);
});

test("rejects unsupported species and cleans provider markup", () => {
  assert.equal(canonicalSpecies("Bird"), null);
  assert.equal(cleanText("Friendly</p> pet &quot;today&quot;"), 'Friendly pet "today"');
  assert.equal(normalizeMontgomeryPet({
    animalid: "A789",
    petname: "Tweety",
    animaltype: "BIRD",
  }, 0), null);
});

test("database listings fail closed instead of exposing raw provider metadata", () => {
  const metadata = "{'animal_id': 'A123', 'memo': 'private ingestion payload'}";
  const pet = normalizeDatabasePet({
    id: "db-1",
    external_id: "A123",
    name: "Kitty Kittens",
    species: "Cat",
    breed: "Domestic Shorthair",
    age: "6 years",
    sex: "Spayed Female",
    size: metadata,
    city: "KENT",
    country: metadata,
    shelter: metadata,
    source_url: metadata,
    image_url: "https://example.org/kitty.jpg",
    latitude: 47.4,
    longitude: -122.2,
  }, 0);

  assert.equal(pet.size, "Unknown");
  assert.equal(pet.city, "KENT");
  assert.equal(pet.shelter, "Community rescue");
  assert.equal(pet.sourceUrl, null);
  assert.equal(pet.image, "https://example.org/kitty.jpg");
});
