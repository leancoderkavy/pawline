import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("privacy request uses its own canonical URL", async () => {
  const page = await read("app/privacy/request/page.jsx");
  assert.ok(page.includes('alternates: { canonical: "/privacy/request" }'));
});

test("sign-in callback cannot be indexed", async () => {
  const layout = await read("app/sso-callback/layout.jsx");
  assert.ok(layout.includes("robots: { index: false, follow: false }"));
});
