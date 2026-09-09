"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Heart, House, Check, PawPrint, MapPin } from "lucide-react";
import "./onboarding.css";

const paths = [
  { id: "adopter", Icon: Heart, title: "I’m looking for a pet", description: "Browse the map. No account needed." },
  { id: "shelter", Icon: Building2, title: "I’m with a shelter or rescue", description: "Set up your organization and list pets.", heading: "Make room for more happy endings", steps: ["Create an account or sign in", "Add your shelter or rescue profile", "Submit your first pet for review"], action: "Set up my organization" },
  { id: "foster", Icon: House, title: "I’m a foster caregiver", description: "Create a caregiver profile and list a pet.", heading: "Help your foster pet find a home", steps: ["Create an account or sign in", "Add your public caregiver name and city", "Submit a pet for review and answer adoption questions"], action: "Set up my foster profile" },
];

export default function Onboarding({ onNavigate }) {
  const [selected, setSelected] = useState(null);
  const heading = useRef(null);
  const previous = useRef(null);
  const path = paths.find(item => item.id === selected);
  useEffect(() => {
    if (previous.current !== selected) heading.current?.focus();
    previous.current = selected;
  }, [selected]);
  const continuePath = () => {
    window.location.hash = `shelter?kind=${selected}`;
  };
  return <section className="onboarding" aria-labelledby="onboarding-title">
    <p className="eyebrow">Welcome to Pawline</p>
    {!path ? <div className="onboarding-map-art" aria-hidden="true"><span className="onboarding-art-road" /><span className="onboarding-art-park" /><span className="onboarding-art-pin"><PawPrint /></span><span className="onboarding-art-home"><House /></span><span className="onboarding-art-label"><MapPin /> A new friend, closer than you think.</span></div> : null}
    {path ? <button className="onboarding-back" onClick={() => setSelected(null)}><ArrowLeft aria-hidden="true" /> Change my path</button> : null}
    <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{path ? path.heading : "What brings you here?"}</h1>
    <p>{path ? "Here’s what comes next." : "Find a pet to love, or help one find a home."}</p>
    {!path ? <div className="onboarding-choices">{paths.map(({ id, Icon, title, description }) => <button className={id === "adopter" ? "onboarding-primary" : ""} key={id} onClick={() => id === "adopter" ? onNavigate("explore") : setSelected(id)}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ArrowRight aria-hidden="true" /></button>)}</div> : <>
      <ol className="onboarding-steps">{path.steps.map(step => <li key={step}><Check aria-hidden="true" /><span>{step}</span></li>)}</ol>
      <p className="onboarding-note">{selected === "foster" ? "Use your city, not your home address. Your pet listing will be reviewed before it appears publicly." : "Already invited to a team? Use your invitation link. Creating a profile does not verify an affiliation or grant access to an existing organization."}</p>
      <button className="button onboarding-continue" onClick={continuePath}>{path.action}<ArrowRight aria-hidden="true" /></button>
    </>}
    <button className="onboarding-back" onClick={() => onNavigate("explore")}>Just browsing? Explore pets</button>
    <p className="onboarding-footnote">Change paths anytime in More → Get started.</p>
  </section>;
}
