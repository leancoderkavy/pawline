import test from "node:test";
import assert from "node:assert/strict";

import { createMapSearchInteraction } from "../src/mapSearchInteraction.js";

test("searches the new map center after a user drag ends", () => {
  const searches = [];
  const interaction = createMapSearchInteraction(center => searches.push(center));

  interaction.start({ originalEvent: { type: "mousedown" } });

  assert.equal(interaction.finish({ lng: -118.25, lat: 34.05 }), true);
  assert.deepEqual(searches, [{ longitude: -118.25, latitude: 34.05 }]);
});

test("searches once after a user scroll zoom settles", () => {
  const searches = [];
  const interaction = createMapSearchInteraction(center => searches.push(center));

  interaction.start({ originalEvent: { type: "wheel" } });

  assert.equal(interaction.finish({ lng: -118.1, lat: 34.2 }), true);
  assert.equal(interaction.finish({ lng: -118.1, lat: 34.2 }), false);
  assert.equal(searches.length, 1);
});

test("ignores programmatic map movement", () => {
  const searches = [];
  const interaction = createMapSearchInteraction(center => searches.push(center));

  interaction.start({});

  assert.equal(interaction.finish({ lng: -118.1, lat: 34.2 }), false);
  assert.deepEqual(searches, []);
});
