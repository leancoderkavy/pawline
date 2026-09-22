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

test("GET /api/pets uses haversine fallback when PostGIS unavailable", async (t) => {
  // Mock database that simulates PostGIS failure on geo query but returns located pets
  const allLocatedPets = [
    // Pet within 50 miles of Pasadena (34.1478, -118.1445)
    {
      id: 1,
      external_id: 'nearby-1',
      name: 'Nearby Dog LA',
      species: 'Dog',
      breed: 'Labrador',
      age: 'Adult',
      sex: 'Male',
      size: 'Large',
      status: 'available',
      verified_at: new Date().toISOString(),
      city: 'Los Angeles, CA',
      country: 'United States',
      latitude: 34.0522, // ~7 miles from Pasadena
      longitude: -118.2437,
      shelter: 'LA Shelter',
      source_url: 'https://example.com/1',
      source_id: null,
      image_url: null,
      claimed_by_clerk_user_id: null,
      organization_id: null,
      organization_has_members: false,
    },
    // Pet far from Pasadena (Seattle)
    {
      id: 2,
      external_id: 'far-1',
      name: 'Seattle Dog',
      species: 'Dog',
      breed: 'Retriever',
      age: 'Young',
      sex: 'Female',
      size: 'Medium',
      status: 'available',
      verified_at: new Date().toISOString(),
      city: 'Seattle, WA',
      country: 'United States',
      latitude: 47.6062, // ~960 miles from Pasadena
      longitude: -122.3321,
      shelter: 'Seattle Rescue',
      source_url: 'https://example.com/2',
      source_id: null,
      image_url: null,
      claimed_by_clerk_user_id: null,
      organization_id: null,
      organization_has_members: false,
    },
  ];

  const mockDatabase = function(query) {
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    // PostGIS geo query - throw error to simulate PostGIS unavailable
    if (queryStr.includes("ST_Distance") || queryStr.includes("ST_DWithin")) {
      return Promise.reject(new Error("function st_distance(geometry, geography) does not exist"));
    }
    
    // Fallback query for ALL located pets (haversine will filter client-side)
    if (queryStr.includes("latitude IS NOT NULL") && queryStr.includes("ORDER BY verified_at DESC")) {
      return Promise.resolve(allLocatedPets);
    }
    
    // Count query
    if (queryStr.includes("COUNT(*)")) {
      return Promise.resolve([{ count: "2" }]);
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
      latitude: "34.1478",  // Pasadena
      longitude: "-118.1445",
      radius: "50",  // 50 miles radius
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

  assert.equal(statusCode, 200, "Should return 200 OK");
  assert.ok(responseBody, "Should have response body");
  
  // Should return ONLY the nearby pet (within 50 miles), using haversine
  assert.equal(responseBody.pets.length, 1, "Should return 1 pet within 50 miles using haversine");
  assert.equal(responseBody.pets[0].name, "Nearby Dog LA", "Should return the LA pet (within radius)");
  
  // Should NOT include the Seattle pet (outside radius)
  const seattlePet = responseBody.pets.find(p => p.name === "Seattle Dog");
  assert.equal(seattlePet, undefined, "Should NOT include Seattle pet (outside 50 mile radius)");
  
  // Should NOT have suggestedCenter since we got results
  assert.equal(responseBody.suggestedCenter, undefined, "Should not have suggestedCenter when results found");
  
  // Should report total inventory
  assert.ok(responseBody.uniqueCurrentPets > 0, "Should report total inventory count");
});

test("GET /api/pets haversine fallback finds nearest cluster when radius empty", async (t) => {
  // All pets are far from search point - should return empty + nearest suggestedCenter
  const allLocatedPets = [
    {
      id: 1,
      external_id: 'seattle-1',
      name: 'Seattle Dog 1',
      species: 'Dog',
      breed: 'Mixed',
      age: 'Adult',
      sex: 'Male',
      size: 'Medium',
      status: 'available',
      verified_at: new Date().toISOString(),
      city: 'Seattle, WA',
      country: 'United States',
      latitude: 47.6062, // ~960 miles from Pasadena
      longitude: -122.3321,
      shelter: 'Seattle Rescue',
      source_url: 'https://example.com/1',
      source_id: null,
      image_url: null,
      claimed_by_clerk_user_id: null,
      organization_id: null,
      organization_has_members: false,
    },
    {
      id: 2,
      external_id: 'portland-1',
      name: 'Portland Dog',
      species: 'Dog',
      breed: 'Retriever',
      age: 'Young',
      sex: 'Female',
      size: 'Large',
      status: 'available',
      verified_at: new Date().toISOString(),
      city: 'Portland, OR',
      country: 'United States',
      latitude: 45.5152, // ~835 miles from Pasadena
      longitude: -122.6784,
      shelter: 'Portland Shelter',
      source_url: 'https://example.com/2',
      source_id: null,
      image_url: null,
      claimed_by_clerk_user_id: null,
      organization_id: null,
      organization_has_members: false,
    },
  ];

  const mockDatabase = function(query) {
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    // PostGIS queries fail
    if (queryStr.includes("ST_Distance") || queryStr.includes("ST_DWithin")) {
      return Promise.reject(new Error("PostGIS unavailable"));
    }
    
    // Fallback query for located pets
    if (queryStr.includes("latitude IS NOT NULL") && queryStr.includes("ORDER BY verified_at DESC")) {
      return Promise.resolve(allLocatedPets);
    }
    
    // Count query
    if (queryStr.includes("COUNT(*)")) {
      return Promise.resolve([{ count: "2" }]);
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
      latitude: "34.1478",  // Pasadena
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

  assert.equal(statusCode, 200, "Should return 200 OK");
  
  // Should return 0 pets (none within 50 miles)
  assert.equal(responseBody.pets.length, 0, "Should return 0 pets when none in radius");
  assert.equal(responseBody.mode, "empty", "Mode should be empty");
  
  // Should have suggestedCenter pointing to nearest cluster (Portland is closer than Seattle)
  assert.ok(responseBody.suggestedCenter, "Should have suggestedCenter");
  assert.ok(Number.isFinite(responseBody.suggestedCenter.latitude), "Should have latitude");
  assert.ok(Number.isFinite(responseBody.suggestedCenter.longitude), "Should have longitude");
  assert.ok(responseBody.suggestedCenter.city, "Should have city");
  assert.equal(responseBody.suggestedCenter.city, "Portland, OR", "Should suggest nearest cluster (Portland is closer)");
  
  // Message should use honest empty copy (haversine worked, just found nothing nearby)
  assert.ok(responseBody.message, "Should have message");
  assert.match(responseBody.message, /no pets found.*within.*miles/i, "Message should use honest empty copy");
  assert.doesNotMatch(responseBody.message, /temporarily unavailable/i, "Should NOT say temporarily unavailable when haversine works");
});

test("GET /api/pets fails completely when both PostGIS and haversine throw", async (t) => {
  // Mock database that fails for BOTH PostGIS AND haversine fallback queries
  const mockDatabase = function(query) {
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    // PostGIS geo query - throw error
    if (queryStr.includes("ST_Distance") || queryStr.includes("ST_DWithin")) {
      return Promise.reject(new Error("PostGIS unavailable"));
    }
    
    // Haversine fallback query (fetch all located pets) - ALSO throw error
    if (queryStr.includes("latitude IS NOT NULL") && queryStr.includes("ORDER BY verified_at DESC")) {
      return Promise.reject(new Error("Database connection lost during fallback"));
    }
    
    // Count query still works
    if (queryStr.includes("COUNT(*)")) {
      return Promise.resolve([{ count: "10" }]);
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

  assert.equal(statusCode, 200, "Should still return 200 OK (fail closed, not error)");
  assert.ok(responseBody, "Should have response body");
  
  // CRITICAL: When both PostGIS and haversine fail, return empty (fail closed)
  // NOT unfiltered/unlocated pets as local results
  assert.equal(responseBody.pets.length, 0, "Should return 0 pets when both geo methods fail (fail closed)");
  assert.equal(responseBody.mode, "empty", "Mode should be empty");
  
  // Should NOT have suggestedCenter (couldn't calculate it)
  assert.equal(responseBody.suggestedCenter, undefined, "Should not have suggestedCenter when haversine fails");
  
  // Message should indicate ACTUAL failure (not honest empty)
  assert.ok(responseBody.message, "Should have a message");
  assert.match(responseBody.message, /geographic search.*temporarily unavailable/i, "Message should say temporarily unavailable when both methods fail");
  
  // Should still report correct total inventory
  assert.ok(responseBody.uniqueCurrentPets > 0, "Should report total inventory count");
});
