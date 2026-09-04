import assert from "node:assert/strict";
import test from "node:test";
import { MAP_PANELS, panelFromHash, panelHash, claimTokenFromHash, claimMapLocation } from "../src/mapPanels.js";

test("map panel links round-trip, including nested guides and legacy discovery links", () => {
  for (const panel of MAP_PANELS) assert.equal(panelFromHash(panelHash(panel)), panel);
  for (const hash of ["", "#map", "#discover", "#unknown"]) assert.equal(panelFromHash(hash), "explore");
  for (const hash of ["#guides", "#guides/nearby", "#guides/matching", "#how-pawline-works"]) assert.equal(panelFromHash(hash), "resources");
});

test("legacy claim fragments transfer to the map without placing credentials in a request URL", () => {
  const token = "test-invitation/+&=";
  const destination = claimMapLocation(`#${new URLSearchParams({ token })}`);
  const url = new URL(destination, "https://www.pawlineadopt.com");
  assert.equal(url.pathname, "/");
  assert.equal(url.search, "");
  assert.equal(panelFromHash(url.hash), "claim");
  assert.equal(claimTokenFromHash(url.hash), token);
  assert.equal(claimMapLocation(url.hash), destination);
  assert.equal(claimMapLocation(""), "/#claim");
  assert.equal(claimTokenFromHash("#claim"), "");
});
