import test from "node:test";
import assert from "node:assert/strict";
import { createChatFixture } from "../e2e/chat-fixture.mjs";
import {
  createNearbySheltersHandler,
  fetchNearbyShelters,
  normalizeShelterQuery,
  parseNearbyShelters,
} from "../api/nearby-shelters.js";

const query = { latitude: 34.1478, longitude: -118.1445, radius: 50 };
async function invoke(handler, coordinates = query) {
  const response = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await handler({ method: "GET", query: coordinates, headers: {} }, response);
  return response;
}

test("shelter snapshots survive cold instances, coalesce concurrent reads, and fall back with honest freshness", async () => {
  const fixture = await createChatFixture();
  let clock = Date.now(),
    calls = 0,
    fail = false;
  const dependencies = {
    getDatabase: () => fixture.database,
    now: () => clock,
    reserve: async () => true,
    load: async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (fail) throw new DOMException("source down", "TimeoutError");
      return {
        shelters: [
          {
            id: "osm-node-1",
            name: "Public shelter",
            latitude: 34.14,
            longitude: -118.14,
          },
        ],
        radiusMiles: 25,
      };
    },
  };
  try {
    const handler = createNearbySheltersHandler(dependencies);
    const results = await Promise.all([invoke(handler), invoke(handler)]);
    assert.equal(calls, 1);
    assert.equal(results[0].body.mode, "live");
    const cold = await invoke(createNearbySheltersHandler(dependencies));
    assert.equal(cold.body.cached, true);
    assert.equal(calls, 1);
    clock += 20 * 60000;
    fail = true;
    const stale = await invoke(createNearbySheltersHandler(dependencies));
    assert.equal(stale.statusCode, 200);
    assert.equal(stale.body.stale, true);
    assert.equal(stale.body.observedAt, results[0].body.observedAt);
    await invoke(createNearbySheltersHandler(dependencies));
    assert.equal(calls, 2, "failed refresh cooldown persists across instances");
    clock += 8 * 86400000;
    const directory = await invoke(createNearbySheltersHandler(dependencies));
    assert.equal(directory.body.mode, "directory");
    assert.equal(directory.body.partial, true);
    assert.ok(
      directory.body.shelters.every((s) => s.id.startsWith("directory-")),
    );
    assert.match(directory.body.attribution.url, /laanimalservices/);
    const unknown = await invoke(createNearbySheltersHandler(dependencies), {
      latitude: 0,
      longitude: 0,
      radius: 25,
    });
    assert.equal(unknown.statusCode, 503);
    assert.equal(unknown.headers["Cache-Control"], "no-store");
    assert.equal(
      (await fixture.database`SELECT count(*)::int AS count FROM pets`)[0]
        .count,
      2,
    );
  } finally {
    await fixture.close();
  }
});

test("shelter search rejects partial source replies and respects upstream rate limits without retrying", async () => {
  assert.equal(
    normalizeShelterQuery({ latitude: "", longitude: null }).latitude,
    null,
  );
  assert.throws(
    () => parseNearbyShelters({ remark: "runtime timeout", elements: [] }),
    /Incomplete/,
  );
  assert.equal(
    parseNearbyShelters({
      elements: [{ type: "node", id: 1, lat: null, lon: null }],
    }).length,
    0,
  );
  let calls = 0;
  await assert.rejects(
    fetchNearbyShelters({ ...query, radiusMiles: 50 }, async () => {
      calls++;
      return new Response("busy", {
        status: 429,
        headers: { "Retry-After": "120" },
      });
    }),
    (error) => error.retryMs === 120000,
  );
  assert.equal(calls, 1);
});

test("saved searches find new animals beyond the first full page and keep owner-scoped cursors", async () => {
  const f = await createChatFixture();
  try {
    await f.database`UPDATE pets SET created_at=now()-interval '1 day'`;
    await f.database`INSERT INTO pets (id,fingerprint,name,species,status,verified_at,created_at)
      SELECT ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'old-search-'||n,'Old cat '||n,'Cat','available',now(),now()-interval '1 day' FROM generate_series(1,26) n`;
    const saved = await f.invoke("saved-searches", "adopter", {
      method: "POST",
      body: { name: "Cats", filters: { species: "Cat" } },
    });
    const id = saved.data.search.id;
    await f.database`UPDATE saved_pet_searches SET last_checked_at=now()-interval '1 minute' WHERE id=${id}`;
    await f.database`INSERT INTO pets (id,fingerprint,name,species,status,verified_at,created_at)
      SELECT ('f0000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'new-search-'||n,'New cat '||n,'Cat','available',now(),now()-interval '30 seconds' FROM generate_series(1,26) n`;
    const check = (body) =>
      f.invoke("saved-searches", "adopter", {
        method: "POST",
        body: { action: "check", id, ...body },
      });
    const full = await check({});
    assert.equal(
      full.data.newPets.length,
      0,
      "the old first page cannot detect later new pets",
    );
    const first = await check({ onlyNew: true });
    assert.equal(first.data.pets.length, 24);
    assert.ok(first.data.pets.every((p) => p.name.startsWith("New cat")));
    const second = await check({
      onlyNew: true,
      cursor: first.data.nextCursor,
    });
    assert.equal(second.data.pets.length, 2);
    assert.equal(second.data.nextCursor, null);
    assert.ok(
      second.data.pets.every(
        (p) => !first.data.pets.some((q) => q.id === p.id),
      ),
    );
    assert.equal((await check({ cursor: "invalid" })).statusCode, 422);
    assert.equal(
      (
        await f.invoke("saved-searches", "stranger", {
          method: "POST",
          body: {
            action: "check",
            id,
            onlyNew: true,
            cursor: first.data.nextCursor,
          },
        })
      ).statusCode,
      404,
    );
    await f.database`INSERT INTO saved_pet_searches (clerk_user_id,name,filters) SELECT clerk_user_id,'Other '||n,'{}'::jsonb FROM saved_pet_searches,generate_series(1,19) n WHERE id=${id}`;
    const update = await f.invoke("saved-searches", "adopter", {
      method: "POST",
      body: { name: "Cats", filters: { species: "Rabbit" } },
    });
    assert.equal(update.statusCode, 200);
    assert.equal(update.data.search.id, id);
    assert.equal(
      (
        await f.invoke("saved-searches", "adopter", {
          method: "POST",
          body: { name: "21st", filters: { species: "Cat" } },
        })
      ).statusCode,
      409,
    );
  } finally {
    await f.close();
  }
});
