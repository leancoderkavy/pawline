import assert from "node:assert";
import { test } from "node:test";

test("GET /api/pets geo search returns ONLY pets with coordinates", async (t) => {
  // Create mock database that returns pets
  const mockPets = [
    {
      id: 1,
      external_id: 'geo-1',
      name: 'Nearby Dog',
      species: 'Dog',
      breed: 'Labrador',
      age: 'Adult',
      sex: 'Male',
      size: 'Large',
      status: 'available',
      verified_at: new Date().toISOString(),
      city: 'Pasadena, CA',
      country: 'United States',
      latitude: 34.1478,
      longitude: -118.1445,
      shelter: 'Pasadena Shelter',
      source_url: 'https://example.com/1',
      source_id: null,
      image_url: null,
      claimed_by_clerk_user_id: null,
      organization_id: null,
      organization_has_members: false,
      distance_miles: 0.5,
    },
  ];

  const mockDatabase = function(query) {
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    // Count query
    if (queryStr.includes("COUNT(*)")) {
      return Promise.resolve([{ count: "2" }]);
    }
    
    // Geo search query (with coordinates only)
    if (queryStr.includes("ST_Distance") && queryStr.includes("latitude IS NOT NULL")) {
      return Promise.resolve(mockPets);
    }
    
    return Promise.resolve([]);
  };

  globalThis.__TEST_MOCK_DATABASE__ = mockDatabase;

  t.after(() => {
    delete globalThis.__TEST_MOCK_DATABASE__;
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
    headers: {},
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

  // uniqueCurrentPets should count all available pets
  assert.ok(responseBody.uniqueCurrentPets >= 2, "uniqueCurrentPets should include all available pets");
});

test("GET /api/pets suggests recenter when geo search returns 0 results", async (t) => {
  // Mock database returns no geo results but has a nearest pet
  const mockDatabase = function(query) {
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    // Nearest cluster query (for suggestedCenter) - check BEFORE generic COUNT(*) check
    if (queryStr.includes("GROUP BY latitude, longitude") && queryStr.includes("ORDER BY ST_Distance")) {
      return Promise.resolve([{
        latitude: 47.6062,
        longitude: -122.3321,
        city: 'Seattle, WA',
        count: "2",
      }]);
    }
    
    // Count query (pure count, not the cluster query)
    if (queryStr.includes("COUNT(*)") && !queryStr.includes("GROUP BY")) {
      return Promise.resolve([{ count: "2" }]);
    }
    
    // Geo search query (empty results)
    if (queryStr.includes("ST_Distance") && queryStr.includes("ST_DWithin")) {
      return Promise.resolve([]);
    }
    
    return Promise.resolve([]);
  };

  globalThis.__TEST_MOCK_DATABASE__ = mockDatabase;

  t.after(() => {
    delete globalThis.__TEST_MOCK_DATABASE__;
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
    headers: {},
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
  // Mock database with pagination support
  const allPets = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    external_id: `page-test-${i + 1}`,
    name: `Page Test Dog ${i + 1}`,
    species: 'Dog',
    breed: 'Labrador',
    age: 'Adult',
    sex: 'Male',
    size: 'Large',
    status: 'available',
    verified_at: new Date().toISOString(),
    city: 'Test City',
    country: 'United States',
    latitude: 34.1478,
    longitude: -118.1445,
    shelter: 'Test Shelter',
    source_url: `https://example.com/${i + 1}`,
    source_id: null,
    image_url: null,
    claimed_by_clerk_user_id: null,
    organization_id: null,
    organization_has_members: false,
    distance_miles: 0.1,
  }));

  const mockDatabase = function(query) {
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    // Count query
    if (queryStr.includes("COUNT(*)")) {
      return Promise.resolve([{ count: "30" }]);
    }
    
    // Geo search query - mock pagination
    if (queryStr.includes("ST_Distance")) {
      // Extract LIMIT and OFFSET from query context
      // This is a simplified mock - real queries have complex structure
      // Return more than limit to test hasMore logic
      return Promise.resolve(allPets.slice(0, 11)); // Return 11 for limit 10
    }
    
    return Promise.resolve([]);
  };

  globalThis.__TEST_MOCK_DATABASE__ = mockDatabase;

  t.after(() => {
    delete globalThis.__TEST_MOCK_DATABASE__;
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
    headers: {},
  };
  let responseBody1;
  const response1 = {
    status: () => response1,
    json: (body) => { responseBody1 = body; return response1; },
    setHeader: () => response1,
  };

  await handler(request1, response1);

  // Verify pagination works correctly
  assert.equal(responseBody1.pets.length, 10, "Page 1 should have 10 pets");
  assert.equal(responseBody1.hasMore, true, "Page 1 should have hasMore=true");
  assert.equal(responseBody1.page, 1, "Should be page 1");
});

test("GET /api/pets fails closed when PostGIS unavailable: no unlocated pets as local results", async (t) => {
  // Mock database that simulates PostGIS failure on geo query but succeeds on non-geo queries
  const mockDatabase = function(query) {
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    // PostGIS geo query - throw error to simulate PostGIS unavailable
    if (queryStr.includes("ST_Distance") || queryStr.includes("ST_DWithin")) {
      return Promise.reject(new Error("function st_distance(geometry, geography) does not exist"));
    }
    
    // Non-PostGIS fallback query for suggestedCenter (located pets)
    if (queryStr.includes("GROUP BY latitude, longitude, city")) {
      return Promise.resolve([{
        latitude: 47.6062,
        longitude: -122.3321,
        city: 'Seattle, WA',
        count: "5",
      }]);
    }
    
    // Count query
    if (queryStr.includes("COUNT(*)") && !queryStr.includes("GROUP BY")) {
      return Promise.resolve([{ count: "10" }]);
    }
    
    // Non-geo query (should NOT be reached when geo params are present)
    // This would return unlocated pets - the broken behavior we're fixing
    if (queryStr.includes("ORDER BY verified_at DESC")) {
      // If this is called when geo params are present, the test should fail
      return Promise.resolve([
        {
          id: 999,
          external_id: 'should-not-appear',
          name: 'Unlocated Pet',
          species: 'Dog',
          breed: 'Unknown',
          age: 'Adult',
          sex: 'Male',
          size: 'Medium',
          status: 'available',
          verified_at: new Date().toISOString(),
          city: 'United States',
          country: 'United States',
          latitude: null,
          longitude: null,
          shelter: 'Unknown Shelter',
          source_url: 'https://example.com/999',
          source_id: null,
          image_url: null,
          claimed_by_clerk_user_id: null,
          organization_id: null,
          organization_has_members: false,
        }
      ]);
    }
    
    return Promise.resolve([]);
  };

  globalThis.__TEST_MOCK_DATABASE__ = mockDatabase;

  t.after(() => {
    delete globalThis.__TEST_MOCK_DATABASE__;
  });

  const { default: handler } = await import("../api/pets.js");
  const request = {
    method: "GET",
    query: {
      species: "Dog",
      latitude: "34.1478",  // Geo params are present
      longitude: "-118.1445",
      radius: "50",
      limit: "3",
      page: "1",
    },
    headers: {},
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

  assert.equal(statusCode, 200, "Should return 200 OK even when PostGIS fails");
  assert.ok(responseBody, "Should have response body");
  
  // CRITICAL: When geo params are present but PostGIS fails, should return 0 pets (fail closed)
  // NOT fall back to unlocated pets as local results
  assert.equal(responseBody.pets.length, 0, "Should return 0 pets when PostGIS unavailable (fail closed)");
  assert.equal(responseBody.mode, "empty", "Mode should be empty when geo fails");
  
  // Should NOT include unlocated pets
  const unlocatedPet = responseBody.pets.find(p => p.name === "Unlocated Pet");
  assert.equal(unlocatedPet, undefined, "Should NOT return unlocated pets as local results when geo params present");
  
  // Should still provide suggestedCenter if possible (using non-PostGIS query)
  assert.ok(responseBody.suggestedCenter, "Should have suggestedCenter from fallback query");
  assert.ok(Number.isFinite(responseBody.suggestedCenter.latitude), "suggestedCenter should have latitude");
  assert.ok(Number.isFinite(responseBody.suggestedCenter.longitude), "suggestedCenter should have longitude");
  
  // Message should indicate geo is unavailable
  assert.ok(responseBody.message, "Should have a message");
  assert.match(responseBody.message, /geographic search.*unavailable/i, "Message should mention geo unavailable");
  
  // Should still report correct total inventory
  assert.ok(responseBody.uniqueCurrentPets > 0, "Should report total inventory count");
});
