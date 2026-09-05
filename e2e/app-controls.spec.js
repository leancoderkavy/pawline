import { test, expect } from "@playwright/test";

const pets = [
  { id: "qa-cat", name: "QA Miso", species: "Cat", breed: "Domestic Shorthair", latitude: 34.1478, longitude: -118.1445, hours: "10am–4pm", city: "Pasadena", shelter: "QA Shelter", image: "/pet-photo-placeholder.svg", sourceUrl: "https://example.org/miso", description: "Test listing", age: "Adult", size: "Small" },
  { id: "qa-dog", name: "QA Willow", species: "Dog", breed: "Mixed", latitude: 34.15, longitude: -118.15, city: "Pasadena", shelter: "QA Shelter", image: "/pet-photo-placeholder.svg", sourceUrl: "https://example.org/willow", description: "Test listing", age: "Adult", size: "Medium" },
];
async function fixture(page, { map = false } = {}) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = {};
    if (path === "/api/pets") body = { mode: "live", provider: "QA fixture", pets: pets.filter(pet => !url.searchParams.get("species") || pet.species === url.searchParams.get("species")) };
    else if (path === "/api/health") body = { mapboxConfigured: map };
    else if (path === "/api/events") body = { mode: "live", events: [] };
    else if (path === "/api/discoveries") body = { discoveries: [] };
    else if (path === "/api/nearby-shelters") body = { shelters: [] };
    else if (path === "/api/geocode") body = { results: [{ name: "Pasadena, California, USA", latitude: 34.1478, longitude: -118.1445 }] };
    else return route.fulfill({ status: 503, json: { error: "QA provider unavailable" } });
    return route.fulfill({ json: body });
  });
}
async function open(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What brings you here?" })).toBeVisible();
  await page.getByRole("button", { name: "Just browsing? Explore pets" }).click();
  await expect(page.getByRole("heading", { name: "Pets near you", exact: true })).toBeVisible();
}
async function more(page, name) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function quiz(page, species = "Cat") {
  await more(page, "Match quiz");
  await page.getByRole("button", { name: "Start the match quiz" }).click();
  for (const name of ["House", "Balanced", "No", "None", "Sometimes", "Some experience", species]) {
    await page.locator(".quiz-options").getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Your top matches nearby" })).toBeVisible();
}

for (const width of [320, 390, 768, 1440]) {
  test(`map controls, persistence and navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await fixture(page); await open(page);
    await expect(page.locator(".map-result-open")).toHaveCount(2);
    for (const name of ["Cats", "Dogs", "All"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.locator(".map-result-open")).toHaveCount(name === "All" ? 2 : 1);
    }
    await page.locator(".more-filters summary").click();
    for (const radius of ["25", "50", "100", "150"]) {
      await page.getByLabel("Map search radius").selectOption(radius);
      await expect(page.locator(".explore-intro")).toContainText(`within ${radius} miles`);
    }
    await page.getByLabel("Filter by supplied shelter hours").selectOption("known");
    await expect(page.locator(".map-result-open")).toHaveCount(1);
    for (const name of ["Show events", "Show pet density"]) {
      const button = page.getByRole("button", { name, exact: true });
      const before = await button.getAttribute("aria-pressed"); await button.click();
      await expect(button).not.toHaveAttribute("aria-pressed", before);
    }
    await page.getByLabel("Reset all filters").click();
    await expect(page.locator(".map-result-open")).toHaveCount(2);
    await page.locator(".more-filters summary").click();
    await page.getByLabel("Add QA Miso to favorites").click();
    await page.reload();
    await page.getByRole("button", { name: "Just browsing? Explore pets" }).click();
    await expect(page.getByLabel("Remove QA Miso from favorites")).toHaveAttribute("aria-pressed", "true");
    await page.locator(".favorites-filter").click();
    await expect(page.locator(".map-result-open")).toHaveCount(1);
    await page.locator(".map-result-open").click();
    await expect(page.locator(".dialog")).toBeVisible();
    await expect(page.locator(".dialog").getByRole("link", { name: "View adoption listing" })).toHaveAttribute("href", "https://example.org/miso");
    await page.keyboard.press("Escape");
    await expect(page.locator(".dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Show discovery tools", exact: true }).click();
    await page.getByLabel("Refresh listings").click();
    await expect(page.getByLabel("Refresh listings")).toBeEnabled();
    for (const name of ["Applications", "Messages", "Find pets"]) {
      await page.getByRole("navigation", { name: "Pawline navigation" }).getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Pawline navigation" }).getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
    }
    await more(page, "Adoption guides");
    for (const title of ["How to find adoptable dogs and cats near you", "How to find a pet that fits your home and routine", "How Pawline verifies adoption listings"]) {
      await page.getByRole("link", { name: new RegExp(title) }).click();
      await page.getByRole("link", { name: "All adoption guides" }).click();
    }
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "More", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Find pets", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`controls-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(errors).toEqual([]);
  });
}

