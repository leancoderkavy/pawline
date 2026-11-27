// Consent gate for PostHog analytics. Pure functions so they can be unit tested
// without React. Nothing here loads analytics unless the visitor chose "granted"
// and the browser is not sending Global Privacy Control or Do Not Track.
export const CONSENT_KEY = "pawline-analytics-consent"; // "granted" | "denied"
export const LOADER_ID = "pawline-analytics-loader";
export const PRIVACY_CHOICES_EVENT = "pawline:privacy-choices";

export function browserOptedOut(nav = globalThis.navigator, win = globalThis) {
  if (!nav) return false;
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || nav.doNotTrack === "yes"
    || win?.doNotTrack === "1" || nav.msDoNotTrack === "1";
}

export function readConsent(storage) {
  try {
    const value = storage?.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch { return null; }
}

export function saveConsent(storage, value) {
  try { storage?.setItem(CONSENT_KEY, value); } catch { /* storage blocked: choice lasts for this page only */ }
}

// "hidden": no analytics configured; "auto-off": GPC/DNT; "granted"/"denied": saved choice; "pending": ask.
export function initialConsentState({ script, nav, storage, win } = {}) {
  if (!script) return "hidden";
  if (browserOptedOut(nav, win)) return "auto-off";
  return readConsent(storage) || "pending";
}

export function loadAnalytics(doc, script) {
  if (!doc || !script || doc.getElementById(LOADER_ID)) return false;
  const el = doc.createElement("script");
  el.id = LOADER_ID;
  el.text = script; // CSP already allows inline scripts and the PostHog asset host.
  doc.body.appendChild(el);
  return true;
}

export function withdrawAnalytics(win, doc, storage) {
  try { win?.posthog?.opt_out_capturing?.(); win?.posthog?.reset?.(); } catch { /* SDK not loaded */ }
  if (doc) {
    for (const name of doc.cookie.split(";").map(c => c.trim().split("=")[0]).filter(n => n.startsWith("ph_"))) {
      doc.cookie = `${name}=; Max-Age=0; path=/`;
    }
  }
  try {
    for (const key of Object.keys(storage || {})) if (key.startsWith("ph_") || key.startsWith("__ph_")) storage.removeItem(key);
  } catch { /* storage blocked */ }
}
