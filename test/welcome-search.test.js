import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { welcomeLocationQuery, WELCOME_QUERY_MAX } from "../src/welcomeSearch.js";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("welcome place queries are trimmed, collapsed and bounded; blank input is empty", () => {
  assert.equal(welcomeLocationQuery("  Seattle,   WA \n"), "Seattle, WA");
  assert.equal(welcomeLocationQuery("98101"), "98101");
  for (const blank of ["", "   ", null, undefined]) assert.equal(welcomeLocationQuery(blank), "");
  assert.equal(welcomeLocationQuery("x".repeat(300)).length, WELCOME_QUERY_MAX);
});

test("the welcome screen offers a labelled place search that runs the map's location search", async () => {
  const onboarding = await read("src/Onboarding.jsx");
  assert.match(onboarding, /role="search"/);
  assert.match(onboarding, /<label htmlFor="onboarding-location">Find pets near<\/label>/);
  assert.match(onboarding, /id="onboarding-location"/);
  assert.match(onboarding, /aria-invalid=\{placeError \? "true" : undefined\}/);
  assert.match(onboarding, /role="alert"/);
  assert.match(onboarding, /onSearchLocation\(query\)/);
  // Without a search handler the field still leads to the map rather than doing nothing.
  assert.match(onboarding, /else onNavigate\("explore"\)/);

  const app = await read("src/App.jsx");
  assert.match(app, /<Onboarding onNavigate=\{openPanel\} onSearchLocation=\{searchFromWelcome\} \/>/);
  assert.match(app, /const findMatch = async query =>/);
  assert.match(app, /encodeURIComponent\(place\)/);
  assert.match(app, /const searchFromWelcome = query => \{\s+setLocation\(query\);\s+openPanel\("explore"\);\s+capture\("search_performed"\);\s+findMatch\(query\);/);

  // The map's own search stays hidden on the welcome panel, which is why this field exists.
  const css = await read("src/onboarding.css");
  assert.match(css, /\.panel-onboarding \.rail-search/);
  assert.match(css, /\.onboarding-search-row input \{[^}]*min-height:44px/);
  // White on --rust is about 4:1; the welcome button uses the 4.5:1-safe contrast token.
  assert.match(css, /\.onboarding-search-row \.button \{[^}]*background:var\(--rust-contrast\); color:#fff;/);
});
