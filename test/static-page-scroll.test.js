import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

// KAV-393: the map shell locks the viewport, but guides, events and other
// static pages must keep normal document scrolling.
const srcDir = new URL("../src/", import.meta.url);
const cssFiles = readdirSync(srcDir).filter(name => name.endsWith(".css"));
const app = readFileSync(new URL("App.jsx", srcDir), "utf8");

function rules(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(stripped))) out.push({ selectors: match[1].trim().split(",").map(s => s.trim()), body: match[2] });
  return out;
}

const isDocumentRoot = selector => /^(html|body|#root)$/.test(selector);
const locksScroll = body => /overflow(-y)?\s*:\s*hidden/.test(body);

test("no unscoped html/body/#root rule disables document scrolling", () => {
  for (const file of cssFiles) {
    const css = readFileSync(new URL(file, srcDir), "utf8");
    for (const rule of rules(css)) {
      if (!locksScroll(rule.body)) continue;
      const offenders = rule.selectors.filter(isDocumentRoot);
      assert.deepEqual(offenders, [], `${file}: "${rule.selectors.join(",")}" locks scrolling on every page`);
    }
  }
});

test("viewport lock is scoped to the mounted map experience", () => {
  const styles = readFileSync(new URL("styles.css", srcDir), "utf8");
  const lock = rules(styles).find(rule => rule.selectors.includes("html:has(.map-app)") && locksScroll(rule.body));
  assert.ok(lock, "expected html:has(.map-app) viewport lock");
  assert.ok(lock.selectors.includes("body:has(.map-app)"));
  assert.match(lock.body, /height:100dvh/);
  assert.match(app, /className="app map-app"/);
});
