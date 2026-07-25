import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalSpecies,
  cleanText,
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
