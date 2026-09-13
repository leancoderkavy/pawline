import test from "node:test";
import assert from "node:assert/strict";

test("GET /api/pets serves from database without calling live providers", async (t) => {
  // Stub fetch to track and block provider URLs
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  
  globalThis.fetch = async (url, options) => {
    const urlString = String(url);
    fetchCalls.push(urlString);
    
    const providerPatterns = [
      "data.montgomerycountymd.gov",
      "data.kingcounty.gov", 
      "laanimalservices.com",
      "api.rescuegroups.org",
      "api.mapbox.com",
    ];
    
    if (providerPatterns.some(pattern => urlString.includes(pattern))) {
      throw new Error(`FAIL: Live provider call detected: ${urlString}`);
    }
    
    return originalFetch(url, options);
  };

  // Create mock database
  const mockDatabase = function(...args) {
    const query = args[0];
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    if (queryStr.includes("COUNT(*)") || queryStr.includes("count")) {
      return Promise.resolve([{ count: "0" }]);
    }
    
    return Promise.resolve([]);
  };
  
  mockDatabase.transaction = async (statements) => {
    return Promise.all(statements.map(() => Promise.resolve([])));
  };

  // Inject mock database via global
  globalThis.__TEST_MOCK_DATABASE__ = mockDatabase;

  try {
    const { default: handler } = await import("../api/pets.js");
    
    const request = {
      method: "GET",
      query: { species: "Dog", limit: "24", page: "1" },
      headers: {},
    };

    const response = {
      statusCode: null,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(key, value) {
        this.headers[key] = value;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };

    // Call the actual handler
    await handler(request, response);

    // REAL ASSERTIONS
    assert.equal(fetchCalls.length, 0, "No fetch calls to provider URLs should be made");
    assert.equal(response.statusCode, 200, "Should return 200 status");
    assert.ok(response.body, "Should return a response body");
    assert.equal(response.body.pagination, "limit-offset", "Should use limit-offset pagination");
    assert.ok("uniqueCurrentPets" in response.body, "Should have uniqueCurrentPets field");
    assert.ok(!("providerCount" in response.body), "Should NOT have providerCount field");

  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__TEST_MOCK_DATABASE__;
  }
});

test("GET /api/pets returns correct count and uniqueCurrentPets", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("FAIL: No fetches should occur");
  };

  const mockPets = [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      source_id: "4eec9ba1-1f85-4e6f-a21b-772f84bb0021",
      verified_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      external_id: "A001",
      name: "Buddy",
      species: "Dog",
      breed: "Labrador",
      age: "2 years",
      sex: "Male",
      size: "Large",
      city: "Derwood",
      country: "United States",
      shelter: "Montgomery County Animal Services",
      image_url: "https://example.com/buddy.jpg",
      source_url: "https://example.com/adopt/buddy",
      latitude: null,
      longitude: null,
      claimed_by_clerk_user_id: null,
      organization_id: null,
      organization_has_members: false,
    },
  ];

  const mockDatabase = function(...args) {
    const query = args[0];
    const queryStr = Array.isArray(query) ? query.join('') : String(query);
    
    if (queryStr.includes("COUNT(*)") || queryStr.includes("count")) {
      return Promise.resolve([{ count: "42" }]);
    }
    
    return Promise.resolve(mockPets);
  };
  
  mockDatabase.transaction = async (statements) => {
    return Promise.all(statements.map(() => Promise.resolve([])));
  };

  globalThis.__TEST_MOCK_DATABASE__ = mockDatabase;

  try {
    const { default: handler } = await import("../api/pets.js");
    
    const request = {
      method: "GET",
      query: { species: "Dog", limit: "10", page: "1" },
      headers: {},
    };

    const response = {
      statusCode: null,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(key, value) {
        this.headers[key] = value;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };

    await handler(request, response);

    // REAL ASSERTIONS
    assert.equal(response.statusCode, 200, "Should return 200");
    assert.equal(response.body.count, 1, "count should be pets in this result (1)");
    assert.equal(response.body.uniqueCurrentPets, 42, "uniqueCurrentPets should be total inventory (42)");
    assert.ok(!response.body.providerCount, "Should NOT have providerCount (RescueGroups meta.count)");

  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__TEST_MOCK_DATABASE__;
  }
});
