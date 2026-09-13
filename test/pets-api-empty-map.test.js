import assert from "node:assert";
import { test } from "node:test";

test("GET /api/pets with geo filter includes pets without coordinates", async (t) => {
  const { getTestDatabase } = await import("../api/_db.js");
  const database = await getTestDatabase();

  // Insert test pets: some with coords, some without
  await database`
    INSERT INTO pets (external_id, name, species, breed, age, sex, size, status, verified_at, city, country, latitude, longitude, shelter, source_url)
    VALUES 
      ('geo-1', 'Nearby Dog', 'Dog', 'Labrador', 'Adult', 'Male', 'Large', 'available', NOW(), 'Pasadena, CA', 'United States', 34.1478, -118.1445, 'Pasadena Shelter', 'https://example.com/1'),
      ('no-geo-1', 'Unknown Location Dog', 'Dog', 'Mixed breed', 'Young', 'Female', 'Medium', 'available', NOW(), 'United States', 'United States', NULL, NULL, 'Community Rescue', 'https://example.com/2'),
      ('no-geo-2', 'Another Unknown Cat', 'Cat', 'Tabby', 'Adult', 'Male', 'Small', 'available', NOW(), 'United States', 'United States', NULL, NULL, 'Remote Shelter', 'https://example.com/3')
  `;

  t.after(async () => {
    await database`DELETE FROM pets WHERE external_id IN ('geo-1', 'no-geo-1', 'no-geo-2')`;
    await database.end({ timeout: 1 });
  });

  const { default: handler } = await import("../api/pets.js");
  const request = {
    method: "GET",
    query: {
      species: "Dog",
      latitude: "34.1478",
      longitude: "-118.1445",
      radius: "150",
      limit: "24",
      page: "1",
    },
  };
  let statusCode;
  let responseBody;
  const response = {
    status: (code) => {
      statusCode = code;
      return response;
    },
    json: (body) => {
      responseBody = body;
      return response;
    },
    setHeader: () => response,
  };

  await handler(request, response);

  assert.equal(statusCode, 200, "Should return 200 OK");
  assert.ok(responseBody, "Should have response body");
  assert.ok(Array.isArray(responseBody.pets), "Should have pets array");
  assert.ok(responseBody.pets.length > 0, "Should return pets");
  
  // Should include pet with coordinates
  const nearbyDog = responseBody.pets.find(p => p.name === "Nearby Dog");
  assert.ok(nearbyDog, "Should include pet with coordinates near search center");
  assert.equal(nearbyDog.latitude, 34.1478, "Geo pet should have latitude");
  assert.equal(nearbyDog.longitude, -118.1445, "Geo pet should have longitude");

  // Should ALSO include pets without coordinates
  const noGeoDog = responseBody.pets.find(p => p.name === "Unknown Location Dog");
  assert.ok(noGeoDog, "Should include pet without coordinates");
  assert.equal(noGeoDog.latitude, null, "No-coord pet should have null latitude");
  assert.equal(noGeoDog.longitude, null, "No-coord pet should have null longitude");
  
  // uniqueCurrentPets should count all available pets, not just geo-filtered
  assert.ok(responseBody.uniqueCurrentPets >= 2, "uniqueCurrentPets should include pets without coords");
});

test("GET /api/pets geo search does not return 0 pets when inventory exists", async (t) => {
  const { getTestDatabase } = await import("../api/_db.js");
  const database = await getTestDatabase();

  // Insert pets WITHOUT coordinates (simulating the production issue)
  await database`
    INSERT INTO pets (external_id, name, species, breed, age, sex, size, status, verified_at, city, country, latitude, longitude, shelter, source_url)
    VALUES 
      ('no-coord-1', 'Dog Without Coords 1', 'Dog', 'Mixed', 'Adult', 'Male', 'Medium', 'available', NOW(), 'United States', 'United States', NULL, NULL, 'Remote Rescue', 'https://example.com/1'),
      ('no-coord-2', 'Dog Without Coords 2', 'Dog', 'Shepherd', 'Young', 'Female', 'Large', 'available', NOW(), 'United States', 'United States', NULL, NULL, 'Another Rescue', 'https://example.com/2')
  `;

  t.after(async () => {
    await database`DELETE FROM pets WHERE external_id IN ('no-coord-1', 'no-coord-2')`;
    await database.end({ timeout: 1 });
  });

  const { default: handler } = await import("../api/pets.js");
  const request = {
    method: "GET",
    query: {
      species: "Dog",
      latitude: "34.1478",  // Pasadena, CA
      longitude: "-118.1445",
      radius: "150",
      limit: "24",
      page: "1",
    },
  };
  let statusCode;
  let responseBody;
  const response = {
    status: (code) => {
      statusCode = code;
      return response;
    },
    json: (body) => {
      responseBody = body;
      return response;
    },
    setHeader: () => response,
  };

  await handler(request, response);

  assert.equal(statusCode, 200, "Should return 200 OK");
  assert.ok(responseBody, "Should have response body");
  
  // The fix: even with 0 geo results, should return pets without coords
  assert.ok(responseBody.pets.length > 0, "Should return pets even when no geo-filtered results exist");
  assert.ok(responseBody.uniqueCurrentPets >= 2, "Should report correct inventory count");
  
  // Verify the returned pets are the no-coord ones
  const dog1 = responseBody.pets.find(p => p.name === "Dog Without Coords 1");
  const dog2 = responseBody.pets.find(p => p.name === "Dog Without Coords 2");
  assert.ok(dog1 || dog2, "Should return at least one of the no-coord dogs");
});
