import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage publishes canonical search and social metadata", async () => {
  const layout = await read("app/layout.jsx");
  assert.match(layout, /alternates: \{ canonical: "\/"/);
  assert.match(layout, /robots: \{ index: true, follow: true/);
  assert.match(layout, /Find Adoptable Dogs & Cats Near You \| Pawline/);
  assert.match(layout, /home, routine, household, and pet experience/);
  assert.match(layout, /card: "summary_large_image"/);
  assert.match(layout, /locale: "en_US"/);
  assert.match(layout, /social-card\.png/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /llms\.txt/);
  assert.match(layout, /type="application\/ld\+json"/);
  assert.match(layout, /"@type": "WebApplication"/);
});

test("former content pages redirect into the map while their guide content remains available", async () => {
  const targets = [
    ["how-pawline-works", "#how-pawline-works", "Methodology", "Approximate web leads"],
    ["guides", "#guides", "Guides", "#guides/nearby"],
    ["guides/find-adoptable-pets-near-you", "#guides/nearby", "NearbyGuide", "Provider-backed pet listings"],
    ["guides/find-a-pet-that-fits-your-home-and-routine", "#guides/matching", "MatchingGuide", "not a guarantee"],
  ];
  for (const [route, hash, component, content] of targets) {
    const page = await read(`app/${route}/page.jsx`);
    assert.ok(page.includes(`redirect("/${hash}")`));
    assert.ok((await read(`src/resources/${component}.jsx`)).includes(content));
  }
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
  assert.doesNotMatch(sitemap, /\/guides|\/how-pawline-works/);
  assert.match(llms, /Web-discovered leads are labeled as approximate leads/);
  assert.match(llms, /home, routine, household, and pet experience/);
  assert.match(full, /Canonical URL: https:\/\/www\.pawlineadopt\.com\//);
});

test("privacy and terms are canonical, crawlable, and linked site-wide", async () => {
  const [layout, privacy, terms] = await Promise.all([
    read("app/layout.jsx"),
    read("app/privacy/page.jsx"),
    read("app/terms/page.jsx"),
  ]);
  assert.match(layout, /href="\/privacy"/);
  assert.match(layout, /href="\/terms"/);
  assert.match(privacy, /alternates: \{ canonical: "\/privacy" \}/);
  assert.match(privacy, /Information Pawline handles/);
  assert.match(terms, /alternates: \{ canonical: "\/terms" \}/);
  assert.match(terms, /Verify information with the source/);
});

test("the apex host redirects to the canonical www host", async () => {
  const proxy = await read("proxy.js");
  assert.match(proxy, /requestedHost === "pawlineadopt\.com"/);
  assert.match(proxy, /new URL\([^\n]+"https:\/\/www\.pawlineadopt\.com"\)/);
  assert.match(proxy, /NextResponse\.redirect\(canonical, 308\)/);
});

test("AI SEO drafts remain private review artifacts and are not added to the public sitemap", async () => {
  const [schema, sitemap, cron, routes] = await Promise.all([
    read("db/schema.sql"),
    read("public/sitemap.xml"),
    read("api/cron/seo-pipeline.js"),
    read("app/api/[...path]/route.js"),
  ]);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS seo_content_jobs/);
  assert.match(schema, /'needs_review'/);
  assert.doesNotMatch(sitemap, /seo_content|seo-pipeline|\/api\/seo-pipeline/i);
  assert.match(cron, /runNextSeoJob/);
  assert.match(routes, /"seo-pipeline"/);
});
