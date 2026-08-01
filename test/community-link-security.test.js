import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isPrivateIp } from "../api/community-parse-link.js";

test("community link fetching blocks private and IPv4-mapped IPv6 destinations", () => {
  for (const address of [
    "127.0.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:a9fe:a9fe",
    "fc00::1",
    "fe80::1",
  ]) {
    assert.equal(isPrivateIp(address), true, address);
  }
  assert.equal(isPrivateIp("8.8.8.8"), false);
  assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
});

test("re-parsed community leads must return to confirmation", async () => {
  const source = await readFile(new URL("../api/community-parse-link.js", import.meta.url), "utf8");
  assert.match(source, /verification_state='needs_confirmation'/);
});

test("community link fetching pins the vetted address and enforces a streamed byte cap", async () => {
  const source = await readFile(new URL("../api/community-parse-link.js", import.meta.url), "utf8");
  assert.match(source, /lookup: \(_hostname, _options, callback\) => callback\(null, address, family\)/);
  assert.match(source, /received > MAX_HTML/);
  assert.doesNotMatch(source, /await fetch\(url/);
});

test("community link fetching rejects nonstandard TLS ports and masks network errors", async () => {
  const source = await readFile(new URL("../api/community-parse-link.js", import.meta.url), "utf8");
  assert.match(source, /url\.port && url\.port !== "443"/);
  assert.match(source, /could not be fetched safely/);
});
