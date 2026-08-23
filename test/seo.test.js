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

test("the methodology page is a crawlable, canonical explanation of listing provenance", async () => {
  const page = await read("app/how-pawline-works/page.jsx");
  assert.match(page, /title: "How Pawline Finds and Verifies Adoptable Pets"/);
  assert.match(page, /alternates: \{ canonical: "\/how-pawline-works" \}/);
  assert.match(page, /Provider-backed pet listings/);
  assert.match(page, /Approximate web leads/);
  assert.match(page, /type="application\/ld\+json"/);
  assert.match(page, /"@type": "WebPage"/);
});

test("adoption guides are canonical, connected, and explain honest matching", async () => {
  const [app, hub, discoveryGuide, matchingGuide] = await Promise.all([
    read("src/App.jsx"),
    read("app/guides/page.jsx"),
    read("app/guides/find-adoptable-pets-near-you/page.jsx"),
    read("app/guides/find-a-pet-that-fits-your-home-and-routine/page.jsx"),
  ]);
  assert.match(app, /href="\/guides"/);
  assert.match(app, /Share your home, routine, household, and pet experience/);
  assert.match(hub, /export const metadata = \{\s+title: "Pet Adoption Guides",/);
  assert.match(hub, /"@type": "CollectionPage"/);
  assert.match(hub, /find-adoptable-pets-near-you/);
  assert.match(hub, /find-a-pet-that-fits-your-home-and-routine/);
  assert.match(discoveryGuide, /export const metadata = \{\s+title: "How to Find Adoptable Pets Near You",/);
  assert.match(discoveryGuide, /alternates: \{ canonical: "\/guides\/find-adoptable-pets-near-you" \}/);
  assert.match(discoveryGuide, /Provider-backed pet listings/);
  assert.match(discoveryGuide, /"@type": "BreadcrumbList"/);
  assert.match(matchingGuide, /export const metadata = \{\s+title: "Find a Pet That Fits Your Home & Routine",/);
  assert.match(matchingGuide, /home, routine, household, and pet experience/);
  assert.match(matchingGuide, /not a guarantee/);
  assert.match(matchingGuide, /"@type": "BreadcrumbList"/);
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
  assert.match(sitemap, /<loc>https:\/\/www\.pawlineadopt\.com\/how-pawline-works<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.pawlineadopt\.com\/guides<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.pawlineadopt\.com\/guides\/find-adoptable-pets-near-you<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.pawlineadopt\.com\/guides\/find-a-pet-that-fits-your-home-and-routine<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.pawlineadopt\.com\/privacy<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.pawlineadopt\.com\/terms<\/loc>/);
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
