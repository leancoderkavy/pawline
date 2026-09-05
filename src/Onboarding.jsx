"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Heart, House, Check } from "lucide-react";
import "./onboarding.css";

const paths = [
  { id: "adopter", Icon: Heart, title: "I’m looking for a pet", description: "Explore nearby pets and find a good fit for your home.", heading: "Meet your next companion", steps: ["Browse pets near your city", "Save favorites and compare your options", "Ask questions and confirm next steps with the shelter"], action: "Browse nearby pets" },
  { id: "shelter", Icon: Building2, title: "I’m with a shelter or rescue", description: "Create your organization’s profile and manage pets in your care.", heading: "Make room for more happy endings", steps: ["Create an account or sign in", "Add your shelter or rescue profile", "Submit your first pet for review"], action: "Set up my organization" },
  { id: "foster", Icon: House, title: "I’m a foster caregiver", description: "Help a pet in your care find a permanent home.", heading: "Help your foster pet find a home", steps: ["Create an account or sign in", "Add your public caregiver name and city", "Submit a pet for review and answer adoption questions"], action: "Set up my foster profile" },
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
    if (selected === "adopter") onNavigate("explore");
    else window.location.hash = `shelter?kind=${selected}`;
  };
  return <section className="onboarding" aria-labelledby="onboarding-title">
    <p className="eyebrow">Welcome to Pawline · Step {path ? "2" : "1"} of 2</p>
    <div className="onboarding-progress" aria-hidden="true"><span /><span className={path ? "complete" : ""} /></div>
    {path ? <button className="onboarding-back" onClick={() => setSelected(null)}><ArrowLeft aria-hidden="true" /> Change my path</button> : null}
    <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{path ? path.heading : "What brings you here?"}</h1>
    <p>{path ? "Here’s what comes next." : "Find your companion or help a pet find theirs. Choose where you’d like to start."}</p>
    {!path ? <div className="onboarding-choices">{paths.map(({ id, Icon, title, description }) => <button key={id} onClick={() => setSelected(id)}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ArrowRight aria-hidden="true" /></button>)}</div> : <>
      <ol className="onboarding-steps">{path.steps.map(step => <li key={step}><Check aria-hidden="true" /><span>{step}</span></li>)}</ol>
      <p className="onboarding-note">{selected === "adopter" ? "No account needed to browse. You can create one when you’re ready to message a caregiver or start an application." : selected === "foster" ? "Use your city, not your home address. Your pet listing will be reviewed before it appears publicly." : "Already invited to a team? Use your invitation link. Creating a profile does not verify an affiliation or grant access to an existing organization."}</p>
      <button className="button onboarding-continue" onClick={continuePath}>{path.action}<ArrowRight aria-hidden="true" /></button>
      {selected === "adopter" ? <button className="onboarding-back" onClick={() => onNavigate("match")}>Help me find a good match</button> : null}
    </>}
    <button className="onboarding-back" onClick={() => onNavigate("explore")}>Just browsing? Explore pets</button>
    <p className="onboarding-footnote">You can use both paths. Come back to Get started in the More menu anytime.</p>
  </section>;
}
