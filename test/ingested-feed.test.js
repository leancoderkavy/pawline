import test from "node:test";
import assert from "node:assert/strict";

// Mock getDatabase before importing handler
let mockDatabase = null;
const originalModule = await import("../api/_db.js");
const mockedModule = {
  ...originalModule,
  getDatabase: () => mockDatabase,
};

// Replace the module
await import.meta.resolve("../api/_db.js");

// Now import handler with mocked database
const { default: handler } = await import("../api/pets.js");

test("GET /api/pets serves from database without calling live providers", async () => {
  // Mock fetch to track if any provider URLs are called
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  
  globalThis.fetch = async (url, options) => {
    const urlString = String(url);
    fetchCalls.push({ url: urlString, options });
    
    // If a provider URL is called, fail the test immediately
    const providerPatterns = [
      "data.montgomerycountymd.gov",
      "data.kingcounty.gov",
      "laanimalservices.com",
      "api.rescuegroups.org",
      "api.mapbox.com",
    ];
    
    if (providerPatterns.some(pattern => urlString.includes(pattern))) {
      throw new Error(`BLOCKER: Live provider call detected: ${urlString}`);
    }
    
    return originalFetch(url, options);
  };

  try {
    // Create mock database that returns empty results
    mockDatabase = function mockDb(...args) {
      const query = args[0];
      const queryStr = Array.isArray(query) ? query.join('') : String(query);
      
      // Count query
      if (queryStr.includes("COUNT(*)") || queryStr.includes("count")) {
        return Promise.resolve([{ count: "0" }]);
      }
      
      // Pet query - return empty array
      return Promise.resolve([]);
    };
    mockDatabase.transaction = async (statements) => {
      return Promise.all(statements.map(() => Promise.resolve([])));
    };

    // Create mock request and response
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

    // Call handler
    await handler(request, response);

    // ASSERTION 1: No live provider calls were made
    assert.equal(fetchCalls.length, 0, "No live provider calls should be made");

    // ASSERTION 2: Response is successful
    assert.equal(response.statusCode, 200, "Should return 200");
    assert.ok(response.body, "Should return a body");

    // ASSERTION 3: Uses limit-offset pagination, not federated-provider-pages
    assert.equal(response.body.pagination, "limit-offset", "Should use limit-offset pagination");
    assert.notEqual(response.body.pagination, "federated-provider-pages", "Should NOT use federated-provider-pages");

    // ASSERTION 4: Has uniqueCurrentPets field (inventory count)
    assert.ok("uniqueCurrentPets" in response.body, "Should include uniqueCurrentPets field");

    // ASSERTION 5: Does NOT have providerCount (RescueGroups meta.count)
    assert.ok(!("providerCount" in response.body), "Should not include providerCount field");

  } finally {
    globalThis.fetch = originalFetch;
    mockDatabase = null;
  }
});

test("GET /api/pets returns uniqueCurrentPets as inventory count with actual data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("BLOCKER: No fetches should occur");
  };

  try {
    // Mock database with actual pet data
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
      {
        id: "223e4567-e89b-12d3-a456-426614174001",
        source_id: "4eec9ba1-1f85-4e6f-a21b-772f84bb0021",
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        external_id: "A002",
        name: "Max",
        species: "Dog",
        breed: "German Shepherd",
        age: "3 years",
        sex: "Male",
        size: "Large",
        city: "Derwood",
        country: "United States",
        shelter: "Montgomery County Animal Services",
        image_url: "https://example.com/max.jpg",
        source_url: "https://example.com/adopt/max",
        latitude: null,
        longitude: null,
        claimed_by_clerk_user_id: null,
        organization_id: null,
        organization_has_members: false,
      },
    ];

    mockDatabase = function mockDb(...args) {
      const query = args[0];
      const queryStr = Array.isArray(query) ? query.join('') : String(query);
      
      if (queryStr.includes("COUNT(*)") || queryStr.includes("count")) {
        // Total inventory: 42 pets
        return Promise.resolve([{ count: "42" }]);
      }
      
      // Return 2 pets for this page
      return Promise.resolve(mockPets);
    };
    mockDatabase.transaction = async (statements) => {
      return Promise.all(statements.map(() => Promise.resolve([])));
    };

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

    // ASSERTION 6: count is unique pets in THIS result (2)
    assert.equal(response.body.count, 2, "count should be unique pets in this result");

    // ASSERTION 7: uniqueCurrentPets is total inventory (42)
    assert.equal(response.body.uniqueCurrentPets, 42, "uniqueCurrentPets should be total inventory");

    // ASSERTION 8: No providerCount field (would be RescueGroups meta.count)
    assert.ok(!response.body.providerCount, "should not include RescueGroups meta.count as providerCount");

  } finally {
    globalThis.fetch = originalFetch;
    mockDatabase = null;
  }
});
