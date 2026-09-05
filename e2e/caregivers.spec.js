import { test, expect } from "@playwright/test";

test("local foster registration, photo submission without AI, and availability at mobile sizes", async ({ page }) => {
  const errors = [];
  const extractions = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.url().includes("extract-submission")) extractions.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?caregiver=1&user=stranger");
  await expect(page.getByRole("heading", { name: "Register your caregiver profile" })).toBeVisible();
  await page.getByLabel("I am registering as").selectOption("shelter");
  await expect(page.getByLabel("Shelter or rescue name")).toBeVisible();
  await page.getByLabel("I am registering as").selectOption("rescue");
  await page.getByLabel("I am registering as").selectOption("foster");
  await page.getByLabel("Public caregiver name").fill("Local Foster QA");
  await page.getByLabel("City", { exact: true }).fill("Pasadena");
  await page.getByLabel("State / region", { exact: true }).fill("California");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Register profile", exact: true }).click();
  await expect(page.getByLabel("Your profile")).toContainText("Local Foster QA");
  await expect(page.getByText(/Profile not independently verified/)).toBeVisible();
  await page.getByRole("button", { name: "List a pet", exact: true }).click();
  await expect(page.getByLabel("Registered caregiver profile")).toHaveValue("Local Foster QA");
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Pasadena");
  await page.getByLabel("Pet name", { exact: true }).fill("Poppy Browser QA");
  await page.getByLabel("Breed", { exact: true }).fill("Mixed breed");
  await page.getByLabel("Postal code", { exact: true }).fill("91101");
  await page.getByLabel("Contact email", { exact: true }).fill("stranger@example.test");
  await page.locator('input[type="file"]').setInputFiles({ name: "poppy.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=", "base64") });
  for (const checkbox of await page.getByRole("dialog").getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Submitted for review" })).toBeVisible();
  expect(extractions).toEqual([]);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your pets" })).toContainText("Poppy Browser QA");
  await expect(page.getByRole("region", { name: "Your pets" })).toContainText("Awaiting review");
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByLabel("Your profile")).toContainText("Local Foster QA");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "Mark adopted", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your pets" })).toContainText("adopted");
  await page.getByRole("button", { name: "Answer questions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
