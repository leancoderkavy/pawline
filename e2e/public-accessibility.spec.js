import { test, expect } from "@playwright/test";
import axe from "axe-core";

for (const path of [
  "/", "/privacy", "/terms", "/privacy/request", "/how-pawline-works", "/guides",
  "/guides/find-a-pet-that-fits-your-home-and-routine",
  "/guides/find-adoptable-pets-near-you",
  "/guides/questions-to-ask-before-adopting",
  "/shelter/register",
]) {
  for (const width of [360, 1280]) test(`public accessibility checks: ${path} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      });
      return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target[0]) }));
    });
    expect(violations).toEqual([]);
  });
}
