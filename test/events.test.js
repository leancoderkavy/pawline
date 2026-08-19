import test from "node:test";
import assert from "node:assert/strict";
import handler, { createEventFeedFallbackLimiter, normalizePasadenaEvent, safeEventUrl } from "../api/events.js";

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

test("rejects events that are not dog adoption events", () => {
  assert.equal(normalizePasadenaEvent({
    id: 43,
    title: "Pet Food Bank",
    start_date: "2026-07-29 17:00:00",
    description: "Dog food is available outside the adoption center.",
  }), null);
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
