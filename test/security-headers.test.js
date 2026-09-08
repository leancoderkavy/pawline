import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production CSP permits the configured Clerk custom domain", async () => {
  const { default: config } = await import('../next.config.mjs');
  const policy = (await config.headers())[0].headers.find(header => header.key === 'Content-Security-Policy').value;

  for (const directive of ["script-src", "connect-src", "frame-src", "form-action"]) {
    const line = policy.split('; ').find(entry => entry.startsWith(`${directive} `));
    assert.match(line || "", /https:\/\/clerk\.pawlineadopt\.com/);
  }
});

test('Daily iframe and camera access are restricted to the configured origin', async () => {
  const previous = process.env.DAILY_DOMAIN;
  try {
    for (const [domain, allowed] of [['https://pawline-test.daily.co', true], ['https://evil.test; script-src *', false], ['', false]]) {
      process.env.DAILY_DOMAIN = domain;
      const { default: config } = await import(`../next.config.mjs?domain-test=${encodeURIComponent(domain)}`);
      const headers = (await config.headers())[0].headers;
      const csp = headers.find(header => header.key === 'Content-Security-Policy').value;
      const permissions = headers.find(header => header.key === 'Permissions-Policy').value;
      const frameSources = csp.split('; ').find(directive => directive.startsWith('frame-src ')).split(' ').slice(1);
      assert.deepEqual(frameSources, ['https://clerk.pawlineadopt.com', 'https://*.clerk.accounts.dev', 'https://*.clerk.com', ...(allowed ? ['https://pawline-test.daily.co'] : [])]);
      assert.equal(permissions, allowed ? 'camera=(self "https://pawline-test.daily.co"), microphone=(self "https://pawline-test.daily.co"), geolocation=(self)' : 'camera=(self), microphone=(self), geolocation=(self)');
      assert.ok(!csp.includes('evil.test')); assert.ok(!csp.includes('*.daily.co'));
    }
  } finally { if (previous === undefined) delete process.env.DAILY_DOMAIN; else process.env.DAILY_DOMAIN = previous; }
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
