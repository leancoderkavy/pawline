import assert from "node:assert/strict";
import test from "node:test";
import { importImageUrl } from "../api/_import-image.js";
import { ingestProvider, fetchAllLosAngelesPets, fetchAllRescueGroupsPets, recordProviderRun, retireProviderSpecies, RESCUEGROUPS_SYNC_SPECIES } from "../api/cron/ingest-providers.js";
import { createChatFixture } from "../e2e/chat-fixture.mjs";
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

test("provider page failures reject the whole snapshot", async () => {
  await assert.rejects(fetchAllLosAngelesPets(async (_species, { page }) => {
    if (page === 2) throw new Error("source failed");
    return Object.assign([{ externalId: "LA-1", image: "https://example.test/la.jpg" }], { hasMore: true });
  }), /source failed/);
  await assert.rejects(fetchAllRescueGroupsPets("key", async () => { throw new Error("HTTP 401"); }), /HTTP 401/);
  let page = 0;
  await assert.rejects(fetchAllRescueGroupsPets("key", async () => {
    page++;
    return page === 1
      ? { data: Array.from({ length: 250 }, (_, i) => ({ id: i + 1, attributes: { name: `Pet ${i + 1}` } })) }
      : {};
  }), /invalid animal page/);
});

test("RescueGroups completes snapshots for mapped pets beyond dogs and cats", async () => {
  const requested = [];
  await fetchAllRescueGroupsPets("key", async species => {
    requested.push(...species);
    return { data: [] };
  });
  assert.deepEqual(requested, RESCUEGROUPS_SYNC_SPECIES);
  assert.deepEqual(requested, ["Rabbit", "Bird", "Small animal", "Horse", "Reptile", "Barnyard"]);
});

test("retiring off-scope provider species keeps current rabbits and birds available", async () => {
  const fixture = await createChatFixture();
  const sourceId = "66666666-6666-4666-8666-666666666666";
  try {
    await fixture.database`INSERT INTO sources (id, name, kind, enabled) VALUES (${sourceId}, 'RescueGroups', 'json', true)`;
    await fixture.database`INSERT INTO pets (id, fingerprint, source_id, name, species, status, verified_at)
      VALUES ('11111111-1111-4111-8111-111111111112', 'retire-dog', ${sourceId}, 'Dog', 'Dog', 'available', now()),
             ('11111111-1111-4111-8111-111111111113', 'retire-cat', ${sourceId}, 'Cat', 'Cat', 'available', now()),
             ('11111111-1111-4111-8111-111111111114', 'keep-rabbit', ${sourceId}, 'Rabbit', 'Rabbit', 'available', now()),
             ('11111111-1111-4111-8111-111111111115', 'keep-bird', ${sourceId}, 'Bird', 'Bird', 'available', now())`;
    assert.equal(await retireProviderSpecies(fixture.database, sourceId, ["Dog", "Cat"]), 2);
    const rows = await fixture.database`SELECT species, status FROM pets WHERE source_id=${sourceId} ORDER BY species`;
    assert.deepEqual(rows.map(({ species, status }) => [species, status]), [
      ["Bird", "available"], ["Cat", "unavailable"], ["Dog", "unavailable"], ["Rabbit", "available"],
    ]);
  } finally {
    await fixture.close();
  }
});

test("provider run state records failure and only a complete run clears it", async () => {
  const fixture = await createChatFixture();
  const sourceId = "55555555-5555-4555-8555-555555555555";
  try {
    await fixture.database`INSERT INTO sources (id, name, kind, enabled) VALUES (${sourceId}, 'Provider', 'json', true)`;
    await recordProviderRun(fixture.database, sourceId, { error: new Error("HTTP 401") });
    let [source] = await fixture.database`SELECT last_success_at, last_error FROM sources WHERE id=${sourceId}`;
    assert.equal(source.last_success_at, null);
    assert.equal(source.last_error, "HTTP 401");
    await recordProviderRun(fixture.database, sourceId, { fetched: 2, upserted: 2 });
    [source] = await fixture.database`SELECT last_success_at, last_error FROM sources WHERE id=${sourceId}`;
    assert.ok(source.last_success_at);
    assert.equal(source.last_error, null);
    const runs = await fixture.database`SELECT status, fetched_count FROM ingestion_runs WHERE source_id=${sourceId} ORDER BY started_at`;
    assert.deepEqual(runs.map(run => run.status), ["error", "success"]);
    assert.equal(runs[1].fetched_count, 2);
  } finally {
    await fixture.close();
  }
});

test("shelter CSV preview rejects photo-less rows and retains valid rows", () => {
  const result = parsePetCsv("external_id,name,species,image_url\n1,Dog,Dog,\n2,Cat,Cat,https://example.com/cat.jpg\n3,Bird,Bird,javascript:bad");
  assert.deepEqual(result.pets.map(pet => pet.externalId), ["2"]);
  assert.deepEqual(result.errors.map(error => error.row), [2, 4]);
  assert.ok(result.errors.every(error => /image URL is required/.test(error.error)));
});
