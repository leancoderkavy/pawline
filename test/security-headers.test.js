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

test("production Clerk loads directly from its configured custom domain", async () => {
  const layout = await readFile(new URL("../app/layout.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const middleware = await readFile(new URL("../proxy.js", import.meta.url), "utf8");

  assert.doesNotMatch(layout, /proxyUrl/);
  assert.doesNotMatch(page, /proxyUrl/);
  assert.doesNotMatch(middleware, /frontendApiProxy/);
  assert.doesNotMatch(middleware, /\/__clerk/);
});
