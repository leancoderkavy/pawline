import { test, expect } from "@playwright/test";

test("shelter CSV preview and review submission work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?import&user=shelter");
  await page.getByText("Import shelter pets from CSV", { exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "pets.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("external_id,name,species\nqa-rabbit,Juniper,Rabbit\n"),
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
