import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production CSP permits the configured Clerk custom domain", async () => {
  const config = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");

  for (const directive of ["script-src", "connect-src", "frame-src", "form-action"]) {
    const line = config.split("\n").find((entry) => entry.includes(`"${directive} `));
    assert.match(line || "", /https:\/\/clerk\.pawlineadopt\.com/);
  }
});

test("production exposes the verified Clerk frontend API proxy route", async () => {
  const page = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const route = await readFile(
    new URL("../app/%255F%255Fclerk/[[...path]]/route.js", import.meta.url),
    "utf8",
  );

  assert.match(page, /proxyUrl="https:\/\/pawlineadopt\.com\/__clerk"/);
  assert.match(route, /clerkFrontendApiProxy/);
  assert.match(route, /proxyPath: "\/__clerk"/);
  assert.match(route, /export const GET = proxy/);
  assert.match(route, /export const POST = proxy/);
});
