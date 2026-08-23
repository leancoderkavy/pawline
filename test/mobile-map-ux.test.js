import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the map location prompt has a real dismiss target above the discovery rail", async () => {
  const [app, styles] = await Promise.all([read("src/App.jsx"), read("src/styles.css")]);

  assert.match(app, /const dismissLocationPrompt = useCallback/);
  assert.match(app, /onDismissLocation=\{dismissLocationPrompt\}/);
  assert.match(app, /onPointerDown=\{event => event\.stopPropagation\(\)\} onClick=\{onDismissLocation\} aria-label="Dismiss location prompt"/);
  assert.match(styles, /\.location-permission \{ position:absolute;z-index:30/);
  assert.match(styles, /\.location-permission-dismiss \{[^}]*min-width:44px;min-height:32px/);
});

test("the mobile location field stays usable without a zoom-sized or undersized control", async () => {
  const styles = await read("src/styles.css");

  assert.match(styles, /\.global-location input \{ min-height:24px;font-size:16px; \}/);
  assert.doesNotMatch(styles, /\.global-location input \{ font-size:11px; \}/);
});

test("opening a map pet detail collapses and hides the discovery rail behind its modal", async () => {
  const [app, styles] = await Promise.all([read("src/App.jsx"), read("src/styles.css")]);

  assert.match(app, /const openPetDetail = pet => \{\s*setRailCollapsed\(true\);\s*setSelectedPet\(pet\);\s*\}/s);
  assert.match(app, /onOpenPet=\{openPetDetail\}/);
  assert.match(app, /\$\{selectedPet \? "detail-open" : ""\}/);
  assert.match(styles, /\.map-workspace\.detail-open \.map-rail \{ visibility:hidden;pointer-events:none; \}/);
});

test("mobile keeps the pet application action, map filters, and map link accessible", async () => {
  const [journey, styles] = await Promise.all([read("src/AdopterExperience.jsx"), read("src/styles.css")]);

  assert.ok(journey.indexOf('className="pet-page-sticky"') < journey.indexOf('className="journey-pet-layout"'));
  assert.match(styles, /\.journey-pet-page > \.pet-page-sticky \{ order:3; \}/);
  assert.match(styles, /\.pet-page-sticky \{ position:fixed;z-index:60;[^}]*bottom:calc\(72px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.journey-pet-page \{ padding-bottom:calc\(174px \+ env\(safe-area-inset-bottom\)\); \}/);
  assert.match(styles, /\.map-rail \.map-toolbar \.map-select select \{ min-height:44px; \}/);
  assert.match(styles, /\.journey-bottom-nav \{[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(journey, /\["map", Map, "Map"\]/);
  assert.match(journey, /key === "map" \? onOpenMap\(\) : navigate\(key\)/);
});

test("mobile Messages exposes usable account actions and the discovery rail only scrolls vertically", async () => {
  const [styles, journey] = await Promise.all([read("src/styles.css"), read("src/AdopterExperience.jsx")]);

  assert.match(journey, /className="journey-guest-auth-actions"/);
  assert.match(styles, /\.journey-guest-auth-actions \{ display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:18px; \}/);
  assert.match(styles, /\.journey-guest-auth-actions button \{ min-height:44px/);
  assert.doesNotMatch(styles, /@media \(max-width:820px\) \{[^}]*journey-guest-auth-actions[^}]*display:none/);
  assert.match(styles, /\.rail-content \{ height:calc\(100% - 68px\);overflow-x:hidden;overflow-y:auto; \}/);
  assert.match(styles, /\.match-title > div \{ min-width:0; \}/);
});

test("the nearby match quiz ranks the current map candidates and applies its species filter there", async () => {
  const app = await read("src/App.jsx");

  assert.match(app, /const setMatchSpecies = value => \{\s*setMapPetType\(value\);\s*setSpecies\(value\);\s*\}/s);
  assert.match(app, /<Matchmaker pets=\{mapView\.pets\} feed=\{feed\} location=\{location\} onLocationChange=\{setLocation\} onSpeciesChange=\{setMatchSpecies\}/);
});
