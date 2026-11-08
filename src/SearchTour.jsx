"use client";

import { useEffect, useRef, useState } from "react";

const VERSION = "pawline:welcome-location-tour:v1";

// This public, anonymous search is available without an account. Store no user data.
export default function SearchTour({ targetId }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const replay = useRef(null);
  const card = useRef(null);
  const returnFocus = useRef(null);
  useEffect(() => {
    if (!document.getElementById(targetId)) return;
    setReady(true);
    try { setOpen(window.localStorage.getItem(VERSION) !== "seen"); }
    catch { setOpen(true); }
  }, [targetId]);
  const close = (focusTarget = false) => {
    setOpen(false);
    try { window.localStorage.setItem(VERSION, "seen"); } catch { /* The feature stays usable. */ }
    if (focusTarget) document.getElementById(targetId)?.focus();
    else if (card.current?.contains(document.activeElement)) (returnFocus.current?.isConnected ? returnFocus.current : replay.current)?.focus();
  };
  if (!ready) return null;
  return <div className="search-tour" onKeyDown={event => {
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <button type="button" ref={replay} className="onboarding-back" data-tour-action="replay" aria-expanded={open} onClick={() => {
      if (!document.getElementById(targetId) || document.querySelector('[aria-modal="true"]')) return;
      returnFocus.current = document.activeElement;
      setOpen(true);
    }}>Location search guide</button>
    {open ? <section ref={card} className="search-tour-card" aria-label="Location search guide">
      <p className="eyebrow" role="status">Location search · Step 1 of 1</p>
      <h2>Start with a place</h2>
      <p>Use Find pets near above to enter a city, address, or ZIP code. Choose Search to open nearby pets on the map. You do not need an account or location permission.</p>
      <div className="search-tour-actions">
        <button type="button" data-tour-action="done" onClick={() => close(true)}>Got it — enter a place</button>
        <button type="button" data-tour-action="skip" onClick={() => close()}>Skip</button>
        <button type="button" aria-label="Close location search guide" onClick={() => close()}>Close</button>
      </div>
    </section> : null}
  </div>;
}
