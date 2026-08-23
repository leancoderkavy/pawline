import assert from "node:assert/strict";
import test from "node:test";

import { discoveryDisplayLocation } from "../src/discoveryLocation.js";

test("a state explicitly named in a discovery title overrides contradictory query geography", () => {
  assert.equal(discoveryDisplayLocation({
    title: "Animal Care & Adoption Center | Montgomery County, VA",
    city: "Montgomery County, Maryland",
  }), "Montgomery County, Virginia");
});

test("discovery location preserves supplied city when the title does not identify a state", () => {
  assert.equal(discoveryDisplayLocation({ title: "County adoption center", city: "Rockville, Maryland" }), "Rockville, Maryland");
  assert.equal(discoveryDisplayLocation({ title: "County adoption center" }), "Location not supplied");
});
