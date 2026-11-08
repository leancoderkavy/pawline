"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Heart, House, Check, PawPrint, MapPin, Search } from "lucide-react";
import { welcomeLocationQuery, WELCOME_QUERY_MAX } from "./welcomeSearch.js";
import "./onboarding.css";
import SearchTour from "./SearchTour";

const paths = [
  { id: "adopter", Icon: Heart, title: "I’m looking for a pet", description: "Browse the map. No account needed." },
  { id: "shelter", Icon: Building2, title: "I’m with a shelter or rescue", description: "Set up your organization and list pets.", heading: "Make room for more happy endings", steps: ["Create an account or sign in", "Add your shelter or rescue profile", "Submit your first pet for review"], action: "Set up my organization" },
  { id: "foster", Icon: House, title: "I’m a foster caregiver", description: "Create a caregiver profile and list a pet.", heading: "Help your foster pet find a home", steps: ["Create an account or sign in", "Add your public caregiver name and city", "Submit a pet for review and answer adoption questions"], action: "Set up my foster profile" },
];

export default function Onboarding({ onNavigate, onSearchLocation }) {
  const [selected, setSelected] = useState(null);
  const [place, setPlace] = useState("");
  const [placeError, setPlaceError] = useState("");
  const placeInput = useRef(null);
  const heading = useRef(null);
  const previous = useRef(null);
  const path = paths.find(item => item.id === selected);
  useEffect(() => {
    if (previous.current !== selected) heading.current?.focus();
    previous.current = selected;
  }, [selected]);
  const continuePath = () => {
    // Both shelter and foster routes go to the "shelter" panel (caregiver registration).
    // The kind parameter differentiates them - CaregiverHub reads it to initialize the form.
    window.location.hash = `shelter?kind=${selected}`;
  };
  const searchPlace = event => {
    event.preventDefault();
    const query = welcomeLocationQuery(place);
    if (!query) {
      setPlaceError("Enter a city, address, or ZIP code.");
      placeInput.current?.focus();
      return;
    }
    setPlaceError("");
    if (onSearchLocation) onSearchLocation(query);
    else onNavigate("explore");
  };
  return <section className="onboarding" aria-labelledby="onboarding-title">
    <p className="eyebrow">Welcome to Pawline</p>
    {!path ? <div className="onboarding-map-art" aria-hidden="true"><span className="onboarding-art-road" /><span className="onboarding-art-park" /><span className="onboarding-art-pin"><PawPrint /></span><span className="onboarding-art-home"><House /></span><span className="onboarding-art-label"><MapPin /> A new friend, closer than you think.</span></div> : null}
    {path ? <button className="onboarding-back" onClick={() => setSelected(null)}><ArrowLeft aria-hidden="true" /> Change my path</button> : null}
    <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{path ? path.heading : "Find adoptable dogs and cats near you"}</h1>
    <p>{path ? "Here’s what comes next." : "Explore nearby pets on a map, compare their needs, or help a pet find a home."}</p>
    {!path ? <form className="onboarding-search" role="search" aria-label="Find pets near a place" onSubmit={searchPlace} noValidate>
      <label htmlFor="onboarding-location">Find pets near</label>
      <div className="onboarding-search-row">
        <MapPin aria-hidden="true" />
        <input id="onboarding-location" ref={placeInput} type="text" inputMode="search" autoComplete="address-level2" placeholder="City, address, or ZIP code" maxLength={WELCOME_QUERY_MAX}
          value={place} onChange={event => { setPlace(event.target.value); if (placeError) setPlaceError(""); }}
          aria-invalid={placeError ? "true" : undefined} aria-describedby={placeError ? "onboarding-location-error" : undefined} />
        <button type="submit" className="button"><Search aria-hidden="true" /><span>Search</span></button>
      </div>
      {placeError ? <p id="onboarding-location-error" className="onboarding-search-error" role="alert">{placeError}</p> : null}
    </form> : null}
    {!path ? <SearchTour targetId="onboarding-location" /> : null}
    {!path ? <div className="onboarding-choices">{paths.map(({ id, Icon, title, description }) => <button className={id === "adopter" ? "onboarding-primary" : ""} key={id} onClick={() => id === "adopter" ? onNavigate("explore") : setSelected(id)}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ArrowRight aria-hidden="true" /></button>)}</div> : <>
      <ol className="onboarding-steps">{path.steps.map(step => <li key={step}><Check aria-hidden="true" /><span>{step}</span></li>)}</ol>
      <p className="onboarding-note">{selected === "foster" ? "Use your city, not your home address. Your pet listing will be reviewed before it appears publicly." : "Already invited to a team? Use your invitation link. Creating a profile does not verify an affiliation or grant access to an existing organization."}</p>
      <button className="button onboarding-continue" onClick={continuePath}>{path.action}<ArrowRight aria-hidden="true" /></button>
    </>}
    <button className="onboarding-back" onClick={() => onNavigate("explore")}>Just browsing? Explore pets</button>
    {!path ? <section className="onboarding-seo" aria-labelledby="onboarding-seo-title">
      <h2 id="onboarding-seo-title">Why use Pawline?</h2>
      <ul>
        <li><strong>Map-first search.</strong> Explore pet listings and shelter locations around a place you can reach.</li>
        <li><strong>Listing source labels.</strong> See how each record was found and confirm availability with the original source. <a href="/how-pawline-works">How listing sources work</a>.</li>
        <li><strong>Fit reasons and unknowns.</strong> Compare disclosed pet needs with your household and routine. <a href="/guides/find-a-pet-that-fits-your-home-and-routine">Read the matching guide</a>.</li>
      </ul>
    </section> : null}
    <p className="onboarding-footnote">Change paths anytime in More → Get started.</p>
  </section>;
}
