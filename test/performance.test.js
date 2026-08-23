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

test("discovery renders live listings incrementally and resets the list after a species change", async () => {
  const [journey, styles] = await Promise.all([read("src/AdopterExperience.jsx"), read("src/styles.css")]);
  assert.match(journey, /const DISCOVERY_PAGE_SIZE = 24;/);
  assert.match(journey, /const \[visibleCount, setVisibleCount\] = useState\(DISCOVERY_PAGE_SIZE\);/);
  assert.match(journey, /const visibleRanked = ranked\.slice\(0, visibleCount\);/);
  assert.match(journey, /setSpecies\(option\); setVisibleCount\(DISCOVERY_PAGE_SIZE\);/);
  assert.match(journey, /Showing \{visibleRanked\.length\} of \{ranked\.length\} current pets\./);
  assert.match(journey, /Load \{Math\.min\(DISCOVERY_PAGE_SIZE, ranked\.length - visibleRanked\.length\)\} more pets/);
  assert.match(styles, /\.discovery-pagination \{ display:flex;justify-content:center;/);
});

test("navigation shells expose a keyboard skip link with a focusable content target", async () => {
  const [journey, app, styles, methodology, guides, nearbyGuide, matchingGuide] = await Promise.all([
    read("src/AdopterExperience.jsx"), read("src/App.jsx"), read("src/styles.css"),
    read("app/how-pawline-works/page.jsx"), read("app/guides/page.jsx"),
    read("app/guides/find-adoptable-pets-near-you/page.jsx"), read("app/guides/find-a-pet-that-fits-your-home-and-routine/page.jsx"),
  ]);
  assert.match(journey, /<a className="skip-link" href="#pawline-home">Skip to main content<\/a>/);
  assert.match(journey, /<main id="pawline-home" tabIndex=\{-1\}>/);
  assert.match(app, /<a className="skip-link" href="#discover">Skip to main content<\/a>/);
  assert.match(app, /<main id="discover" tabIndex=\{-1}/);
  for (const page of [methodology, guides, nearbyGuide, matchingGuide]) {
    assert.match(page, /<a className="skip-link" href="#main-content">Skip to main content<\/a>/);
    assert.match(page, /<article id="main-content" className="methodology-content" tabIndex=\{-1\}>/);
  }
  assert.match(styles, /\.skip-link \{ position:fixed;z-index:100;/);
  assert.match(styles, /\.skip-link:focus-visible \{ transform:translate\(-50%,0\);/);
});

test("support-page headers and protected fallbacks fit narrow screens", async () => {
  const [styles, methodology, guides, nearbyGuide, matchingGuide, claim, moderation] = await Promise.all([
    read("src/styles.css"),
    read("app/how-pawline-works/page.jsx"),
    read("app/guides/page.jsx"),
    read("app/guides/find-adoptable-pets-near-you/page.jsx"),
    read("app/guides/find-a-pet-that-fits-your-home-and-routine/page.jsx"),
    read("app/shelter/claim/ClaimOrganizationClient.jsx"),
    read("app/pawline-moderation/reviews/ReviewModerationClient.jsx"),
  ]);
  assert.match(styles, /\.methodology-nav-short,\.methodology-discover-short \{ display:none; \}/);
  assert.match(styles, /\.methodology-nav-long,\.methodology-discover-long \{ display:none; \}/);
  for (const page of [methodology, guides, nearbyGuide, matchingGuide]) {
    assert.match(page, /methodology-nav-short/);
    assert.match(page, /methodology-discover-short/);
  }
  for (const source of [claim, moderation]) {
    assert.match(source, /boxSizing: "border-box"/);
    assert.match(source, /overflowWrap: "anywhere"/);
  }
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
  assert.match(app, /clerkConfigured && accountSyncReady/);
});

test("unavailable map search keeps the existing map center and reports the limitation", async () => {
  const app = await read("src/App.jsx");
  assert.doesNotMatch(app, /setCoordinates\(null\)/);
  assert.match(app, /coordinates\?\.latitude, coordinates\?\.longitude/);
  assert.match(app, /setLocation\(currentMapArea\)/);
  assert.match(app, /remains selected/);
});

test("the map surprise control chooses only an existing current listing", async () => {
  const [app, styles] = await Promise.all([read("src/App.jsx"), read("src/styles.css")]);
  assert.match(app, /const chooseSurprisePet = \(\) => \{/);
  assert.match(app, /const alternatives = mapView\.pets\.filter/);
  assert.match(app, /Math\.random\(\) \* candidates\.length/);
  assert.match(app, /aria-describedby="map-surprise-note"/);
  assert.match(app, /"Pick a hello"/);
  assert.match(styles, /\.map-surprise \{ min-height:44px/);
  assert.match(styles, /prefers-reduced-motion:no-preference/);
});

test("the discovery drawer keeps pet finding primary and secondary views tucked away", async () => {
  const [app, styles] = await Promise.all([read("src/App.jsx"), read("src/styles.css")]);
  assert.match(styles, /\.rail-tabs \{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.rail-tabs \{ position:relative;z-index:7;/);
  assert.match(styles, /--mobile-drawer-height:min\(76dvh,680px\)/);
  assert.match(styles, /\.rail-tabs \{ height:60px;border-radius:18px;background:rgba\(255,253,249,\.97\);overflow:visible; \}/);
  assert.match(styles, /\.rail-tabs \{ height:48px;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-template-rows:1fr/);
  assert.match(styles, /\.rail-tabs button \{ min-height:44px;padding:0 8px;[^}]*flex-direction:row;[^}]*font-size:11px/);
  assert.match(styles, /\.rail-more > div \{[^}]*top:calc\(100% \+ 6px\)/);
  assert.match(styles, /\.rail-tabs button svg \{ display:none; \}/);
  assert.match(styles, /\.rail-tabs \.rail-label-full \{ display:inline; \}/);
  assert.match(styles, /\.rail-tabs \.rail-label-short \{ display:none; \}/);
  assert.match(styles, /\.map-rail \.map-pet-types \{[^}]*display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.mobile-view-map \{ min-height:44px/);
  assert.match(app, /\["All", "Dog", "Cat"\]\.map/);
  assert.match(app, /<Compass \/> View map/);
  assert.match(app, /aria-label="Match quiz"/);
  assert.match(app, /className="rail-label-full">Match me/);
  assert.match(app, /<summary><Menu \/>More<\/summary>/);
});

test("map filters keep species choice primary and disclose secondary controls inline", async () => {
  const [app, styles] = await Promise.all([read("src/App.jsx"), read("src/styles.css")]);
  const filters = app.slice(app.indexOf("function MapFilters"), app.indexOf("function NearbyShelters"));

  assert.match(filters, /const activeFilterCount = \[distance !== "150", hoursFilter !== "all", !showEvents, densityMode\]\.filter\(Boolean\)\.length/);
  assert.match(filters, /className="map-pet-types"/);
  assert.match(filters, /<span>Filters<\/span>/);
  assert.match(filters, /aria-label="Map search radius"/);
  assert.doesNotMatch(filters, /Filter map by pet type/);
  assert.match(styles, /\.map-rail \.map-toolbar \{ display:grid !important;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(styles, /\.map-rail \.more-filters\[open\] \{ grid-column:1\/-1/);
  assert.match(styles, /\.map-rail \.more-filters > div \{ position:static/);
  assert.match(styles, /\.map-rail \.map-pet-types button \{ min-height:46px/);
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
  assert.match(app, /const toggleSavedOnly = \(\) => \{[^}]*setAccountSyncReady\(true\)/s);
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
