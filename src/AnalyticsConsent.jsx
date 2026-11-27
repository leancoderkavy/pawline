"use client";
import { useEffect, useState } from "react";
import {
  PRIVACY_CHOICES_EVENT, initialConsentState, loadAnalytics, saveConsent, withdrawAnalytics,
} from "./analyticsConsent.js";

export function openPrivacyChoices() {
  window.dispatchEvent(new Event(PRIVACY_CHOICES_EVENT));
}

export function PrivacyChoicesLink({ label = "Privacy choices" }) {
  return <button type="button" className="link-button" onClick={openPrivacyChoices}>{label}</button>;
}

// Opt-in analytics banner. PostHog is not loaded, and sets no cookie or storage,
// until the visitor chooses "Allow analytics". GPC / Do Not Track = automatic "No".
export default function AnalyticsConsent({ script }) {
  const [state, setState] = useState("hidden");
  useEffect(() => {
    const initial = initialConsentState({ script, nav: navigator, storage: localStorage, win: window });
    if (initial === "granted") loadAnalytics(document, script);
    setState(initial === "granted" || initial === "denied" ? "hidden" : initial === "auto-off" ? "auto-off-quiet" : initial);
    const reopen = () => setState(current => {
      if (!script) return "hidden";
      return current === "auto-off-quiet" || current === "auto-off" ? "auto-off" : "pending";
    });
    window.addEventListener(PRIVACY_CHOICES_EVENT, reopen);
    return () => window.removeEventListener(PRIVACY_CHOICES_EVENT, reopen);
  }, [script]);

  function choose(value) {
    saveConsent(localStorage, value);
    if (value === "granted") loadAnalytics(document, script);
    else withdrawAnalytics(window, document, localStorage);
    setState("hidden");
  }

  if (state === "auto-off") {
    return <div className="consent-bar" role="region" aria-label="Analytics choice">
      <p>Your browser&apos;s privacy signal (Global Privacy Control or Do Not Track) is on, so Pawline analytics are off. <a href="/privacy#analytics">Details</a></p>
      <div className="consent-actions"><button type="button" className="consent-button" onClick={() => setState("auto-off-quiet")}>OK</button></div>
    </div>;
  }
  if (state !== "pending") return null;
  return <div className="consent-bar" role="region" aria-label="Analytics choice">
    <p>Pawline would like to use analytics (PostHog) to count page views and feature use. No ads, nothing sold. <a href="/privacy#analytics">Details</a></p>
    <div className="consent-actions">
      <button type="button" className="consent-button" onClick={() => choose("denied")}>No thanks</button>
      <button type="button" className="consent-button" onClick={() => choose("granted")}>Allow analytics</button>
    </div>
  </div>;
}
