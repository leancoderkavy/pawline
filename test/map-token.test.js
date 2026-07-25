import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/map-token.js";

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("map token endpoint returns only configured public tokens", () => {
  const previous = process.env.MAPBOX_ACCESS_TOKEN;
  process.env.MAPBOX_ACCESS_TOKEN = "pk.test-public-token";
  const response = responseRecorder();

  handler({ method: "GET" }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.accessToken, "pk.test-public-token");
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  if (previous === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
  else process.env.MAPBOX_ACCESS_TOKEN = previous;
});

test("map token endpoint fails closed for missing or secret tokens", () => {
  const previous = process.env.MAPBOX_ACCESS_TOKEN;
  process.env.MAPBOX_ACCESS_TOKEN = "sk.secret-token";
  const response = responseRecorder();

  handler({ method: "GET" }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error, "Interactive maps are not configured.");
  if (previous === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
  else process.env.MAPBOX_ACCESS_TOKEN = previous;
});
