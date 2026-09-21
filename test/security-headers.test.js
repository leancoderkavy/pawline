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

test("production CSP permits Clerk bot protection hosts required for sign-up", async () => {
  const config = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");
  const scriptSrc = config.split("\n").find((entry) => entry.includes('"script-src '));
  const connectSrc = config.split("\n").find((entry) => entry.includes('"connect-src '));
  const frameSrc = config.split("\n").find((entry) => entry.includes('"frame-src '));

  assert.match(scriptSrc || "", /https:\/\/challenges\.cloudflare\.com/);
  assert.match(scriptSrc || "", /https:\/\/\*\.protect\.clerk\.com/);
  assert.match(connectSrc || "", /https:\/\/\*\.protect\.clerk\.com:\*/);
  assert.match(frameSrc || "", /https:\/\/challenges\.cloudflare\.com/);
  assert.match(frameSrc || "", /https:\/\/\*\.protect\.clerk\.com/);
});

test("production CSP permits PostHog product analytics", async () => {
  const config = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");
  const scriptSrc = config.split("\n").find((entry) => entry.includes('"script-src '));
  const connectSrc = config.split("\n").find((entry) => entry.includes('"connect-src '));

  assert.match(scriptSrc || "", /https:\/\/us-assets\.i\.posthog\.com/);
  assert.match(connectSrc || "", /https:\/\/us\.i\.posthog\.com/);
  assert.match(connectSrc || "", /https:\/\/us-assets\.i\.posthog\.com/);
});

test("production CSP permits Google, Apple, and Facebook OAuth redirects", async () => {
  const config = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");
  const formAction = config.split("\n").find((entry) => entry.includes('"form-action '));

  assert.match(formAction || "", /https:\/\/accounts\.google\.com/);
  assert.match(formAction || "", /https:\/\/appleid\.apple\.com/);
  assert.match(formAction || "", /https:\/\/www\.facebook\.com/);
});

test("production proxies Clerk Frontend API so signup cookies stay first-party", async () => {
  const [page, provider, options, proxy] = await Promise.all([
    readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/PawlineWithClerk.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/clerkBrowserOptions.js", import.meta.url), "utf8"),
    readFile(new URL("../proxy.js", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /proxyUrl/);
  assert.match(provider, /clerkBrowserOptions\(publishableKey\)/);
  assert.match(options, /NEXT_PUBLIC_CLERK_PROXY_URL/);
  assert.match(proxy, /frontendApiProxy:\s*\{\s*enabled:\s*true/);
  assert.match(proxy, /"\/__clerk\/\(\.\*\)"/);
});

test("mobile search controls preserve a 44px touch target", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.global-location button \{ width:46px;min-width:46px;min-height:44px;border-radius:0 14px 14px 0; \}/);
  assert.match(styles, /\.global-location \{ min-width:0;height:46px;grid-template-columns:auto minmax\(0,1fr\) 46px/);
  assert.match(styles, /\.saved-action \{ min-width:44px;min-height:44px; \}/);
});
