import test from "node:test";
import assert from "node:assert/strict";
import { normalizePasadenaEvent, safeEventUrl } from "../api/events.js";

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
