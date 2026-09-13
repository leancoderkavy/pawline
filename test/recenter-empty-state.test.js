import assert from "node:assert";
import { test } from "node:test";

test("Discovery component shows recenter control when API returns suggestedCenter", async () => {
  const { readFile } = await import("node:fs/promises");
  const adopterSource = await readFile("src/AdopterExperience.jsx", "utf-8");

  // Verify Discovery accepts onRecenter prop
  assert.match(
    adopterSource,
    /function Discovery\(\{[^}]*onRecenter[^}]*\}\)/,
    "Discovery should accept onRecenter prop"
  );

  // Verify Discovery uses feed.suggestedCenter
  assert.match(
    adopterSource,
    /suggestedCenter.*=.*feed\?\.suggestedCenter/,
    "Discovery should extract suggestedCenter from feed"
  );

  // Verify empty state shows recenter button when suggestedCenter present
  assert.match(
    adopterSource,
    /suggestedCenter.*\?.*<button[^>]*onClick=\{[^}]*onRecenter\(suggestedCenter\)/,
    "Should render recenter button when suggestedCenter is present"
  );

  // Verify button uses suggestedCenter.city
  assert.match(
    adopterSource,
    /Search near.*suggestedCenter\.city/,
    "Recenter button should show suggestedCenter.city"
  );

  // Verify honest empty-state messaging
  assert.match(
    adopterSource,
    /No pets found within.*searchDistance.*miles/,
    "Should show honest empty-state message about radius"
  );

  // Verify it mentions current inventory exists elsewhere
  assert.match(
    adopterSource,
    /uniqueCurrentPets.*current pets in other locations/,
    "Should mention current inventory exists in other locations"
  );
});

test("App.jsx wires recenter handler to setCoordinates", async () => {
  const { readFile } = await import("node:fs/promises");
  const appSource = await readFile("src/App.jsx", "utf-8");

  // Verify handleRecenter function exists
  assert.match(
    appSource,
    /const handleRecenter.*=.*useCallback\(/,
    "Should define handleRecenter with useCallback"
  );

  // Verify it accepts suggestedCenter parameter
  assert.match(
    appSource,
    /handleRecenter.*=.*\(suggestedCenter\)/,
    "handleRecenter should accept suggestedCenter parameter"
  );

  // Verify it calls setCoordinates with suggested lat/lng
  assert.match(
    appSource,
    /setCoordinates\(\{[^}]*latitude:.*suggestedCenter\.latitude[^}]*longitude:.*suggestedCenter\.longitude/,
    "handleRecenter should call setCoordinates with suggested coordinates"
  );

  // Verify it resets to page 1
  assert.match(
    appSource,
    /setLivePage\(1\)/,
    "handleRecenter should reset to page 1"
  );

  // Verify handleRecenter is passed to AdopterExperience
  assert.match(
    appSource,
    /journeyProps.*=.*\{[\s\S]*onRecenter:.*handleRecenter[\s\S]*\}/,
    "Should pass handleRecenter as onRecenter in journeyProps"
  );
});

test("Empty state offers recenter to inventory center, not fake local pets", async () => {
  const { readFile } = await import("node:fs/promises");
  const adopterSource = await readFile("src/AdopterExperience.jsx", "utf-8");

  // Verify it does NOT show pets when ranked.length is 0
  assert.match(
    adopterSource,
    /\{ranked\.length \?.*:.*journey-empty/,
    "Should show empty state when ranked.length is 0, not fake pets"
  );

  // Verify recenter button only appears when suggestedCenter exists
  assert.match(
    adopterSource,
    /\{suggestedCenter \?.*<button[^>]*onClick.*onRecenter/,
    "Recenter button should only appear when suggestedCenter exists"
  );

  // Verify no pets are fabricated or shown without coordinates
  assert.doesNotMatch(
    adopterSource,
    /fake.*pet|fabricate.*location|placeholder.*pet/i,
    "Should not fabricate or fake any pet locations"
  );
});
