import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalSpecies,
  cleanText,
  createPetFeedFallbackLimiter,
  normalizeDatabasePet,
  normalizeKingCountyPet,
  normalizeLosAngelesPet,
  normalizeMontgomeryPet,
  normalizePetQuery,
  parseLosAngelesPets,
  safeHttpUrl,
} from "../api/pets.js";

test("provider navigation URLs reject active and malformed schemes", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,unsafe"), null);
  assert.equal(safeHttpUrl("not a url"), null);
  assert.equal(safeHttpUrl("https://example.org/pet/1"), "https://example.org/pet/1");
});

test("pet feed provider fan-out has bounded query pagination", () => {
  assert.deepEqual(normalizePetQuery({ page: "999", limit: "999", species: "Lizard" }), {
    species: ["Dog", "Cat"], limit: 50, page: 20,
  });
  assert.deepEqual(normalizePetQuery({ page: "-5", limit: "0", species: "Dog" }), {
    species: ["Dog"], limit: 24, page: 1,
  });
});

test("public pet feeds retain bounded fallback limits if durable limits are unavailable", () => {
  const reserve = createPetFeedFallbackLimiter({ clientLimit: 2, globalLimit: 3, windowMs: 1_000 });

  assert.equal(reserve("client-one", 10), true);
  assert.equal(reserve("client-one", 10), true);
  assert.equal(reserve("client-one", 10), false);
  assert.equal(reserve("client-two", 10), true);
  assert.equal(reserve("client-three", 10), false);
  assert.equal(reserve("client-three", 1_000), true);
});

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

test("parses live LA Animal Services cards into shelter-mapped pets", () => {
  const pets = parseLosAngelesPets(`
    <div class="views-row"><div class="pet-result">
      <img class="pet-result__image" src="https://petharbor.com/get_image.asp?RES=Detail&amp;ID=A2286725&amp;LOCATION=LACT2" alt="Dog&#x20;named&#x20;Blanco&#x20;with&#x20;Animal&#x20;ID&#x3A;&#x20;A2286725" />
      <div class="pet-result__content">
        <h3 class="pet-result__name"><a class="pet-result__link" href="/pet/a2286725">Blanco</a></h3>
        <span class="pet-result__id">A2286725</span>
      </div>
    </div></div>
  `);

  assert.equal(pets.length, 1);
  assert.equal(pets[0].species, "Dog");
  assert.equal(pets[0].shelter, "West Los Angeles Animal Shelter");
  assert.equal(pets[0].address, "11361 West Pico Blvd, Los Angeles, CA 90064");
  assert.equal(pets[0].locationAccuracy, "shelter");
  assert.ok(Number.isFinite(pets[0].latitude));
  assert.match(pets[0].sourceUrl, /laanimalservices\.com\/pet\/a2286725/);
});

test("LA Animal Services records fail closed without a known shelter location", () => {
  assert.equal(normalizeLosAngelesPet({
    id: "A1",
    name: "Friend",
    species: "Dog",
    locationCode: "UNKNOWN",
  }), null);
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
