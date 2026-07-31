import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(app, /fetchPriority="high"/);
  assert.match(app, /if \(!interactive \|\| !containerRef\.current\)/);
  assert.match(app, /configured !== false/);
  assert.match(app, /mapboxConfigured: null/);
  assert.match(app, /variant=mobile/);
  assert.match(mapApi, /"450x760" : "900x620"/);
  assert.doesNotMatch(mapApi, /@2x/);
  assert.match(app, /lazy\(\(\) => import\("\.\/CommunityWithAuth"\)\)/);
  assert.match(app, /clerkConfigured && accountSyncReady/);
});
