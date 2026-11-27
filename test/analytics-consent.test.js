import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  CONSENT_KEY, LOADER_ID, browserOptedOut, initialConsentState, loadAnalytics, readConsent, saveConsent, withdrawAnalytics,
} from "../src/analyticsConsent.js";
import { posthogScript } from "../src/posthogSetup.js";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const dom = () => new JSDOM("<!doctype html><html><body></body></html>", { url: "https://www.pawlineadopt.com/" }).window;
const script = posthogScript("phc_test");

test("no choice yet: banner pending, nothing loaded, no ph_ cookie", () => {
  const win = dom();
  assert.equal(initialConsentState({ script, nav: win.navigator, storage: win.localStorage, win }), "pending");
  assert.equal(win.document.getElementById(LOADER_ID), null);
  assert.equal(win.posthog, undefined);
  assert.doesNotMatch(win.document.cookie, /ph_/);
});

test("no analytics key configured: no banner and nothing to load", () => {
  const win = dom();
  assert.equal(initialConsentState({ script: "", nav: win.navigator, storage: win.localStorage, win }), "hidden");
  assert.equal(loadAnalytics(win.document, ""), false);
});

test("Global Privacy Control or Do Not Track wins over a saved grant", () => {
  const win = dom();
  saveConsent(win.localStorage, "granted");
  assert.equal(initialConsentState({ script, nav: { globalPrivacyControl: true }, storage: win.localStorage, win }), "auto-off");
  assert.equal(initialConsentState({ script, nav: { doNotTrack: "1" }, storage: win.localStorage, win }), "auto-off");
  assert.equal(browserOptedOut({}, {}), false);
});

test("Allow analytics appends the loader once and the choice persists", () => {
  const win = dom();
  saveConsent(win.localStorage, "granted");
  assert.equal(readConsent(win.localStorage), "granted");
  assert.equal(initialConsentState({ script, nav: {}, storage: win.localStorage, win }), "granted");
  assert.equal(loadAnalytics(win.document, script), true);
  assert.equal(loadAnalytics(win.document, script), false);
  assert.equal(win.document.querySelectorAll(`#${LOADER_ID}`).length, 1);
});

test("No thanks persists and loads nothing", () => {
  const win = dom();
  saveConsent(win.localStorage, "denied");
  assert.equal(win.localStorage.getItem(CONSENT_KEY), "denied");
  assert.equal(initialConsentState({ script, nav: {}, storage: win.localStorage, win }), "denied");
  assert.equal(win.document.getElementById(LOADER_ID), null);
});

test("withdrawing consent opts out and clears PostHog cookies and storage", () => {
  const win = dom();
  const calls = [];
  win.posthog = { opt_out_capturing: () => calls.push("opt_out"), reset: () => calls.push("reset") };
  win.document.cookie = "ph_phc_test_posthog=abc; path=/";
  win.document.cookie = "__client_uat=1; path=/";
  win.localStorage.setItem("ph_phc_test_posthog", "x");
  win.localStorage.setItem("pawline-saved", "keep");
  withdrawAnalytics(win, win.document, win.localStorage);
  assert.deepEqual(calls, ["opt_out", "reset"]);
  assert.doesNotMatch(win.document.cookie, /ph_/);
  assert.match(win.document.cookie, /__client_uat/);
  assert.equal(win.localStorage.getItem("ph_phc_test_posthog"), null);
  assert.equal(win.localStorage.getItem("pawline-saved"), "keep");
});

test("layout never injects PostHog directly; it goes through the consent gate", async () => {
  const layout = await read("app/layout.jsx");
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML=\{\{ __html: analytics \}\}/);
  assert.match(layout, /<AnalyticsConsent script=\{analytics\} \/>/);
  assert.match(layout, /<PrivacyChoicesLink \/>/);
  assert.match(await read("src/MapNavigation.jsx"), /<PrivacyChoicesLink \/>/);
});

test("Terms and Privacy name the operator, contacts, and California/analytics disclosures", async () => {
  const [terms, privacy, entity] = await Promise.all([read("app/terms/page.jsx"), read("app/privacy/page.jsx"), read("src/legalEntity.js")]);
  assert.match(entity, /LEGAL_ENTITY = "Tradewink LLC"/);
  assert.match(entity, /PRIVACY_EMAIL = "privacy@pawlineadopt.com"/);
  assert.match(entity, /LEGAL_EMAIL = "legal@pawlineadopt.com"/);
  assert.match(entity, /Ste 107 #1334, Arcadia, CA 91006/);
  for (const page of [terms, privacy]) {
    assert.match(page, /\{LEGAL_ENTITY\}, \{LEGAL_ENTITY_DESCRIPTION\}/);
    assert.match(page, /\{LEGAL_ADDRESS\}/);
    assert.doesNotMatch(page, /\{\{|\[NEW\]|\[CHANGED\]|Reviewer:|Engineering to confirm/);
  }
  assert.match(terms, /California law/);
  assert.match(terms, /\{LEGAL_EMAIL\}/);
  for (const phrase of ["California privacy rights", "Global Privacy Control", "PostHog", "Mapbox", 'id="analytics"', "{PRIVACY_EMAIL}"]) {
    assert.ok(privacy.includes(phrase), `privacy page is missing ${phrase}`);
  }
});
