import { test, expect } from "@playwright/test";

test("privacy request form is reachable and keyboard operable", async ({ page }) => {
  await page.goto("/privacy");
  await page.getByRole("link", { name: "send a private privacy request" }).click();
  await expect(page).toHaveURL(/\/privacy\/request$/);
  await expect(page.getByRole("heading", { name: "Privacy request" })).toBeVisible();
  await page.getByLabel("Request type").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contact email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Details (optional)")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Send request" })).toBeFocused();
});
