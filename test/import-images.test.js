import assert from "node:assert/strict";
import test from "node:test";
import { importImageUrl } from "../api/_import-image.js";
import { ingestProvider } from "../api/cron/ingest-providers.js";
import { parsePetCsv } from "../api/shelter-import.js";

test("import photo metadata rejects missing, unsafe and malformed URLs", () => {
  for (const value of [undefined, null, "", "  ", false, {}, "null", "/photo.jpg", "data:image/png;base64,abc", "javascript:alert(1)", "https://", "https://user:pass@example.com/photo.jpg"]) {
    assert.equal(importImageUrl(value), null, String(value));
  }
  assert.equal(importImageUrl("  http://example.com/pet.jpg  "), "https://example.com/pet.jpg");
});

test("provider import writes only pets with photos, across all species", async () => {
  const inserts = [];
  const database = (strings, ...values) => {
    if (strings.join("").includes("INSERT INTO pets")) inserts.push(values);
    return Promise.resolve([]);
  };
  database.transaction = statements => Promise.all(statements);
  const pets = ["Dog", "Cat", "Rabbit", "Bird", "Horse", "Reptile", "Barnyard", "Small animal"]
    .flatMap((species, i) => [
      { externalId: `photo-${i}`, name: "With photo", species, shelter: "QA", image: `https://example.com/${i}.jpg` },
      { externalId: `missing-${i}`, name: "No photo", species, shelter: "QA" },
    ]);
  const result = await ingestProvider(database, "qa-source", pets, "QA");
  assert.equal(result.upserted, 8);
  assert.equal(result.skipped_without_image, 8);
  assert.equal(inserts.length, 8);
  assert.ok(inserts.every(values => values.includes("With photo") && !values.includes("No photo")));
});

test("all-photo-less provider snapshot does not mutate inventory", async () => {
  const database = () => { throw new Error("Unexpected database write"); };
  const result = await ingestProvider(database, "qa", [{ name: "No photo" }], "QA");
  assert.deepEqual(result, { upserted: 0, marked_unavailable: 0, skipped_without_image: 1 });
});

test("shelter CSV preview rejects photo-less rows and retains valid rows", () => {
  const result = parsePetCsv("external_id,name,species,image_url\n1,Dog,Dog,\n2,Cat,Cat,https://example.com/cat.jpg\n3,Bird,Bird,javascript:bad");
  assert.deepEqual(result.pets.map(pet => pet.externalId), ["2"]);
  assert.deepEqual(result.errors.map(error => error.row), [2, 4]);
  assert.ok(result.errors.every(error => /image URL is required/.test(error.error)));
});
