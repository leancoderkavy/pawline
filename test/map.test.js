import test from "node:test";
import assert from "node:assert/strict";

import handler, { createStaticMapFallbackLimiter } from "../api/map.js";

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    end() { return this; },
    send(body) { this.body = body; return this; },
  };
}

test("static map keeps bounded fallback limits when durable storage is unavailable", () => {
  const reserve = createStaticMapFallbackLimiter({ clientLimit: 1, globalLimit: 2, windowMs: 1_000 });
  assert.equal(reserve("first", 10), true);
  assert.equal(reserve("first", 10), false);
  assert.equal(reserve("second", 10), true);
  assert.equal(reserve("third", 10), false);
});

test("static map still renders when durable limits are unavailable", async () => {
  const previousToken = process.env.MAPBOX_ACCESS_TOKEN;
  const previousFetch = global.fetch;
  process.env.MAPBOX_ACCESS_TOKEN = "pk.test-public-token";
  const requestedUrls = [];
  global.fetch = async url => { requestedUrls.push(new URL(url)); return ({
    ok: true,
    headers: new Headers({ "content-type": "image/png" }),
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  }); };

  try {
    const response = responseRecorder();
    await handler({ method: "GET", query: {}, headers: {}, socket: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["Content-Type"], "image/png");
    assert.deepEqual([...response.body], [1, 2, 3]);
    assert.ok(requestedUrls[0].pathname.endsWith("/1280x900@2x"));
    await handler({ method: "GET", query: { variant: "mobile" }, headers: {}, socket: {} }, responseRecorder());
    assert.ok(requestedUrls[1].pathname.endsWith("/450x760@2x"));
    assert.equal(requestedUrls[1].searchParams.get("attribution"), "true");
  } finally {
    global.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
    else process.env.MAPBOX_ACCESS_TOKEN = previousToken;
  }
});
