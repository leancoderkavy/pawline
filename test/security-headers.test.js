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

test("production uses the verified Clerk custom domain without the broken frontend proxy", async () => {
  const page = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const provider = await readFile(new URL("../src/PawlineWithClerk.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(page, /proxyUrl/);
  assert.doesNotMatch(provider, /proxyUrl/);
  assert.match(provider, /<ClerkProvider publishableKey=\{publishableKey\}>/);
});

test("mobile search controls preserve a 44px touch target", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.global-location button \{ width:46px;min-width:46px;min-height:44px;border-radius:0 14px 14px 0; \}/);
  assert.match(styles, /\.global-location \{ min-width:0;height:46px;grid-template-columns:auto minmax\(0,1fr\) 46px/);
  assert.match(styles, /\.saved-action \{ min-width:44px;min-height:44px; \}/);
});
