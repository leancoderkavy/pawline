import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage publishes canonical search and social metadata", async () => {
  const html = await read("index.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.pawlineadopt\.com\/"/);
  assert.match(html, /<meta name="description" content="[^"]+"/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:locale" content="en_US"/);
  assert.match(html, /<meta property="og:image" content="https:\/\/www\.pawlineadopt\.com\/social-card\.png"/);
  assert.match(html, /<meta property="og:image:width" content="1200"/);
  assert.match(html, /<meta property="og:image:height" content="630"/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(html, /<meta name="twitter:image:alt"/);
  assert.match(html, /<meta name="bingbot"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  assert.match(html, /<link rel="alternate" type="text\/plain" href="https:\/\/www\.pawlineadopt\.com\/llms\.txt"/);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.doesNotThrow(() => {
    const json = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1];
    JSON.parse(json);
  });
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