test("quiz species can be changed back to dogs or all pets on the map", async ({ page }) => {
  await fixture(page); await open(page); await quiz(page);
  await expect(page.locator(".match-result")).toHaveCount(1);
  await page.getByRole("button", { name: "Find pets", exact: true }).click();
  await page.getByRole("button", { name: "Dogs", exact: true }).click();
  await expect(page.locator(".map-result-open")).toContainText(["QA Willow"]);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".map-result-open")).toHaveCount(2);
});

test("malformed saved favorites recover without crashing the page", async ({ page }) => {
  await fixture(page);
  await page.addInitScript(() => localStorage.setItem("pawline-saved", '{"invalid":true}'));
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await open(page);
  await expect(page.locator(".map-result-open")).toHaveCount(2);
  await expect(page.locator(".app [role=alert]")).toContainText("Favorites");
  expect(errors).toEqual([]);
});

test("location input, autocomplete keyboard controls and map failure recovery", async ({ page }) => {
  await fixture(page, { map: true }); await open(page);
  await page.getByLabel("Dismiss location prompt").click();
  const input = page.getByRole("combobox", { name: "Find pets near" });
  await input.fill(""); await page.getByLabel("Search this location").click();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("Pasadena"); await expect(page.locator(".global-location-suggestions").getByRole("option")).toBeVisible();
  await input.press("ArrowDown"); await input.press("Enter");
  await expect(input).toHaveValue("Pasadena, California, USA");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Hide discovery tools", exact: true }).click();
  await page.getByRole("button", { name: "Explore the interactive map" }).click();
  await page.getByRole("button", { name: "Back to map preview" }).click();
  await expect(page.getByRole("button", { name: "Explore the interactive map" })).toBeVisible();
});

test("application fields and optional AI enforce guest and consent boundaries", async ({ page }) => {
  await fixture(page); await open(page);
  await page.locator(".map-result-open").first().click();
  await page.getByRole("button", { name: "Start application", exact: true }).click();
  for (const label of ["Who is in your household?", "Describe your care plan", "What does a typical weekday look like?", "Anything you want the shelter to know? (optional)"]) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(`QA answer for ${label}`);
    await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(`QA answer for ${label}`);
  }
  await expect(page.getByRole("button", { name: "Save private draft" })).toBeDisabled();
  await page.getByLabel(/I consent to Pawline holding/).check();
  await page.getByRole("button", { name: "Save private draft" }).click();
  await expect(page.locator(".app [role=alert]")).toContainText("Sign in");
  await expect(page.getByRole("button", { name: "Help me improve this answer" })).toBeDisabled();
  await page.getByLabel(/I agree to send only this answer/).check();
  await page.getByRole("button", { name: "Help me improve this answer" }).click();
  await expect(page.locator(".coach-manual")).toContainText("Sign in");
  await page.reload();
  await expect(page.getByRole("heading", { name: "No applications yet." })).toBeVisible();
});

test("profile fields, household controls and guest privacy survive navigation correctly", async ({ page }) => {
  await fixture(page); await open(page); await more(page, "My profile");
  const profile = page.locator(".profile-page");
  for (const select of await profile.locator("select").all()) {
    const options = await select.locator("option").evaluateAll(items => items.map(item => item.value));
    for (const value of options) { await select.selectOption(value); await expect(select).toHaveValue(value); }
  }
  await page.getByLabel("Accessibility or visit needs (optional)").fill("QA step-free access");
  await page.getByLabel("Household name (optional)").fill("QA household");
  await page.getByPlaceholder("Add a household member’s first name").fill("Alex");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Remove Alex")).toBeVisible();
  await page.getByLabel("Household member first name").fill("alex");
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  await page.getByLabel("Household member first name").press("Enter");
  await expect(page.getByLabel("Remove Alex")).toHaveCount(1);
  await page.getByLabel("Remove Alex").click();
  await expect(page.getByLabel("Remove Alex")).toHaveCount(0);
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator(".app [role=alert]")).toContainText("Sign in");
  await page.reload();
  await expect(page.getByLabel("Household name (optional)")).toHaveValue("");
  await expect(page.getByLabel("Accessibility or visit needs (optional)")).toHaveValue("");
  await expect(page.getByLabel("Preferred distance")).toHaveValue("100");
});

