import assert from "node:assert";
import { test } from "node:test";

test("GET /api/pets geo search returns ONLY pets with coordinates", async (t) => {
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
  assert.ok(responseBody.pets.length > 0, "Should return pets with coordinates");
  
  // Should include pet with coordinates
  const nearbyDog = responseBody.pets.find(p => p.name === "Nearby Dog");
  assert.ok(nearbyDog, "Should include pet with coordinates near search center");
  assert.equal(nearbyDog.latitude, 34.1478, "Geo pet should have latitude");
  assert.equal(nearbyDog.longitude, -118.1445, "Geo pet should have longitude");

  // Should NOT include pets without coordinates in geo search
  const noGeoDog = responseBody.pets.find(p => p.name === "Unknown Location Dog");
  assert.equal(noGeoDog, undefined, "Should NOT include pet without coordinates in geo search");
  
  // uniqueCurrentPets should count all available pets, including those without coords
  assert.ok(responseBody.uniqueCurrentPets >= 2, "uniqueCurrentPets should include all available pets");
});

test("GET /api/pets suggests recenter when geo search returns 0 results", async (t) => {
  const { getTestDatabase } = await import("../api/_db.js");
  const database = await getTestDatabase();

  // Insert pets far from Pasadena (Seattle area) with coordinates
  await database`
    INSERT INTO pets (external_id, name, species, breed, age, sex, size, status, verified_at, city, country, latitude, longitude, shelter, source_url)
    VALUES 
      ('seattle-1', 'Seattle Dog 1', 'Dog', 'Mixed', 'Adult', 'Male', 'Medium', 'available', NOW(), 'Seattle, WA', 'United States', 47.6062, -122.3321, 'Seattle Rescue', 'https://example.com/1'),
      ('seattle-2', 'Seattle Dog 2', 'Dog', 'Shepherd', 'Young', 'Female', 'Large', 'available', NOW(), 'Seattle, WA', 'United States', 47.6062, -122.3321, 'Seattle Animal Services', 'https://example.com/2')
  `;

  t.after(async () => {
    await database`DELETE FROM pets WHERE external_id IN ('seattle-1', 'seattle-2')`;
    await database.end({ timeout: 1 });
  });

  const { default: handler } = await import("../api/pets.js");
  const request = {
    method: "GET",
    query: {
      species: "Dog",
      latitude: "34.1478",  // Pasadena, CA (far from Seattle)
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
  
  // Should return 0 pets (none within 150 miles of Pasadena)
  assert.equal(responseBody.pets.length, 0, "Should return 0 pets when none in radius");
  assert.equal(responseBody.mode, "empty", "Should have mode 'empty'");
  
  // Should suggest a recenter location
  assert.ok(responseBody.suggestedCenter, "Should have suggestedCenter when geo returns 0");
  assert.ok(Number.isFinite(responseBody.suggestedCenter.latitude), "suggestedCenter should have latitude");
  assert.ok(Number.isFinite(responseBody.suggestedCenter.longitude), "suggestedCenter should have longitude");
  assert.ok(responseBody.suggestedCenter.city, "suggestedCenter should have city");
  assert.ok(responseBody.suggestedCenter.count > 0, "suggestedCenter should have count > 0");
  
  // Message should mention the suggested location
  assert.ok(responseBody.message, "Should have helpful message");
  assert.match(responseBody.message, /no pets found.*try searching/i, "Message should suggest trying different location");
  
  // Should still report correct inventory count
  assert.ok(responseBody.uniqueCurrentPets >= 2, "Should report correct inventory count");
});

test("GET /api/pets pagination works correctly with geo filter", async (t) => {
  const { getTestDatabase } = await import("../api/_db.js");
  const database = await getTestDatabase();

  // Insert 30 pets in same location to test pagination
  const insertValues = [];
  for (let i = 1; i <= 30; i++) {
    insertValues.push({
      external_id: `page-test-${i}`,
      name: `Page Test Dog ${i}`,
      species: 'Dog',
      breed: 'Labrador',
      age: 'Adult',
      sex: 'Male',
      size: 'Large',
      status: 'available',
      verified_at: new Date(),
      city: 'Test City',
      country: 'United States',
      latitude: 34.1478,
      longitude: -118.1445,
      shelter: 'Test Shelter',
      source_url: `https://example.com/${i}`
    });
  }
  
  for (const pet of insertValues) {
    await database`
      INSERT INTO pets ${database(pet, 'external_id', 'name', 'species', 'breed', 'age', 'sex', 'size', 'status', 'verified_at', 'city', 'country', 'latitude', 'longitude', 'shelter', 'source_url')}
    `;
  }

  t.after(async () => {
    await database`DELETE FROM pets WHERE external_id LIKE 'page-test-%'`;
    await database.end({ timeout: 1 });
  });

  const { default: handler } = await import("../api/pets.js");
  
  // Page 1
  const request1 = {
    method: "GET",
    query: {
      species: "Dog",
      latitude: "34.1478",
      longitude: "-118.1445",
      radius: "150",
      limit: "10",
      page: "1",
    },
  };
  let responseBody1;
  const response1 = {
    status: () => response1,
    json: (body) => { responseBody1 = body; return response1; },
    setHeader: () => response1,
  };

  await handler(request1, response1);

  // Page 2
  const request2 = {
    method: "GET",
    query: {
      species: "Dog",
      latitude: "34.1478",
      longitude: "-118.1445",
      radius: "150",
      limit: "10",
      page: "2",
    },
  };
  let responseBody2;
  const response2 = {
    status: () => response2,
    json: (body) => { responseBody2 = body; return response2; },
    setHeader: () => response2,
  };

  await handler(request2, response2);

  // Verify pagination works correctly
  assert.equal(responseBody1.pets.length, 10, "Page 1 should have 10 pets");
  assert.equal(responseBody2.pets.length, 10, "Page 2 should have 10 pets");
  assert.equal(responseBody1.hasMore, true, "Page 1 should have hasMore=true");
  
  // Verify pages don't overlap (no repeated pets)
  const page1Ids = responseBody1.pets.map(p => p.id);
  const page2Ids = responseBody2.pets.map(p => p.id);
  const overlap = page1Ids.filter(id => page2Ids.includes(id));
  assert.equal(overlap.length, 0, "Pages should not have overlapping pets");
});
