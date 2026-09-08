import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createChatFixture, ids, users } from "../e2e/chat-fixture.mjs";
import { catalogQuery, searchCatalog } from "../api/catalog.js";
import { parsePetCsv } from "../api/shelter-import.js";
import { validateLostReport } from "../api/lost-pets.js";
import { observedSource } from "../api/sources.js";
import { rescueSearchBody } from "../api/pets.js";

test("catalog rejects invalid cursors and partial coordinates", () => {
  assert.throws(() => catalogQuery({ cursor: "not-a-cursor" }), /cursor/);
  assert.throws(() => catalogQuery({ latitude: 20 }), /coordinates/);
  assert.throws(() => catalogQuery({ species: "Dragon" }), /species/);
  assert.equal(catalogQuery({ limit: 2.8 }).limit, 2);
  assert.throws(
    () => catalogQuery({ latitude: 999, longitude: 999 }),
    /coordinates/,
  );
  const body = rescueSearchBody(["Rabbit", "Reptile"], {
    latitude: 34,
    longitude: -118,
    radius: 50,
  });
  assert.equal(body.data.filterRadius.miles, 50);
  assert.ok(body.data.filters[1].criteria.includes("Rabbit"));
  assert.ok(body.data.filters[1].criteria.includes("Turtle"));
});
test("CSV preview supports quoted multiline values and rejects duplicate animal IDs", () => {
  const result = parsePetCsv(
    'external_id,name,species,description\n1,"Miso, Jr",Cat,"Friendly\ncompanion"\n1,Miso,Cat,duplicate',
  );
  assert.equal(result.pets[0].name, "Miso, Jr");
  assert.equal(result.errors[0].row, 3);
  assert.throws(() => parsePetCsv("name,species\nMiso,Cat"), /external_id/);
  assert.throws(
    () => parsePetCsv('external_id,name,species\n1,"Miso,Cat'),
    /closed/,
  );
});
test("public lost reports reject contact disclosures and impossible dates", () => {
  const body = {
    kind: "lost",
    species: "Cat",
    name: "Miso",
    description: "Orange with white paws",
    city: "Pasadena",
    eventDate: "2026-09-01",
    publicConsent: true,
  };
  assert.equal(validateLostReport(body, new Date("2026-09-08")).species, "Cat");
  assert.throws(
    () => validateLostReport({ ...body, description: "contact a@b.com" }),
    /private/,
  );
  assert.throws(
    () => validateLostReport({ ...body, eventDate: "2026-02-30" }),
    /date/,
  );
  assert.equal(
    observedSource(
      { enabled: true, last_success_at: "2026-01-01" },
      Date.parse("2026-09-08"),
    ).state,
    "stale",
  );
});

test("network migration, complete cursor search, imports, private reports use real PostgreSQL", async () => {
  const f = await createChatFixture();
  try {
    const { pg, database, invoke } = f;
    const migration = await readFile(
      new URL("../db/network-growth.sql", import.meta.url),
      "utf8",
    );
    await pg.transaction(async (tx) => {
      await tx.exec(migration);
    });
    await assert.rejects(
      pg.transaction(async (tx) => {
        await tx.exec("UPDATE pets SET name='should roll back'; SELECT 1/0;");
      }),
    );
    assert.equal(
      (
        await database`SELECT count(*)::int AS count FROM pets WHERE name='should roll back'`
      )[0].count,
      0,
    );
    // Repeated upgrade preserves existing animal records.
    assert.equal(
      (await database`SELECT count(*)::int AS count FROM pets`)[0].count,
      2,
    );
    let first = await searchCatalog(database, catalogQuery({ limit: 1 }));
    assert.equal(first.pets.length, 1);
    assert.ok(first.nextCursor);
    const second = await searchCatalog(
      database,
      catalogQuery({ limit: 1, cursor: first.nextCursor }),
    );
    assert.equal(second.pets.length, 1);
    assert.notEqual(first.pets[0].id, second.pets[0].id);
    assert.equal(second.nextCursor, null);
    const nearby = await searchCatalog(
      database,
      catalogQuery({ latitude: 34, longitude: -118, radius: 25 }),
    );
    assert.equal(nearby.pets.length, 0);
    for (const route of ["saved-searches", "lost-pets", "shelter-import"])
      assert.equal(
        (await invoke(route, null, { method: "POST" })).statusCode,
        401,
      );
    const saved = await invoke("saved-searches", "adopter", {
      method: "POST",
      body: { name: "Cats", filters: { species: "Cat" } },
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(
      (await invoke("saved-searches", "stranger")).data.searches.length,
      0,
    );
    assert.equal(
      (
        await invoke("saved-searches", "stranger", {
          method: "POST",
          body: { action: "check", id: saved.data.search.id },
        })
      ).statusCode,
      404,
    );
    const match = await invoke("saved-searches", "adopter", {
      method: "POST",
      body: { action: "check", id: saved.data.search.id },
    });
    assert.equal(match.data.pets.length, 2);
    const csv = "external_id,name,species\nR01,Hopper,Rabbit";
    assert.equal(
      (
        await invoke("shelter-import", "stranger", {
          method: "POST",
          body: { organizationId: ids.organization, csv },
        })
      ).statusCode,
      403,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await invoke("shelter-import", "shelter", {
            method: "POST",
            body: {
              organizationId: ids.organization,
              csv,
              action: "import",
              authorityConfirmed: true,
            },
          })
        ).statusCode,
        200,
      );
    const imported =
      await database`SELECT count(*)::int AS count FROM pets WHERE external_id='R01' AND status='pending'`;
    assert.equal(imported[0].count, 1);
    const report = await invoke("lost-pets", "adopter", {
      method: "POST",
      body: {
        kind: "lost",
        species: "Cat",
        name: "Miso",
        description: "Orange with white paws",
        city: "Pasadena",
        eventDate: "2026-09-01",
        publicConsent: true,
      },
    });
    assert.equal(report.statusCode, 200);
    const rid = report.data.report.id;
    assert.equal(
      (
        await invoke("lost-pets", "stranger", {
          method: "PATCH",
          body: { id: rid, status: "reunited" },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await invoke("lost-pets", "stranger", {
          method: "POST",
          body: {
            id: rid,
            action: "tip",
            body: "Seen near the public library",
          },
        })
      ).statusCode,
      200,
    );
    assert.equal((await invoke("lost-pets", "adopter")).data.tips.length, 1);
    assert.equal((await invoke("lost-pets", "teammate")).data.tips.length, 0);
  } finally {
    await f.close();
  }
});
