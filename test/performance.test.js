import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { restoreFavoriteAfterFailure } from "../src/favoritesState.js";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the homepage server-renders without eagerly loading Clerk", async () => {
  const [page, layout] = await Promise.all([read("app/page.jsx"), read("app/layout.jsx")]);
  assert.doesNotMatch(page, /ssr:\s*false/);
  assert.doesNotMatch(page, /@clerk\/react/);
  assert.doesNotMatch(layout, /ClerkProvider/);
  assert.match(page, /<PawlineApp/);
});

test("the map uses a lightweight preview before loading Mapbox", async () => {
  const [app, mapApi] = await Promise.all([read("src/App.jsx"), read("api/map.js")]);
  assert.match(app, /const \[interactive, setInteractive\] = useState\(false\)/);
  assert.match(app, /className="map-facade"/);
  assert.match(app, /onError=\{\(\) => setPreviewUnavailable\(true\)\}/);
  assert.match(app, /className=\{previewUnavailable \? "is-unavailable" : undefined\}/);
  assert.match(app, /fetchPriority="high"/);
  assert.match(app, /if \(!interactive \|\| !containerRef\.current\)/);
  assert.match(app, /configured === true/);
  assert.match(app, /configured === null \? "status"/);
  assert.match(app, /mapboxConfigured: null/);
  assert.match(app, /variant=mobile/);
  assert.match(mapApi, /"450x760" : "900x620"/);
  assert.doesNotMatch(mapApi, /@2x/);
  assert.match(app, /lazy\(\(\) => import\("\.\/CommunityWithAuth"\)\)/);
  assert.match(app, /clerkConfigured && savedHydrated/);
});

test("unavailable map search keeps the existing map center and reports the limitation", async () => {
  const app = await read("src/App.jsx");
  assert.doesNotMatch(app, /setCoordinates\(null\)/);
  assert.match(app, /coordinates\?\.latitude, coordinates\?\.longitude/);
  assert.match(app, /setLocation\(currentMapArea\)/);
  assert.match(app, /remains selected/);
});

test("the top location search offers map-backed autocomplete", async () => {
  const [app, styles, geocode] = await Promise.all([read("src/App.jsx"), read("src/styles.css"), read("api/geocode.js")]);
  assert.match(app, /function LocationAutocomplete/);
  assert.match(app, /autocomplete=true&session_token=/);
  assert.match(app, /role="combobox"/);
  assert.match(app, /aria-autocomplete="list"/);
  assert.match(app, /role="listbox"/);
  assert.match(app, /event\.key === "ArrowDown"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /onSelect=\{selectLocation\}/);
  assert.match(styles, /\.global-location-suggestions \{ position:absolute/);
  assert.match(styles, /\.location-suggestion \{ min-height:52px/);
  assert.match(geocode, /address,street,place,locality,neighborhood,postcode,region,country/);
  assert.match(geocode, /url\.searchParams\.set\("autocomplete", "true"\)/);
  assert.match(geocode, /url\.searchParams\.set\("session_token", searchSession\)/);
});

test("every rendered map point has a keyboard-accessible result action", async () => {
  const app = await read("src/App.jsx");
  const results = app.slice(app.indexOf("function MapResults"), app.indexOf("function VisitPlanner"));
  assert.doesNotMatch(results, /\.slice\(/);
  assert.match(results, /className="map-result-open"/);
});

test("favorite persistence failures stay truthful and expose recovery", async () => {
  const [app, sync] = await Promise.all([read("src/App.jsx"), read("src/FavoritesSync.jsx")]);
  assert.match(app, /catch \{ setFavoriteError\("Favorites could not be saved/);
  assert.match(app, /localStorage\.setItem\("pawline-saved", JSON\.stringify\(nextSaved\)\)/);
  assert.match(app, /setSaved\(nextSaved\)/);
  assert.match(app, /restoreFavoriteAfterFailure\(current, id, favorite\)/);
  assert.match(app, /savedRef\.current = restored/);
  assert.match(app, /role="alert"/);
  assert.match(app, />Retry favorites</);
  assert.match(sync, /onError\(error\.message/);
  assert.match(app, /openPanel\(showSavedOnly \? "explore" : "favorites"\)/);
  assert.match(sync, /pawline-favorites-account/);
  assert.match(sync, /priorAccount === null \? localRef\.current : \[\]/);
});

test("a failed favorite write rolls back only its own listing", () => {
  assert.deepEqual(restoreFavoriteAfterFailure(["pet-b", "pet-c"], "pet-b", true), ["pet-c"]);
  assert.deepEqual(restoreFavoriteAfterFailure(["pet-c"], "pet-b", false), ["pet-c", "pet-b"]);
});

test("intake role radios implement roving focus and arrow-key selection", async () => {
  const app = await read("src/App.jsx");
  assert.match(app, /const chooseRoleByKeyboard = event =>/);
  assert.match(app, /"ArrowLeft", "ArrowUp", "Home"/);
  assert.match(app, /"ArrowRight", "ArrowDown", "End"/);
  assert.match(app, /data-listing-role="personal"/);
  assert.match(app, /tabIndex=\{listingRole === "organization" \? 0 : -1\}/);
});
