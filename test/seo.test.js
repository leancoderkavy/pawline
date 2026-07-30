import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage publishes canonical search and social metadata", async () => {
  const layout = await read("app/layout.jsx");
  assert.match(layout, /alternates: \{ canonical: "\/"/);
  assert.match(layout, /robots: \{ index: true, follow: true/);
  assert.match(layout, /Find Adoptable Dogs & Cats Near You \| Pawline/);
  assert.match(layout, /card: "summary_large_image"/);
  assert.match(layout, /locale: "en_US"/);
  assert.match(layout, /social-card\.png/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /llms\.txt/);
  assert.match(layout, /type="application\/ld\+json"/);
  assert.match(layout, /"@type": "WebApplication"/);
});

test("crawler and AI discovery files use the canonical production domain", async () => {
  const [robots, sitemap, llms, full] = await Promise.all([
    read("public/robots.txt"),
    read("public/sitemap.xml"),
    read("public/llms.txt"),
    read("public/llms-full.txt"),
  ]);
  assert.match(robots, /Sitemap: https:\/\/www\.pawlineadopt\.com\/sitemap\.xml/);
  assert.match(robots, /User-agent: OAI-SearchBot[\s\S]*Allow: \//);
  assert.match(sitemap, /<loc>https:\/\/www\.pawlineadopt\.com\/<\/loc>/);
  assert.match(llms, /Web-discovered leads are labeled as approximate leads/);
  assert.match(full, /Canonical URL: https:\/\/www\.pawlineadopt\.com\//);
});
