"use client";

import { useEffect, useState } from "react";
import { Building2, Heart, MessageCircle, PawPrint } from "lucide-react";
import "./caregivers.css";

export function CaregiverRegistrationForm({ onRegister, busy, error }) {
  const [form, setForm] = useState({ kind: (typeof window !== "undefined" && new URLSearchParams(window.location.hash.split("?")[1]).get("kind") === "shelter") ? "shelter" : "foster", name: "", city: "", region: "", country: "United States", authorityConfirmed: false });
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  return <form className="caregiver-form" onSubmit={event => { event.preventDefault(); onRegister(form); }}>
    <h2>Register your caregiver profile</h2>
    <label>I am registering as<select name="kind" value={form.kind} onChange={update} disabled={busy}>
      <option value="foster">Foster caregiver</option><option value="rescue">Local rescue</option><option value="shelter">Adoption shelter</option>
    </select></label>
    <label>{form.kind === "foster" ? "Public caregiver name" : "Shelter or rescue name"}<input required minLength={2} maxLength={160} name="name" value={form.name} onChange={update} disabled={busy} autoComplete="organization" /></label>
    <p className="caregiver-note">Use the name you want adopters to see. Registration does not give access to another organization or verify an affiliation.</p>
    <div className="caregiver-fields"><label>City<input required maxLength={120} name="city" value={form.city} onChange={update} disabled={busy} autoComplete="address-level2" /></label>
      <label>State / region<input required maxLength={120} name="region" value={form.region} onChange={update} disabled={busy} autoComplete="address-level1" /></label></div>
    <label>Country<input required maxLength={120} name="country" value={form.country} onChange={update} disabled={busy} autoComplete="country-name" /></label>
    <p className="caregiver-note">Your city and region help adopters understand where pets are located. Do not enter a foster home address. Questions and replies stay in Pawline Messages.</p>
    <label className="caregiver-confirm"><input required type="checkbox" name="authorityConfirmed" checked={form.authorityConfirmed} onChange={update} disabled={busy} />I am authorized to register this profile and list pets in my care or on behalf of this organization.</label>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <button type="submit" className="button" disabled={busy}>{busy ? "Registering…" : "Register profile"}</button>
    <p className="caregiver-note">Pet listings are reviewed before becoming public. Creating a profile does not award a verified badge.</p>
  </form>;
}

export default function CaregiverHub({ getToken, onListPet, onOpenMessages, children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [retry, setRetry] = useState(0);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const request = async (path, options = {}) => {
    const token = await getToken();
    if (!token) throw new Error("Sign in again to continue.");
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Please try again.");
    return body;
  };
  useEffect(() => {
    let active = true;
    request("/api/caregivers").then(body => { if (active) { setData(body); setSelectedId(body.registeredOrganizationId || body.organizations[0]?.id || ""); setError(""); } }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [getToken, retry]);
  const register = async form => {
    setBusy(true); setError("");
    try { const body = await request("/api/caregivers", { method: "POST", body: JSON.stringify(form) }); setData(body); setSelectedId(body.registeredOrganizationId || body.organizations[0]?.id || ""); setRegistrationOpen(false); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  };
  const updatePet = async (petId, status) => {
    setBusy(true); setError("");
    try { await request("/api/caregiver-pets", { method: "PATCH", body: JSON.stringify({ petId, status }) }); setData(current => ({ ...current, pets: current.pets.map(pet => pet.id === petId ? { ...pet, status } : pet) })); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  };
  if (!data) return <section className="caregiver-hub" aria-label="Caregiver workspace">{error ? <><p role="alert">{error}</p><button className="button" onClick={() => setRetry(value => value + 1)}>Try again</button></> : <p role="status">Opening your caregiver workspace…</p>}</section>;
  const organization = data.organizations.find(item => item.id === selectedId);
  return <section className="caregiver-hub" aria-labelledby="caregiver-title">
    <header><p className="eyebrow">Shelters, rescues & fosters</p><h1 id="caregiver-title">Help local pets find a home</h1><p>Register your profile, list the pets in your care, and answer adoption questions.</p></header>
    {!data.organizations.length && !data.canRegister ? <p role="status">Access to your registered profile is no longer available. Ask your organization administrator or Pawline support to review your access.</p> : !data.organizations.length || registrationOpen ? <><CaregiverRegistrationForm onRegister={register} busy={busy} error={error} />{data.organizations.length ? <button className="button button-outline" disabled={busy} onClick={() => setRegistrationOpen(false)}>Back to my profiles</button> : null}</> : <>
      <label className="caregiver-select">Your profile<select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{data.organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <p className="caregiver-note">{organization?.kind === "foster" ? "Foster caregiver" : organization?.kind === "rescue" ? "Rescue" : "Shelter"} · {[organization?.city, organization?.region].filter(Boolean).join(", ")} · {organization?.verificationState === "verified" ? "Verified organization" : "Profile not independently verified"}</p>
      <div className="caregiver-actions"><button className="button" disabled={organization?.role !== "administrator"} onClick={() => onListPet(organization)}><PawPrint />List a pet</button><button className="button button-outline" onClick={onOpenMessages}><MessageCircle />Answer questions</button></div>
      <p className="caregiver-note">After a listing is approved, adopters can open a private conversation from that pet’s page. Replies appear in Messages.</p>
      {data.canRegister ? <button className="button button-outline" onClick={() => setRegistrationOpen(true)}>Register my own caregiver profile</button> : null}
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </>}
    <section className="caregiver-pets" aria-label="Your pets"><h2>Your pets</h2>
      {data.pets.length ? <ul>{data.pets.map(pet => <li key={pet.id}><div><strong>{pet.name}</strong><span>{pet.species} · {pet.city || "Location not set"}</span><span>{pet.status === "pending" ? "Awaiting review" : pet.status}</span></div>
        {pet.canManage && ["pending", "available"].includes(pet.status) ? <div className="caregiver-pet-actions"><button disabled={busy} onClick={() => updatePet(pet.id, "adopted")}>Mark adopted</button><button disabled={busy} onClick={() => updatePet(pet.id, "unavailable")}>Mark unavailable</button></div> : null}</li>)}</ul> : <p>{data.organizations.length ? "No pets listed yet. Add your first pet for review." : "Register your profile, then add your first pet for review."}</p>}
    </section>
    {data.organizations.length ? children : null}
  </section>;
}

export function CaregiverWelcome({ onSignIn, onSignUp }) {
  return <section className="caregiver-hub" aria-labelledby="caregiver-welcome"><p className="eyebrow">Shelters, rescues & fosters</p><h1 id="caregiver-welcome">A home for your local adoption work</h1>
    <p>Register a local shelter, rescue, or foster caregiver profile. Share pets in your care and answer questions from prospective adopters.</p>
    <ul className="caregiver-benefits"><li><Building2 />Create a profile for your organization or foster work</li><li><PawPrint />Submit pets for review and keep availability current</li><li><Heart />Talk with adopters in private Pawline Messages</li></ul>
    <div className="caregiver-actions"><button className="button" onClick={onSignUp}>Register as a shelter or foster</button><button className="button button-outline" onClick={onSignIn}>Sign in</button></div>
    <p className="caregiver-note">Already invited by an organization? Use its invitation link to join the existing team.</p>
  </section>;
}
