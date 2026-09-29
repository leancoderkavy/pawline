import test from "node:test";
import assert from "node:assert/strict";
import handler, { createEventFeedFallbackLimiter, normalizeKingCountyEvent, normalizePasadenaEvent, safeEventUrl } from "../api/events.js";

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("normalizes an official dog adoption event", () => {
  const event = normalizePasadenaEvent({
    id: 42,
    title: "Pop-Up Dog Adoption Event",
    start_date: "2026-07-29 17:00:00",
    end_date: "2026-07-29 19:00:00",
    url: "https://pasadenahumane.org/phs-event/example/",
    description: "<p>Meet adoptable dogs at 3347 E. Foothill Blvd, Pasadena, CA 91107.</p>",
  });
  assert.equal(event.id, "pasadena-42");
  assert.equal(event.city, "Pasadena");
  assert.equal(event.address, "3347 E. Foothill Blvd, Pasadena, CA 91107");
  assert.match(event.source, /Live/);
});

test("includes pet support events without labeling them as adoption", () => {
  assert.equal(normalizePasadenaEvent({
    id: 43,
    title: "Pet Food Bank",
    start_date: "2026-07-29 17:00:00",
    description: "Dog food is available outside the adoption center.",
  }).type, "community");
});

test("classifies public training and community events separately from adoptions", () => {
  const training = normalizePasadenaEvent({
    id: 46, title: "Basics 101", start_date: "2027-07-29 17:00:00",
    categories: [{ slug: "training-classes" }],
    url: "https://pasadenahumane.org/phs-event/basics-101/",
  });
  assert.equal(training.type, "training");
  assert.equal(training.city, "Pasadena");
  assert.match(training.address, /Raymond Avenue/);
  const community = normalizePasadenaEvent({
    id: 47, title: "Pet community fair", start_date: "2027-07-30 17:00:00",
    description: "Join us at 361 S. Raymond Ave, Pasadena, CA 91105.",
    url: "https://pasadenahumane.org/phs-event/community-fair/",
  });
  assert.equal(community.type, "community");
});

test("includes located King County pet events and excludes closures", () => {
  const base = {
    event_name: "Pet Food Bank", start_time: "2026-10-04T13:00:00",
    location_city: "Kent", location_address: "21615 64th Ave S",
    location_state: "WA", location: { coordinates: [-122.2, 47.3] },
    url: "https://kingcounty.gov/petassistance",
  };
  const event = normalizeKingCountyEvent(base);
  assert.equal(event.type, "community");
  assert.equal(event.city, "Kent");
  assert.equal(event.latitude, 47.3);
  assert.match(event.starts_at, /2026-10-04T20:00:00/);
  assert.equal(normalizeKingCountyEvent({ ...base, start_time: "2026-10-04T13:00:00.000" }).starts_at, event.starts_at);
  assert.equal(normalizeKingCountyEvent({ ...base, event_name: "Pet Adoption Center CLOSED" }), null);
  assert.equal(normalizeKingCountyEvent({ ...base, location: null }), null);
});

test("event feed includes later official pages and sorts by start time", async () => {
  const previousFetch = global.fetch;
  const requestedPages = [];
  global.fetch = async (url) => {
    if (new URL(url).hostname !== "pasadenahumane.org") return { ok: true, json: async () => [] };
    const page = Number(new URL(url).searchParams.get("page") || 1);
    requestedPages.push(page);
    return { ok: true, json: async () => ({
      total_pages: 2,
      events: [{
        id: page, title: page === 1 ? "Dog Adoption Event" : "Basics 101",
        start_date: page === 1 ? "2027-10-02 17:00:00" : "2027-10-01 17:00:00",
        url: `https://pasadenahumane.org/phs-event/${page}/`,
        categories: page === 1 ? [] : [{ slug: "training-classes" }],
      }],
    }) };
  };
  try {
    const response = responseRecorder();
    await handler({ method: "GET", query: { limit: "250" }, headers: {}, socket: {} }, response);
    assert.deepEqual(requestedPages.sort(), [1, 2]);
    assert.equal(response.body.count, 2);
    assert.deepEqual(response.body.events.map(event => event.type), ["training", "adoption"]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("does not mistake promotion dates for street addresses", () => {
  const event = normalizePasadenaEvent({
    id: 44,
    title: "Hot Dog & Cool Cat Summer",
    start_date: "2026-07-31 09:30:00",
    description: "From July 31 to August 9, adoption fees for all adult dogs and cats will be waived.",
  });
  assert.equal(event.address, null);
  assert.equal(event.city, "Pasadena");
});

test("event navigation allows only valid HTTP URLs", () => {
  assert.equal(safeEventUrl("javascript:alert(1)"), null);
  assert.equal(safeEventUrl("data:text/html,hello"), null);
  assert.equal(safeEventUrl("not a URL"), null);
  assert.equal(safeEventUrl("https://pasadenahumane.org/events/1"), "https://pasadenahumane.org/events/1");
});

test("event feed keeps bounded fallback limits when durable storage is unavailable", () => {
  const reserve = createEventFeedFallbackLimiter({ clientLimit: 1, globalLimit: 2, windowMs: 1_000 });
  assert.equal(reserve("first", 10), true);
  assert.equal(reserve("first", 10), false);
  assert.equal(reserve("second", 10), true);
  assert.equal(reserve("third", 10), false);
});

test("event feed still checks the official provider when durable limits are unavailable", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ events: [{
      id: 45,
      title: "Dog Adoption Event",
      start_date: "2026-09-01 17:00:00",
      url: "https://pasadenahumane.org/events/45",
      description: "Meet adoptable dogs at 3347 E. Foothill Blvd, Pasadena, CA 91107.",
    }] }),
  });

  try {
    const response = responseRecorder();
    await handler({ method: "GET", headers: {}, socket: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.mode, "live");
    assert.equal(response.body.count, 1);
  } finally {
    global.fetch = previousFetch;
  }
});