test("quiz back, restart, AI consent and unavailable provider controls", async ({ page }) => {
  await fixture(page); await open(page); await more(page, "Match quiz");
  await page.getByRole("button", { name: "Start the match quiz" }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start the match quiz" })).toBeVisible();
  await page.getByRole("button", { name: "Find pets", exact: true }).click();
  await quiz(page);
  await expect(page.getByRole("button", { name: "Analyze with AI" })).toBeDisabled();
  await page.getByLabel(/Send my quiz answers/).check();
  await page.getByRole("button", { name: "Analyze with AI" }).click();
  await expect(page.locator(".ai-controls [role=alert]")).toContainText("QA provider unavailable");
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.locator(".quiz-progress")).toHaveAttribute("aria-label", "Question 1 of 7");
  await page.getByRole("combobox", { name: "Find pets near" }).fill("");
  await page.getByLabel("Search this location").click();
  await expect(page.locator("#global-location-status")).toContainText("Enter a city");
});

test("all guest navigation destinations, submit gate, drawer and footer links", async ({ page }) => {
  await fixture(page); await open(page);
  for (const [name, text] of [["Adoption plan", "Profile"], ["Adoption events", "events"], ["Community", "Community needs Clerk"], ["Shelters & fosters", "unavailable"]]) {
    await more(page, name);
    await expect(page.locator(".rail-content")).toContainText(text, { ignoreCase: true });
  }
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.locator("#map-more-menu").getByRole("button", { name: "List a pet" }).click();
  await expect(page.locator(".dialog")).toContainText("Registration needs an account");
  await page.getByLabel("Close dialog").click();
  await page.getByRole("button", { name: "Find pets", exact: true }).click();
  await page.getByRole("button", { name: "Hide discovery tools", exact: true }).click();
  await page.getByRole("button", { name: "Show discovery tools", exact: true }).click();
  for (const [name, href] of [["Privacy", "/privacy"], ["Terms", "/terms"]]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
});

test("radius changes results, event and lead details, shelter links and visit checklist", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/pets?*", route => route.fulfill({ json: { mode: "live", pets: [...pets, { ...pets[1], id: "far", name: "QA Faraway", latitude: 35 }] } }));
  await page.route("**/api/events", route => route.fulfill({ json: { mode: "live", events: [{ id: "event", title: "QA adoption day", starts_at: "2099-10-01T10:00:00Z", latitude: 34.15, longitude: -118.15, source_url: "https://example.org/event" }] } }));
  await page.route("**/api/discoveries", route => route.fulfill({ json: { discoveries: [{ id: "lead", title: "QA web lead", latitude: 34.15, longitude: -118.15, source_url: "https://example.org/lead", source_domain: "example.org" }] } }));
  await page.route("**/api/nearby-shelters?*", route => route.fulfill({ json: { shelters: [{ id: "shelter", name: "QA shelter location", latitude: 34.15, longitude: -118.15, website: "https://example.org/shelter" }] } }));
  await open(page);
  await expect(page.getByRole("button", { name: "Open QA Faraway details" })).toBeVisible();
  await page.locator(".more-filters summary").click();
  await page.getByLabel("Map search radius").selectOption("25");
  await expect(page.getByRole("button", { name: "Open QA Faraway details" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show events", exact: true }).click();
  await expect(page.getByRole("button", { name: /Open QA adoption day/ })).toHaveCount(0);
  await page.getByLabel("Reset all filters").click();
  await page.locator(".more-filters summary").click();
  for (const [name, link, url] of [[/Open QA adoption day/, "Official details", "event"], ["Open QA web lead details", "Verify at source", "lead"], [/QA shelter location/, "Visit shelter site", "shelter"]]) {
    await page.getByRole("button", { name }).click();
    await expect(page.locator(".dialog").getByRole("link", { name: link })).toHaveAttribute("href", `https://example.org/${url}`);
    await page.getByLabel("Close dialog").click();
  }
  await page.getByLabel("Add QA Miso to favorites").click();
  const planner = page.locator(".visit-planner");
  for (const label of await planner.locator("label").all()) {
    const checkbox = label.getByRole("checkbox");
    await label.click(); await expect(checkbox).toBeChecked();
    await checkbox.focus(); await page.keyboard.press("Space"); await expect(checkbox).not.toBeChecked();
  }
  await expect(planner.getByRole("link", { name: "Open adoption trail" })).toHaveAttribute("href", /destination=34.1478,-118.1445/);
});

test("refresh failure retains results and recovery clears warning", async ({ page }) => {
  await fixture(page); await open(page);
  await expect(page.locator(".map-result-open")).toHaveCount(2);
  await page.route("**/api/pets?*", route => route.fulfill({ status: 503, json: { mode: "error" } }));
  await page.getByLabel("Refresh listings").click();
  await expect(page.locator(".feed-refresh")).toContainText("Previously loaded listings may be out of date");
  await expect(page.locator(".map-result-open")).toHaveCount(2);
  await page.unroute("**/api/pets?*");
  await page.getByLabel("Refresh listings").click();
  await expect(page.locator(".feed-refresh")).toContainText("Checked");
  await expect(page.locator(".feed-refresh")).not.toContainText("out of date");
});
