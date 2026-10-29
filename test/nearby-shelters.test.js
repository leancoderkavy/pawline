import test from "node:test";
import assert from "node:assert/strict";
import {
  buildShelterQuery,
  createNearbySheltersHandler,
  createShelterSearchLimiter,
  normalizeShelterQuery,
  parseNearbyShelters,
  shelterSearchRadii,
} from "../api/nearby-shelters.js";

test("nearby shelter queries clamp map coordinates and radius", () => {
  assert.deepEqual(normalizeShelterQuery({ latitude: "34.1478", longitude: "-118.1445", radius: "150" }), {
    latitude: 34.1478,
    longitude: -118.1445,
    radiusMiles: 50,
  });
  assert.equal(normalizeShelterQuery({ latitude: "north", longitude: "-118" }).latitude, null);
  assert.match(buildShelterQuery({ latitude: 34.1478, longitude: -118.1445, radiusMiles: 25 }), /around:40234,34\.14780,-118\.14450/);
});

test("nearby shelter searches use a responsive radius plan with a tighter retry", () => {
  assert.deepEqual(shelterSearchRadii(50), [25, 12]);
  assert.deepEqual(shelterSearchRadii(25), [25, 12]);
  assert.deepEqual(shelterSearchRadii(12), [12]);
});

test("nearby shelter parsing keeps safe public contact fields and center coordinates", () => {
  const shelters = parseNearbyShelters({
    elements: [{
      type: "way",
      id: 42,
      center: { lat: 34.14, lon: -118.15 },
      tags: {
        name: "Pasadena Humane",
        "addr:housenumber": "361",
        "addr:street": "South Raymond Avenue",
        "addr:city": "Pasadena",
        "animal_shelter": "dog;cat",
        "animal_shelter:adoption": "yes",
        website: "https://pasadenahumane.org/",
      },
    }, {
      type: "node",
      id: 43,
      lat: 34.2,
      lon: -118.2,
      tags: { name: "Unsafe link", website: "javascript:alert(1)" },
    }],
  });

  assert.equal(shelters.length, 2);
  assert.equal(shelters[0].address, "361 South Raymond Avenue, Pasadena");
  assert.equal(shelters[0].adoptionIndicated, true);
  assert.equal(shelters[0].website, "https://pasadenahumane.org/");
  assert.equal(shelters[1].website, null);
});

test("nearby shelter lookup limiter resets and stays bounded", () => {
  const reserve = createShelterSearchLimiter({ clientLimit: 1, globalLimit: 2, windowMs: 1000 });
  assert.equal(reserve("one", 10), true);
  assert.equal(reserve("one", 20), false);
  assert.equal(reserve("two", 20), true);
  assert.equal(reserve("one", 1010), true);
});

function fakeResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("stale nearby shelter results return at once and refresh after the response", async () => {
  let clock = Date.UTC(2026, 8, 29, 12);
  let loads = 0;
  let release;
  const handler = createNearbySheltersHandler({
    now: () => clock,
    getDatabase: () => null,
    reserve: async () => true,
    load: async () => {
      loads += 1;
      if (loads > 1) await new Promise(resolve => { release = resolve; });
      return { shelters: [{ id: `osm-${loads}` }], radiusMiles: 25 };
    },
  });
  const query = { latitude: "34.1478", longitude: "-118.1445", radius: "25" };
  const tasks = [];
  const request = () => ({ method: "GET", query, headers: {}, waitUntil: task => tasks.push(task) });

  const first = fakeResponse();
  await handler(request(), first);
  assert.equal(first.body.shelters[0].id, "osm-1");

  clock += 16 * 60 * 1000;
  const stale = fakeResponse();
  await handler(request(), stale);
  assert.equal(stale.body.stale, true);
  assert.equal(stale.body.shelters[0].id, "osm-1");
  assert.equal(stale.headers["Cache-Control"], "public, s-maxage=60");

  const again = fakeResponse();
  await handler(request(), again);
  assert.equal(again.body.stale, true);
  assert.equal(tasks.length, 1, "only one background refresh runs per key");

  release();
  await Promise.all(tasks);
  const fresh = fakeResponse();
  await handler(request(), fresh);
  assert.equal(fresh.body.shelters[0].id, "osm-2");
  assert.equal(fresh.body.stale, undefined);
  assert.equal(loads, 2);
});

test("stale nearby shelter results still refresh inline without a background runner", async () => {
  let clock = Date.UTC(2026, 8, 29, 12);
  let loads = 0;
  const handler = createNearbySheltersHandler({
    now: () => clock,
    getDatabase: () => null,
    reserve: async () => true,
    load: async () => ({ shelters: [{ id: `osm-${++loads}` }], radiusMiles: 25 }),
  });
  const request = { method: "GET", query: { latitude: "34.1", longitude: "-118.1" }, headers: {} };
  await handler(request, fakeResponse());
  clock += 16 * 60 * 1000;
  const response = fakeResponse();
  await handler(request, response);
  assert.equal(response.body.shelters[0].id, "osm-2");
});
