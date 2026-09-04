import test from "node:test";
import assert from "node:assert/strict";
import { buildMapView, distanceInMiles, hasMapCoordinates, mapResultBounds, petCountLabel, petResultDetail } from "../src/mapView.js";

const center = { latitude: 47.38, longitude: -122.23 };

test("fit results bounds contain every valid point and handle empty and single results", () => {
  assert.equal(mapResultBounds([]), null);
  assert.deepEqual(mapResultBounds([center]), [[-122.23, 47.38], [-122.23, 47.38]]);
  assert.deepEqual(mapResultBounds([center, { latitude: 34, longitude: -118 }, { latitude: 999, longitude: 0 }]), [[-122.23, 34], [-118, 47.38]]);
});

test("invalid coordinates are excluded and antipodal distances remain finite", () => {
  assert.equal(hasMapCoordinates({ latitude: 91, longitude: 0 }), false);
  assert.equal(distanceInMiles(center, { latitude: NaN, longitude: 0 }), null);
  assert.ok(Number.isFinite(distanceInMiles({ latitude: -47.38, longitude: 57.77 }, center)));
});

test("map view excludes records without provider coordinates", () => {
  const view = buildMapView({
    pets: [
      { id: "mapped", species: "Cat", latitude: 47.39, longitude: -122.22 },
      { id: "unmapped", species: "Cat", latitude: null, longitude: null },
    ],
    events: [],
    discoveries: [],
    shelters: [{ id: "shelter", latitude: 47.385, longitude: -122.225 }],
    center,
  });

  assert.deepEqual(view.pets.map(pet => pet.id), ["mapped"]);
  assert.deepEqual(view.shelters.map(shelter => shelter.id), ["shelter"]);
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

test("pet result labels make species visible and use the selected species in counts", () => {
  assert.equal(petResultDetail({ species: "Cat", breed: "Domestic Shorthair", city: "Pasadena" }), "Cat · Domestic Shorthair");
  assert.equal(petResultDetail({ species: "Dog", city: "Pasadena" }), "Dog · Pasadena");
  assert.equal(petResultDetail({ species: "Dog", breed: "Details available from LA Animal Services", city: "Los Angeles" }), "Dog · Los Angeles");
  assert.equal(petCountLabel(6, "Cat"), "6 cats");
  assert.equal(petCountLabel(1, "Dog"), "1 dog");
  assert.equal(petCountLabel(0), "0 pets");
});
