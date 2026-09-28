import test from "node:test";
import assert from "node:assert/strict";
import { createChatFixture } from "../e2e/chat-fixture.mjs";
import petsHandler from "../api/pets.js";
import sourcesHandler from "../api/sources.js";

test("map search and count exclude imported pets after source stops syncing", async () => {
  const fixture = await createChatFixture();
  const freshSource = "11111111-1111-4111-8111-111111111111";
  const staleSource = "22222222-2222-4222-8222-222222222222";
  try {
    await fixture.database`INSERT INTO sources (id, name, kind, enabled, last_success_at)
      VALUES (${freshSource}, 'Fresh feed', 'json', true, now()),
             (${staleSource}, 'Stale feed', 'json', true, now()-interval '7 days')`;
    await fixture.database`INSERT INTO pets (id, fingerprint, source_id, name, species, status, verified_at, latitude, longitude)
      VALUES ('33333333-3333-4333-8333-333333333333', 'fresh-map', ${freshSource}, 'Fresh dog', 'Dog', 'available', now(), 34, -118),
             ('44444444-4444-4444-8444-444444444444', 'stale-map', ${staleSource}, 'Stale dog', 'Dog', 'available', now()-interval '7 days', 34, -118)`;
    globalThis.__TEST_MOCK_DATABASE__ = fixture.database;
    const response = { statusCode: 200, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await petsHandler({ method: "GET", query: { species: "Dog", latitude: "34", longitude: "-118", radius: "25" }, headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.pets.map(pet => pet.name), ["Fresh dog"]);
    assert.equal(response.body.uniqueCurrentPets, 1);
    const sourceResponse = { body: null, setHeader() {}, status() { return this; }, json(body) { this.body = body; return this; } };
    await sourcesHandler({ method: "GET" }, sourceResponse);
    assert.equal(sourceResponse.body.inventory.available, 4);
    assert.equal(sourceResponse.body.inventory.searchable, 3);
  } finally {
    delete globalThis.__TEST_MOCK_DATABASE__;
    await fixture.close();
  }
});
