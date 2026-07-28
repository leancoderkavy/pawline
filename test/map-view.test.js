import test from "node:test";
import assert from "node:assert/strict";
import { buildMapView, distanceInMiles, hasMapCoordinates } from "../src/mapView.js";

const center = { latitude: 47.38, longitude: -122.23 };

test("map view excludes records without provider coordinates", () => {
  const view = buildMapView({
    pets: [
      { id: "mapped", species: "Cat", latitude: 47.39, longitude: -122.22 },
      { id: "unmapped", species: "Cat", latitude: null, longitude: null },
    ],
    events: [],
    discoveries: [],
    center,
  });

  assert.deepEqual(view.pets.map(pet => pet.id), ["mapped"]);
  assert.equal(hasMapCoordinates({ latitude: null, longitude: null }), false);
});

test("map view applies species and radius before limiting or rendering points", () => {
  const view = buildMapView({
    pets: [
      { id: "near-cat", species: "Cat", latitude: 47.39, longitude: -122.22 },
      { id: "far-cat", species: "Cat", latitude: 39.11, longitude: -77.16 },
      { id: "near-dog", species: "Dog", latitude: 47.4, longitude: -122.21 },
    ],
    events: [],
    discoveries: [],
    center,
    petType: "Cat",
    distance: 25,
  });

  assert.deepEqual(view.pets.map(pet => pet.id), ["near-cat"]);
});

test("map view sorts coordinate-backed records nearest first and hides events", () => {
  const view = buildMapView({
    pets: [
      { id: "farther", species: "Dog", latitude: 47.5, longitude: -122.1 },
      { id: "nearer", species: "Dog", latitude: 47.381, longitude: -122.231 },
    ],
    events: [{ id: "event", latitude: 47.38, longitude: -122.23 }],
    discoveries: [],
    center,
    showEvents: false,
  });

  assert.deepEqual(view.pets.map(pet => pet.id), ["nearer", "farther"]);
  assert.deepEqual(view.events, []);
  assert.ok(distanceInMiles(view.pets[0], center) < distanceInMiles(view.pets[1], center));
});
