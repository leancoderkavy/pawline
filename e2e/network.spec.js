import { test, expect } from "@playwright/test";
import { ids } from "./chat-fixture.mjs";

test("shelter CSV preview and review submission work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?import&user=shelter");
  await page.getByText("Import shelter pets from CSV", { exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles({
      name: "pets.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "external_id,name,species\nqa-rabbit,Juniper,Rabbit\n",
      ),
    });
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(page.getByText("1 valid pets · 0 errors")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import for review" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Import for review" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Import saved for review",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("participants propose and confirm a meeting through the conversation", async ({
  browser,
  request,
}) => {
  const opened = await request.post("/api/direct-conversations", {
    headers: { Authorization: "Bearer fixture:adopter" },
    data: { listingId: ids.pet },
  });
  expect(opened.ok()).toBe(true);
  const context = await browser.newContext();
  const adopter = await context.newPage(),
    shelter = await context.newPage();
  const base = `http://127.0.0.1:${process.env.PAWLINE_CHAT_PORT || 4317}`;
  try {
    await adopter.goto(`${base}/?user=adopter`);
    await adopter.getByRole("button", { name: /Miso.*Willow/ }).click();
    await adopter
      .getByText("Arrange a meet-and-greet", { exact: true })
      .click();
    const time = new Date(Date.now() + 86400000);
    const local = new Date(time.getTime() - time.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    await adopter.getByLabel(/Propose a time/).fill(local);
    await adopter.getByRole("button", { name: "Propose meeting" }).click();
    await expect(adopter.locator(".meeting-planner")).toContainText("proposed");
    await shelter.goto(`${base}/?user=shelter`);
    await shelter.getByRole("button", { name: /Miso.*Alex/ }).click();
    await shelter.locator(".meeting-planner summary").click();
    await shelter.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(shelter.locator(".meeting-planner")).toContainText(
      "confirmed",
    );
  } finally {
    await context.close();
  }
});
