import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const networkStyles = readFileSync(new URL("../src/networkTools.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("rail tab controls share one pill style", () => {
  assert.match(styles, /\.map-rail \.map-pet-types button\.is-active \{ background:var\(--ink\)/);
  assert.match(styles, /\.map-message-tabs button\[aria-pressed=true\] \{ background:var\(--ink\)/);
  assert.match(networkStyles, /\.network-tools \.network-tabs button\[aria-pressed="true"\] \{\s+background: var\(--ink\)/);
  assert.match(styles, /\.map-rail \.discovery-controls button\.selected \{[^}]*background:var\(--ink\)/);
});

test("message tabs keep rail-toggle clearance", () => {
  assert.match(styles, /\.map-message-tabs \{ padding-right:72px; \}/);
  assert.match(styles, /\.map-message-tabs \{ padding:66px 12px 12px; \}/);
});

test("compact rail pet cards apply only on desktop widths", () => {
  const desktop = styles.slice(styles.lastIndexOf("@media (min-width:821px) {"));
  assert.match(desktop, /\.map-journey-panel \.journey-pet-card \{ display:grid;grid-template-columns:112px minmax\(0,1fr\); \}/);
});

test("events panel has a heading in every state", () => {
  assert.equal(app.match(/<header className="rail-panel-heading"><p className="eyebrow">Pet events<\/p><h1>Events near you<\/h1>/g)?.length, 2);
});
