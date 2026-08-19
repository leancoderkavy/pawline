"use client";

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock3,
  Building2, CalendarClock, Check, Compass, ExternalLink, FileText, Globe2, Heart, Info, Layers3, ListChecks, LocateFixed, LockKeyhole, MapPin, Menu, PawPrint, Pencil,
  MessageCircle, Route, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Upload, X
} from "lucide-react";
import heroImage from "./heroData";
import { rankPets } from "./matching";
import { buildMapView, petCountLabel, petResultDetail } from "./mapView";
import { restoreFavoriteAfterFailure } from "./favoritesState";
import Dialog from "./Dialog";
import { createMapSearchInteraction } from "./mapSearchInteraction";

const CommunityWithAuth = lazy(() => import("./CommunityWithAuth"));
const DirectMessages = lazy(() => import("./DirectMessages"));
const FavoritesSyncWithAuth = lazy(() => import("./FavoritesSyncWithAuth"));
const SubmissionWithAuth = lazy(() => import("./SubmissionWithAuth"));

function Button({ className = "", variant = "primary", children, ...props }) {
  return <button className={`button ${variant === "outline" ? "button-outline" : ""} ${className}`} {...props}>{children}</button>;
}

async function readJson(response, fallbackMessage) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(fallbackMessage);
  }
  return response.json();
}

function LocationAutocomplete({ value, mapboxConfigured, locationState, onChange, onSearch, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionState, setSuggestionState] = useState("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expanded, setExpanded] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const searchSessionRef = useRef("");
  const requestRef = useRef(0);
  const listboxId = "global-location-suggestions";
  const activeSuggestion = suggestions[activeIndex];

  useEffect(() => {
    const query = value.trim();
    if (!hasUserEdited || mapboxConfigured !== true || query.length < 3) {
      setSuggestions([]);
      setSuggestionState("idle");
      setActiveIndex(-1);
      setExpanded(false);
      return undefined;
    }

    const controller = new AbortController();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const sessionToken = searchSessionRef.current || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    searchSessionRef.current = sessionToken;
    setSuggestionState("loading");
    setExpanded(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&autocomplete=true&session_token=${encodeURIComponent(sessionToken)}`, { signal: controller.signal });
        const body = await readJson(response, "Location suggestions are unavailable.");
        if (!response.ok) throw new Error(body.error || "Location suggestions are unavailable.");
        if (requestRef.current !== requestId) return;
        const nextSuggestions = (body.results || []).filter(result =>
          typeof result?.name === "string" && Number.isFinite(Number(result.longitude)) && Number.isFinite(Number(result.latitude)),
        );
        setSuggestions(nextSuggestions);
        setActiveIndex(-1);
        setSuggestionState(nextSuggestions.length ? "ready" : "empty");
      } catch (error) {
        if (error.name === "AbortError" || requestRef.current !== requestId) return;
        setSuggestions([]);
        setSuggestionState("error");
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, hasUserEdited, mapboxConfigured]);

  const closeSuggestions = () => {
    setExpanded(false);
    setActiveIndex(-1);
  };
  const selectSuggestion = suggestion => {
    onSelect(suggestion);
    searchSessionRef.current = "";
    setHasUserEdited(false);
    closeSuggestions();
  };
  const handleChange = event => {
    setHasUserEdited(true);
    setActiveIndex(-1);
    onChange(event.target.value);
  };
  const handleKeyDown = event => {
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }
    if (!expanded || !suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
    }
  };
  const handleSubmit = event => {
    event.preventDefault();
    if (activeSuggestion) selectSuggestion(activeSuggestion);
    else {
      closeSuggestions();
      onSearch();
    }
  };
  const showSuggestions = expanded && (suggestionState === "loading" || suggestionState === "ready" || suggestionState === "empty" || suggestionState === "error");

  return <form className={`global-location ${locationState.status === "error" ? "is-error" : ""} ${showSuggestions ? "has-suggestions" : ""}`} onSubmit={handleSubmit}>
    <span className="global-location-icon" aria-hidden="true"><MapPin /></span>
    <span className="global-location-field">
      <label htmlFor="global-location-input">Find pets near</label>
      <input id="global-location-input" value={value} onChange={handleChange} onFocus={() => { if (hasUserEdited && suggestionState !== "idle") setExpanded(true); }} onBlur={closeSuggestions} onKeyDown={handleKeyDown} placeholder="City, address, or ZIP code" autoComplete="off" inputMode="search" role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls={listboxId} aria-activedescendant={activeSuggestion ? `${listboxId}-${activeIndex}` : undefined} aria-invalid={locationState.status === "error"} aria-describedby="global-location-status" />
    </span>
    <button type="submit" disabled={locationState.status === "loading"} aria-label={locationState.status === "loading" ? "Searching for pets" : "Search this location"}>
      {locationState.status === "loading" ? <RotateCcw className="location-spinner" /> : <Search />}
    </button>
    {showSuggestions ? <div id={listboxId} className="global-location-suggestions" role="listbox" aria-label="Location suggestions" aria-busy={suggestionState === "loading"}>
      {suggestionState === "loading" ? <p className="location-suggestion-status" role="status">Finding places…</p> : null}
      {suggestionState === "empty" ? <p className="location-suggestion-status">No places match that search yet.</p> : null}
      {suggestionState === "error" ? <p className="location-suggestion-status">Suggestions are unavailable. You can still search this location.</p> : null}
      {suggestionState === "ready" ? suggestions.map((suggestion, index) => <div key={suggestion.id || `${suggestion.name}-${index}`} id={`${listboxId}-${index}`} className={`location-suggestion ${activeIndex === index ? "is-active" : ""}`} role="option" aria-selected={activeIndex === index} onPointerDown={event => event.preventDefault()} onClick={() => selectSuggestion(suggestion)}>
        <MapPin aria-hidden="true" /><span><strong>{suggestion.name}</strong><small>Use this location on the map</small></span>
      </div>) : null}
    </div> : null}
    <span id="global-location-status" className="sr-only" role={locationState.status === "error" ? "alert" : "status"} aria-live="polite">{locationState.status === "loading" ? "Searching for pets nearby" : locationState.message}</span>
  </form>;
}

function suppliedHours(item) {
  if (typeof item?.hours === "string" && item.hours.trim()) return item.hours.trim();
  if (typeof item?.todayHours === "string" && item.todayHours.trim()) return item.todayHours.trim();
  return null;
}

function Header({ saved, onSubmit, menuOpen, onToggleMenu }) {
  return <header className="header">
    <a className="brand" href="#discover"><span className="brand-mark"><PawPrint /></span><span>Pawline<small>A GLOBAL ADOPTION COMMUNITY</small></span></a>
    <nav><a href="#how">How it works</a><a href="#discover">Discover</a><a href="#map">Map</a><a href="#events">Events</a></nav>
    <div className="header-actions"><span className="language" aria-label="English language"><Globe2 /> EN</span><span className="saved" aria-label={`${saved} saved pets`}><Heart /> {saved}</span><Button variant="outline" onClick={onSubmit}>List a pet</Button><button className="menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={onToggleMenu}>{menuOpen ? <X /> : <Menu />}</button></div>
  </header>;
}

function MobileMenu({ onClose, onSubmit }) {
  return <nav className="mobile-menu" aria-label="Mobile navigation">
    <a href="#discover" onClick={onClose}>Discover</a>
    <a href="#map" onClick={onClose}>Map</a>
    <a href="#events" onClick={onClose}>Events</a>
    <a href="#how" onClick={onClose}>How it works</a>
    <button onClick={() => { onClose(); onSubmit(); }}>List a pet</button>
  </nav>;
}

function SubmissionForm({ onClose, getToken }) {
  const [listingRole, setListingRole] = useState("");
  const roleChoicesRef = useRef(null);
  const [flowStep, setFlowStep] = useState("role");
  const [form, setForm] = useState({
    name: "", species: "Dog", breed: "", age: "", sex: "Unknown", size: "",
    city: "", region: "", postalCode: "", country: "United States", shelter: "",
    email: "", phone: "", description: "", spayedNeutered: "Unknown",
    rabiesStatus: "Unknown", vaccinationStatus: "Unknown", microchipStatus: "Unknown",
    microchipId: "", medicalNotes: "", behaviorNotes: "", biteHistory: "Unknown",
    goodWithChildren: "Unknown", goodWithDogs: "Unknown", goodWithCats: "Unknown",
    houseTrained: "Unknown", rehomingReason: "", rehomingFee: "", website: "",
    authorityConfirmed: false, disclosureConfirmed: false, localLawConfirmed: false,
  });
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState({ status: "idle", message: "" });
  const update = e => setForm(current => ({ ...current, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const addFiles = async selected => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);
    const incoming = [...selected].filter(file => allowed.has(file.type));
    const candidate = [...files, ...incoming];
    if (candidate.length > 8) {
      setState({ status: "error", message: "Add no more than 8 photos or documents." });
      return;
    }
    const total = candidate.reduce((sum, file) => sum + file.size, 0);
    if (total > 3 * 1024 * 1024) {
      setState({ status: "error", message: "Photos and documents must total 3 MB or less." });
      return;
    }
    setFiles(candidate);
    if (incoming.length !== selected.length) setState({ status: "error", message: "Use PDF, TXT, JPG, PNG, or WebP files." });
  };
  const encodedFiles = () => Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
  const authorizedFetch = async (url, options = {}) => {
    const token = await getToken();
    if (!token) throw new Error("Sign in with Pawline to register a pet.");
    return fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  };
  const submit = async e => {
    e.preventDefault();
    setState({ status: "extracting", message: "Reading uploaded records and preparing an editable draft…" });
    try {
      const attachments = await encodedFiles();
      let draft = form;
      if (attachments.length) {
        const extractionResponse = await authorizedFetch("/api/extract-submission", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: attachments }),
        });
        const extraction = await readJson(extractionResponse, "Document extraction is unavailable.");
        if (!extractionResponse.ok) throw new Error(extraction.error || "We could not read those documents.");
        draft = { ...form, ...Object.fromEntries(Object.entries(extraction.fields || {}).filter(([, value]) => value && value !== "Unknown")), extractionMeta: extraction.extraction };
        setForm(draft);
        setState({ status: "review", message: "We pre-filled what the records supported. Review every field, then submit again to save." });
        return;
      }
      setState({ status: "saving", message: "Saving your listing for moderation…" });
      const response = await authorizedFetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, files: attachments }) });
      const body = await readJson(response, "Submissions require the configured Pawline API.");
      if (!response.ok) throw new Error(body.error || "Submission failed");
      setState({ status: "success", message: body.message });
    } catch (error) { setState({ status: "error", message: error.message }); }
  };
  const finalSubmit = async () => {
    setState({ status: "saving", message: "Saving your listing for moderation…" });
    try {
      const attachments = await encodedFiles();
      const response = await authorizedFetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, files: attachments }) });
      const body = await readJson(response, "Submissions require the configured Pawline API.");
      if (!response.ok) throw new Error(body.error || "Submission failed");
      setState({ status: "success", message: body.message });
    } catch (error) { setState({ status: "error", message: error.message }); }
  };
  const choice = (name, label, options = ["Unknown", "Yes", "No"]) => <label>{label}<select name={name} value={form[name]} onChange={update}>{options.map(option => <option key={option}>{option}</option>)}</select></label>;
  const busy = ["extracting", "saving"].includes(state.status);
  const chooseRole = role => {
    setListingRole(role);
    setForm(current => ({ ...current, shelter: role === "personal" ? current.shelter : "" }));
  };
  const chooseRoleByKeyboard = event => {
    const next = ["ArrowLeft", "ArrowUp", "Home"].includes(event.key)
      ? "personal"
      : ["ArrowRight", "ArrowDown", "End"].includes(event.key)
        ? "organization"
        : null;
    if (!next) return;
    event.preventDefault();
    chooseRole(next);
    roleChoicesRef.current?.querySelector(`[data-listing-role="${next}"]`)?.focus();
  };
  const beginDetails = () => {
    if (!listingRole) return;
    setFlowStep("details");
  };
  const roleLabel = listingRole === "organization" ? "Shelter or rescue" : "My pet";
  return <Dialog title="List a pet" onClose={onClose}>{state.status === "success" ? <div className="success"><Heart fill="currentColor" /><h3>Submitted for review</h3><p>{state.message}</p><Button onClick={onClose}>Done</Button></div> : <>
    <ol className="listing-progress" aria-label="Listing progress">
      <li className={flowStep === "role" ? "active" : "complete"}><span>1</span>Your role</li>
      <li className={flowStep === "details" ? "active" : ""}><span>2</span>Pet details</li>
      <li><span>3</span>Review</li>
    </ol>
    {flowStep === "role" ? <section className="listing-role-step">
      <div className="listing-role-copy"><p>Let’s find the right path</p><h3>Who are you listing for?</h3><span>Pick the path that fits. We’ll tailor the questions and keep the listing private until review.</span></div>
      <div ref={roleChoicesRef} className="listing-role-choices" role="radiogroup" aria-label="Who are you listing for?">
        <button type="button" role="radio" data-listing-role="personal" aria-checked={listingRole === "personal"} tabIndex={!listingRole || listingRole === "personal" ? 0 : -1} className={listingRole === "personal" ? "selected" : ""} onClick={() => chooseRole("personal")} onKeyDown={chooseRoleByKeyboard}>
          <span className="role-icon personal"><Heart /><PawPrint /></span>
          <span><strong>My pet</strong><small>I’m rehoming a pet I own or care for</small></span>
          <i>{listingRole === "personal" ? <CheckCircle2 /> : null}</i>
        </button>
        <button type="button" role="radio" data-listing-role="organization" aria-checked={listingRole === "organization"} tabIndex={listingRole === "organization" ? 0 : -1} className={listingRole === "organization" ? "selected" : ""} onClick={() => chooseRole("organization")} onKeyDown={chooseRoleByKeyboard}>
          <span className="role-icon"><Building2 /></span>
          <span><strong>A shelter or rescue</strong><small>I’m listing on behalf of an organization</small></span>
          <i>{listingRole === "organization" ? <CheckCircle2 /> : null}</i>
        </button>
      </div>
      <div className="listing-path-preview" aria-hidden="true"><span><PawPrint /></span><i /><span><PawPrint /></span><i /><strong>Next: tell us about the pet</strong></div>
      <footer className="listing-flow-actions"><p><LockKeyhole />Saved as a private draft until review</p><Button type="button" onClick={beginDetails} disabled={!listingRole}>Continue <ChevronRight /></Button></footer>
    </section> : <>
      <div className="listing-details-intro"><button type="button" onClick={() => setFlowStep("role")}><ArrowLeft /> Change path</button><span><PawPrint />{roleLabel}</span><h3>Tell us about the pet</h3><p>Start with a photo or record, or fill in what you know. You’ll review everything before it is submitted.</p></div>
      <form className="listing-details-form" onSubmit={submit}>
    <section className="submission-section"><h3>Photos & records</h3>
      <div className={`drop-zone ${dragging ? "is-dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
        <Upload /><strong>Drag and drop files here</strong><span>or choose up to 8 PDF, TXT, JPG, PNG, or WebP files within 3 MB total</span>
        <label className="file-picker">Choose files<input type="file" multiple accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" onChange={e => addFiles(e.target.files)} /></label>
      </div>
      {files.length ? <ul className="upload-list">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.type.startsWith("image/") ? <Upload /> : <FileText />}<span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></span></span><button type="button" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><Trash2 /></button></li>)}</ul> : null}
    </section>
    <section className="submission-section"><h3>Pet details</h3>
    <label>Pet name<input required name="name" value={form.name} onChange={update} placeholder="e.g. Poppy" /></label>
    <div className="form-row"><label>Species<select name="species" value={form.species} onChange={update}><option>Dog</option><option>Cat</option></select></label><label>Breed<input required name="breed" value={form.breed} onChange={update} /></label></div>
    <div className="form-row"><label>Age or date of birth<input name="age" value={form.age} onChange={update} /></label>{choice("sex", "Sex", ["Unknown", "Female", "Male"])}</div>
    <div className="form-row">{choice("spayedNeutered", "Spayed or neutered")}{choice("microchipStatus", "Microchipped")}</div>
    <label>Microchip ID (do not enter registration passwords)<input name="microchipId" value={form.microchipId} onChange={update} /></label>
    </section>
    <section className="submission-section"><h3>Health & behavior disclosures</h3>
    <div className="form-row">{choice("rabiesStatus", "Rabies vaccination current")}{choice("vaccinationStatus", "Core vaccinations current")}</div>
    <div className="form-row">{choice("biteHistory", "Known bite history")}{choice("houseTrained", "House trained")}</div>
    <label>Known medical conditions, medications, allergies, or care needs<textarea name="medicalNotes" value={form.medicalNotes} onChange={update} maxLength={2000} /></label>
    <label>Behavior history, triggers, training, or safety needs<textarea name="behaviorNotes" value={form.behaviorNotes} onChange={update} maxLength={2000} /></label>
    <div className="form-row">{choice("goodWithChildren", "Lived safely with children")}{choice("goodWithDogs", "Lived safely with dogs")}</div>
    {choice("goodWithCats", "Lived safely with cats")}
    </section>
    <section className="submission-section"><h3>Placement & contact</h3>
    <div className="form-row"><label>City<input required name="city" value={form.city} onChange={update} /></label><label>State / region<input required name="region" value={form.region} onChange={update} /></label></div>
    <div className="form-row"><label>Postal code<input required name="postalCode" value={form.postalCode} onChange={update} /></label><label>Country<input required name="country" value={form.country} onChange={update} /></label></div>
    <label>{listingRole === "organization" ? "Shelter or rescue name" : "Your name or current caretaker"}<input required name="shelter" value={form.shelter} onChange={update} /></label>
    <label>Contact email<input required type="email" name="email" value={form.email} onChange={update} /></label>
    <div className="form-row"><label>Phone (optional)<input name="phone" value={form.phone} onChange={update} /></label><label>Rehoming fee (optional)<input name="rehomingFee" value={form.rehomingFee} onChange={update} /></label></div>
    {listingRole === "personal" ? <label>Reason for rehoming<textarea name="rehomingReason" value={form.rehomingReason} onChange={update} maxLength={1000} /></label> : null}
    <label>Public listing description<textarea name="description" value={form.description} onChange={update} maxLength={2000} /></label>
    </section>
    <section className="submission-section attestations"><h3>Your attestations</h3>
      <label><input required type="checkbox" name="authorityConfirmed" checked={form.authorityConfirmed} onChange={update} />{listingRole === "organization" ? "I am authorized to submit listings for this shelter or rescue." : "I own this pet or have documented authority to place them."}</label>
      <label><input required type="checkbox" name="disclosureConfirmed" checked={form.disclosureConfirmed} onChange={update} />I disclosed all known medical, bite, aggression, and behavioral history accurately.</label>
      <label><input required type="checkbox" name="localLawConfirmed" checked={form.localLawConfirmed} onChange={update} />I will comply with licensing, transfer, health-certificate, and other rules where the pet is transferred.</label>
      <p><Info /> Requirements vary by jurisdiction and lister type. Pawline does not replace advice from animal control, a veterinarian, or a lawyer.</p>
    </section>
    <label className="honeypot" aria-hidden="true">Website<input tabIndex="-1" name="website" value={form.website} onChange={update} /></label>
    {state.message && <p className={state.status === "error" ? "form-error" : "form-status"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    {state.status === "review" ? <Button type="button" onClick={finalSubmit} disabled={busy}>Submit reviewed listing</Button> : <Button type="submit" disabled={busy}>{busy ? "Working…" : files.length ? <><Sparkles /> Read records & pre-fill</> : "Submit for review"}</Button>}
  </form></>}</>}</Dialog>;
}

function PetTile({ pet, saved, onSave, onOpen }) {
  return <article className="pet-tile">
    <img src={pet.image} alt={`${pet.name}, a ${pet.breed}`} />
    <button className={`heart ${saved ? "is-saved" : ""}`} onClick={() => onSave(pet.id)} aria-label={`${saved ? "Remove" : "Save"} ${pet.name}`}><Heart fill={saved ? "currentColor" : "none"} /></button>
    <button className="pet-open" onClick={() => onOpen(pet)} aria-label={`View ${pet.name}'s details`}><span className="pet-overlay"><strong>{pet.name}</strong><span>{pet.age} · {pet.breed}</span><span><MapPin /> {pet.distance} mi away</span></span></button>
  </article>;
}

function PetDetail({ pet, onClose, saved, onSave, onMessage }) {
  const unavailableDetails = new Set([
    "See official listing",
    "Age available from LA Animal Services",
    "Details available from LA Animal Services",
    "Unknown",
  ]);
  const detailTags = [...new Set([pet.species, pet.age, pet.size, pet.sex])]
    .filter(value => value && !unavailableDetails.has(value));
  const hasSpecificBreed = pet.breed && !unavailableDetails.has(pet.breed);
  const directionsUrl = Number.isFinite(Number(pet.latitude)) && Number.isFinite(Number(pet.longitude))
    ? `https://www.google.com/maps/dir/?api=1&destination=${pet.latitude},${pet.longitude}`
    : null;
  return <Dialog title={pet.name} onClose={onClose}>
    <div className="pet-detail">
      <div className="pet-detail-media"><img src={pet.image} alt={`${pet.name}${hasSpecificBreed ? `, a ${pet.breed}` : ""}`} /></div>
      {detailTags.length ? <div className="detail-meta">{detailTags.map(tag => <span key={tag}>{tag}</span>)}</div> : null}
      {hasSpecificBreed ? <h3>{pet.breed}</h3> : null}
      <p className="detail-location"><MapPin /><span><strong>{pet.locationAccuracy === "shelter" ? "Current shelter location" : "Location"}</strong>{pet.address || pet.city}{pet.address && pet.city ? <small>{pet.city}</small> : null}</span></p>
      <p><ShieldCheck /> {pet.shelter} · verified source</p>
      <p className="detail-hours"><CalendarClock /><span><strong>Shelter hours</strong>{suppliedHours(pet) || "Not supplied by this listing—confirm before visiting."}</span></p>
      {pet.locationAccuracy === "shelter" ? <p className="detail-note">The map marker shows the shelter caring for {pet.name}, not a private or foster address. Confirm current availability before visiting.</p> : null}
      {pet.description ? <p>{pet.description}</p> : null}
      <aside className="pet-visit-questions"><ListChecks /><div><strong>Good questions for {pet.name}</strong><span>Ask about daily routine, medical history, behavior observations, adoption fees, and the best first week at home.</span></div></aside>
      <div className="detail-actions">
        <Button variant="outline" onClick={() => onSave(pet.id)}><Heart fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}</Button>
        {pet.messageAvailable ? <Button className="pet-message" onClick={() => { onMessage(pet); onClose(); }}><MessageCircle />Message {pet.shelter || "caretaker"}</Button> : null}
        {pet.sourceUrl ? <a className="button" href={pet.sourceUrl} target="_blank" rel="noreferrer">View adoption listing <ChevronRight /></a> : <span className="button button-disabled" aria-disabled="true">Contact the listed rescue</span>}
        {directionsUrl ? <a className="button button-outline detail-directions" href={directionsUrl} target="_blank" rel="noreferrer"><Compass /> Directions</a> : null}
      </div>
    </div>
  </Dialog>;
}

function EventDetail({ event, onClose }) {
  const item = normalizeEvent(event);
  const directionsUrl = item.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`
    : Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
      ? `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`
      : null;
  return <Dialog title={item.title || "Adoption event"} onClose={onClose}>
    <div className="map-point-detail">
      <div className="point-detail-hero"><span className="point-detail-icon"><CalendarDays /></span><div><span className="point-detail-label"><ShieldCheck /> Source reviewed</span><p>A Pawline field note for meeting adoptable pets nearby.</p></div></div>
      <dl className="point-detail-facts">
        <div><dt><Clock3 /> When</dt><dd>{item.date ? `${item.date} · ${item.time}` : item.time || "Confirm the current time with the organizer"}</dd></div>
        <div><dt><MapPin /> Where</dt><dd>{item.place || item.city || "See the official event page"}</dd></div>
      </dl>
      {item.description ? <p className="point-detail-description">{item.description}</p> : null}
      <aside className="visit-note"><PawPrint /><div><strong>Before you head out</strong><span>Confirm the event time, bring household questions, and ask what each pet needs after adoption.</span></div></aside>
      <div className="point-detail-actions">
        {item.source_url ? <a className="button" href={item.source_url} target="_blank" rel="noreferrer">Official details <ExternalLink /></a> : <span className="button button-disabled" aria-disabled="true">Confirm with organizer</span>}
        {directionsUrl ? <a className="button button-outline" href={directionsUrl} target="_blank" rel="noreferrer">Directions <Compass /></a> : null}
      </div>
    </div>
  </Dialog>;
}

function DiscoveryDetail({ discovery, onClose }) {
  const directionsUrl = Number.isFinite(Number(discovery.latitude)) && Number.isFinite(Number(discovery.longitude))
    ? `https://www.google.com/maps/dir/?api=1&destination=${discovery.latitude},${discovery.longitude}`
    : null;
  return <Dialog title={discovery.title || "Adoption lead"} onClose={onClose}>
    <div className="map-point-detail">
      <div className="point-detail-hero is-lead"><span className="point-detail-icon"><Globe2 /></span><div><span className="point-detail-label"><Info /> Needs confirmation</span><p>A fresh lead found on the web—not yet a shelter-verified Pawline listing.</p></div></div>
      <dl className="point-detail-facts"><div><dt><MapPin /> Approximate area</dt><dd>{discovery.city || "Location supplied by the source"}</dd></div><div><dt><Globe2 /> Source</dt><dd>{discovery.source_domain || "External website"}</dd></div></dl>
      <aside className="visit-note is-caution"><ShieldCheck /><div><strong>Check before you trust it</strong><span>Confirm availability, fees, identity, and a safe public handoff. Never send a deposit before verifying the organization or caretaker.</span></div></aside>
      <div className="point-detail-actions"><a className="button" href={discovery.source_url} target="_blank" rel="noreferrer">Verify at source <ExternalLink /></a>{directionsUrl ? <a className="button button-outline" href={directionsUrl} target="_blank" rel="noreferrer">View area <Compass /></a> : null}</div>
    </div>
  </Dialog>;
}

const DEFAULT_MAP_CENTER = [-118.1445, 34.1478];

function routeGeoJson(pets) {
  const coordinates = pets
    .filter(pet => Number.isFinite(pet.longitude) && Number.isFinite(pet.latitude))
    .map(pet => [pet.longitude, pet.latitude]);
  return coordinates.length > 1
    ? { type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} }
    : { type: "FeatureCollection", features: [] };
}

function addPawImage(map, id, color) {
  if (map.hasImage(id)) return;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.strokeStyle = "#fffaf1";
  context.lineWidth = 4;
  const circle = (x, y, radius) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  };
  circle(17, 17, 7);
  circle(31, 11, 7);
  circle(45, 17, 7);
  circle(51, 30, 6);
  context.beginPath();
  context.ellipse(32, 42, 17, 13, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  map.addImage(id, { width: size, height: size, data: context.getImageData(0, 0, size, size).data });
}

function InteractiveMap({ coordinates, userCoordinates, points, location, onPointClick, onMoveSearch, densityMode, routePets }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoJsonRef = useRef(null);
  const userCoordinatesRef = useRef(userCoordinates);
  const pointClickRef = useRef(onPointClick);
  const moveSearchRef = useRef(onMoveSearch);
  const densityRef = useRef(densityMode);
  const routeRef = useRef(routePets);
  const [interactive, setInteractive] = useState(false);
  const [mapState, setMapState] = useState({ status: "preview", message: "" });
  const center = coordinates
    ? [Number(coordinates.longitude), Number(coordinates.latitude)]
    : DEFAULT_MAP_CENTER;
  const previewParams = new URLSearchParams({
    longitude: String(center[0]),
    latitude: String(center[1]),
  });
  const previewPoints = points.slice(0, 40).map(point =>
    `${point.longitude},${point.latitude},${point.type === "event" ? "e" : "p"}`,
  ).join("|");
  if (previewPoints) previewParams.set("points", previewPoints);
  const previewUrl = `/api/map?${previewParams}`;
  const mobilePreviewUrl = `${previewUrl}&variant=mobile`;
  const [previewUnavailable, setPreviewUnavailable] = useState(false);

  useEffect(() => {
    setPreviewUnavailable(false);
  }, [previewUrl]);
  const geoJson = {
    type: "FeatureCollection",
    features: points.map(point => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        properties: { type: point.type, id: String(point.id) },
      })),
  };
  geoJsonRef.current = geoJson;
  userCoordinatesRef.current = userCoordinates;
  pointClickRef.current = onPointClick;
  moveSearchRef.current = onMoveSearch;
  densityRef.current = densityMode;
  routeRef.current = routePets;

  useEffect(() => {
    if (!interactive || !containerRef.current) return undefined;
    let active = true;
    let map;
    setMapState({ status: "loading", message: "" });

    Promise.all([
      fetch("/api/map-token").then(response => readJson(response, "Interactive maps are unavailable."))
        .then(body => {
          if (!body.accessToken) throw new Error("Interactive maps are unavailable.");
          return body.accessToken;
        }),
      import("mapbox-gl"),
    ]).then(([accessToken, module]) => {
      if (!active || !containerRef.current) return;
      const mapboxgl = module.default;
      mapboxgl.accessToken = accessToken;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        config: { basemap: { theme: "monochrome", lightPreset: "day", showPointOfInterestLabels: false, showTransitLabels: false } },
        center,
        zoom: 10,
        attributionControl: true,
        cooperativeGestures: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (!active) return;
        map.addSource("pawline-points", { type: "geojson", data: geoJsonRef.current });
        map.addSource("pawline-visit-route", { type: "geojson", data: routeGeoJson(routeRef.current) });
        map.addSource("pawline-user-location", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: userCoordinatesRef.current ? [{
              type: "Feature",
              geometry: { type: "Point", coordinates: [userCoordinatesRef.current.longitude, userCoordinatesRef.current.latitude] },
              properties: {},
            }] : [],
          },
        });
        map.addLayer({
          id: "pawline-user-location-halo",
          type: "circle",
          source: "pawline-user-location",
          paint: { "circle-radius": 14, "circle-color": "#2578d4", "circle-opacity": 0.2 },
        });
        map.addLayer({
          id: "pawline-user-location",
          type: "circle",
          source: "pawline-user-location",
          paint: {
            "circle-radius": 7,
            "circle-color": "#2578d4",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });
        addPawImage(map, "pawline-pet-marker", "#2f7458");
        addPawImage(map, "pawline-event-marker", "#ad5d35");
        addPawImage(map, "pawline-discovery-marker", "#7a5a9b");
        map.addLayer({ id: "pawline-density", type: "heatmap", source: "pawline-points", filter: ["==", ["get", "type"], "pet"], maxzoom: 13, layout: { visibility: densityRef.current ? "visible" : "none" }, paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 7, 0.7, 13, 1.5],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(23,56,47,0)", 0.25, "#dce8df", 0.55, "#91b09d", 0.8, "#c95f3c", 1, "#8f3e27"],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 7, 22, 13, 44],
          "heatmap-opacity": 0.68,
        } });
        map.addLayer({ id: "pawline-visit-route-shadow", type: "line", source: "pawline-visit-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fffaf1", "line-width": 8, "line-opacity": 0.9 } });
        map.addLayer({ id: "pawline-visit-route", type: "line", source: "pawline-visit-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#c95f3c", "line-width": 4, "line-dasharray": [1, 1.6] } });
        map.addLayer({
          id: "pawline-marker-halos",
          type: "circle",
          source: "pawline-points",
          paint: {
            "circle-radius": 22,
            "circle-color": ["match", ["get", "type"], "event", "#f4dfd2", "discovery", "#eee6f3", "#deebe2"],
            "circle-opacity": 0.9,
            "circle-stroke-color": "#fffaf1",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "pawline-pets",
          type: "symbol",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "pet"],
          layout: { "icon-image": "pawline-pet-marker", "icon-size": 0.52, "icon-allow-overlap": true },
        });
        map.addLayer({
          id: "pawline-pet-hit-area",
          type: "circle",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "pet"],
          paint: {
            "circle-radius": 20,
            "circle-color": "#2f7458",
            "circle-opacity": 0.01,
          },
        });
        map.addLayer({
          id: "pawline-events",
          type: "symbol",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "event"],
          layout: { "icon-image": "pawline-event-marker", "icon-size": 0.52, "icon-allow-overlap": true },
        });
        map.addLayer({
          id: "pawline-event-hit-area",
          type: "circle",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "event"],
          paint: { "circle-radius": 20, "circle-color": "#ad5d35", "circle-opacity": 0.01 },
        });
        map.addLayer({
          id: "pawline-discoveries",
          type: "symbol",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "discovery"],
          layout: { "icon-image": "pawline-discovery-marker", "icon-size": 0.52, "icon-allow-overlap": true },
        });
        map.addLayer({
          id: "pawline-discovery-hit-area",
          type: "circle",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "discovery"],
          paint: { "circle-radius": 20, "circle-color": "#7a5a9b", "circle-opacity": 0.01 },
        });
        map.on("mouseenter", "pawline-pet-hit-area", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "pawline-pet-hit-area", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "pawline-pet-hit-area", event => {
          const id = event.features?.[0]?.properties?.id;
          if (id) pointClickRef.current?.(id, "pet");
        });
        map.on("mouseenter", "pawline-event-hit-area", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "pawline-event-hit-area", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "pawline-event-hit-area", event => {
          const id = event.features?.[0]?.properties?.id;
          if (id) pointClickRef.current?.(id, "event");
        });
        map.on("mouseenter", "pawline-discovery-hit-area", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "pawline-discovery-hit-area", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "pawline-discovery-hit-area", event => {
          const id = event.features?.[0]?.properties?.id;
          if (id) pointClickRef.current?.(id, "discovery");
        });
        const searchInteraction = createMapSearchInteraction(nextCenter => {
          moveSearchRef.current?.(nextCenter);
        });
        map.on("dragstart", event => searchInteraction.start(event));
        map.on("zoomstart", event => searchInteraction.start(event));
        map.on("moveend", () => searchInteraction.finish(map.getCenter()));
        setMapState({ status: "ready", message: "" });
      });
      map.on("error", () => {
        if (active) setMapState({ status: "error", message: "The interactive map could not load." });
      });
    }).catch(error => {
      if (active) setMapState({ status: "error", message: error.message });
    });

    return () => {
      active = false;
      mapRef.current = null;
      if (map) map.remove();
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("pawline-points");
    if (source) source.setData(geoJson);
  }, [points, coordinates]);

  useEffect(() => {
    const source = mapRef.current?.getSource("pawline-user-location");
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: userCoordinates ? [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [userCoordinates.longitude, userCoordinates.latitude] },
        properties: {},
      }] : [],
    });
  }, [userCoordinates?.longitude, userCoordinates?.latitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("pawline-density")) return;
    map.setLayoutProperty("pawline-density", "visibility", densityMode ? "visible" : "none");
  }, [densityMode]);

  useEffect(() => {
    const source = mapRef.current?.getSource("pawline-visit-route");
    if (!source) return;
    source.setData(routeGeoJson(routePets));
  }, [routePets]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coordinates) return;
    const current = map.getCenter();
    if (Math.abs(current.lng - center[0]) < 0.0001 && Math.abs(current.lat - center[1]) < 0.0001) return;
    map.easeTo({ center, zoom: Math.max(map.getZoom(), 10), duration: 700 });
  }, [coordinates?.longitude, coordinates?.latitude]);

  return <>
    {interactive
      ? <div ref={containerRef} className="interactive-map" role="region" aria-label={`Interactive pet map centered on ${location}`} />
      : <div className="map-facade">
          <picture>
            <source media="(max-width: 700px)" srcSet={mobilePreviewUrl} width="450" height="760" />
            <img
              src={previewUrl}
              width="900"
              height="620"
              alt={`Map preview centered on ${location}`}
              className={previewUnavailable ? "is-unavailable" : undefined}
              onError={() => setPreviewUnavailable(true)}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <button type="button" className="map-activate" onClick={() => setInteractive(true)}>
            <LocateFixed />
            <span><strong>Explore the interactive map</strong><small>Drag, zoom, and open current listings</small></span>
          </button>
        </div>}
    {mapState.status === "loading" ? <div className="map-loading" role="status">Loading interactive map…</div> : null}
    {mapState.status === "error" ? <div className="map-unavailable" role="alert"><span className="map-unavailable-icon"><MapPin /></span><strong>Map temporarily unavailable</strong><span>{mapState.message}</span></div> : null}
    {mapState.status === "ready" ? <>
      <span className="map-instructions">Move the map to search this area · Use +/− to zoom</span>
    </> : null}
  </>;
}

function MapFilters({ petType, distance, showEvents, densityMode, hoursFilter, onPetTypeChange, onDistanceChange, onShowEventsChange, onDensityChange, onHoursFilterChange, onReset }) {
  return <div className="map-toolbar" role="group" aria-label="Map filters">
    <div className="mobile-pet-types" role="group" aria-label="Pet type">
      {["All", "Dog", "Cat"].map(type => <button key={type} type="button" className={petType === type ? "is-active" : ""} onClick={() => onPetTypeChange(type)} aria-pressed={petType === type}>{type === "All" ? "All" : `${type}s`}</button>)}
    </div>
    <label className="map-select"><SlidersHorizontal /><span>Pet type</span><select value={petType} onChange={event => onPetTypeChange(event.target.value)} aria-label="Filter map by pet type"><option>All</option><option>Dog</option><option>Cat</option></select></label>
    <label className="map-select"><LocateFixed /><span>Radius</span><select value={distance} onChange={event => onDistanceChange(event.target.value)} aria-label="Map search radius"><option value="25">25 mi</option><option value="50">50 mi</option><option value="100">100 mi</option><option value="150">150 mi</option></select></label>
    <details className="more-filters">
      <summary><SlidersHorizontal /> More filters</summary>
      <div>
        <label className="map-select"><CalendarClock /><span>Shelter hours</span><select value={hoursFilter} onChange={event => onHoursFilterChange(event.target.value)} aria-label="Filter by supplied shelter hours"><option value="all">All listings</option><option value="known">Hours supplied</option></select></label>
        <button type="button" className={`map-toggle ${showEvents ? "is-active" : ""}`} onClick={() => onShowEventsChange(value => !value)} aria-pressed={showEvents}><CalendarDays /> Show events</button>
        <button type="button" className={`map-toggle ${densityMode ? "is-active" : ""}`} onClick={() => onDensityChange(value => !value)} aria-pressed={densityMode}><Layers3 /> Show pet density</button>
        <button type="button" className="map-reset" onClick={onReset} aria-label="Reset all filters"><RotateCcw /> Reset filters</button>
      </div>
    </details>
  </div>;
}

function MapResults({ view, saved, showSavedOnly, onToggleSavedOnly, onSave, onOpenPet, onOpenEvent, onOpenDiscovery }) {
  const items = [
    ...view.pets.filter(item => !showSavedOnly || saved.includes(item.id)).map(item => ({ ...item, resultType: "pet" })),
    ...(showSavedOnly ? [] : [
    ...view.events.map(item => ({ ...item, resultType: "event" })),
    ...view.discoveries.map(item => ({ ...item, resultType: "discovery" })),
    ]),
  ];
  const open = item => {
    if (item.resultType === "pet") onOpenPet(item);
    if (item.resultType === "event") onOpenEvent(item);
    if (item.resultType === "discovery") onOpenDiscovery(item);
  };
  const icon = type => type === "event" ? <CalendarDays /> : type === "discovery" ? <Globe2 /> : <PawPrint />;
  const detail = item => item.resultType === "event"
    ? `${normalizeEvent(item).month} ${normalizeEvent(item).day} · ${normalizeEvent(item).time}`
    : petResultDetail(item);
  const accessibleName = item => item.resultType === "event"
    ? `Open ${item.title} on ${normalizeEvent(item).month} ${normalizeEvent(item).day} details`
    : `Open ${item.name || item.title || item.resultType} details`;

  return <section className="map-results" aria-labelledby="map-results-title">
    <div><strong id="map-results-title">{showSavedOnly ? "Favorite listings" : "On this map"}</strong><button type="button" className={`favorites-filter ${showSavedOnly ? "is-active" : ""}`} onClick={onToggleSavedOnly} aria-pressed={showSavedOnly}><Heart fill={showSavedOnly ? "currentColor" : "none"} />{showSavedOnly ? "Show all" : `${saved.length} saved`}</button></div>
    {items.length ? <div className="map-result-list">{items.map(item =>
      <div className="map-result-row" key={`${item.resultType}-${item.id}`}>
        <button type="button" className="map-result-open" onClick={() => open(item)} aria-label={accessibleName(item)}>
          <span className={`map-result-icon result-${item.resultType}`}>{icon(item.resultType)}</span>
          <span><strong>{item.name || item.title}</strong><small>{detail(item)}</small>{item.resultType === "pet" ? <em className="listing-freshness"><i /> Checked this session{suppliedHours(item) ? " · Hours supplied" : " · Confirm shelter hours"}</em> : null}</span>
          <ChevronRight />
        </button>
        {item.resultType === "pet" ? <button type="button" className={`map-result-heart ${saved.includes(item.id) ? "is-saved" : ""}`} onClick={() => onSave(item.id)} aria-pressed={saved.includes(item.id)} aria-label={`${saved.includes(item.id) ? "Remove" : "Add"} ${item.name} ${saved.includes(item.id) ? "from" : "to"} favorites`}><Heart fill={saved.includes(item.id) ? "currentColor" : "none"} /></button> : null}
      </div>,
    )}</div> : <p>{showSavedOnly ? "No favorite listings are visible in this map area yet. Heart a pet to keep it here." : "No coordinate-backed results match this map area and filters."}</p>}
  </section>;
}

function VisitPlanner({ pets, location }) {
  const [checked, setChecked] = useState([]);
  const routeStops = pets.slice(0, 8);
  const routeUrl = routeStops.length
    ? `https://www.google.com/maps/dir/?api=1&destination=${routeStops[routeStops.length - 1].latitude},${routeStops[routeStops.length - 1].longitude}${routeStops.length > 1 ? `&waypoints=${routeStops.slice(0, -1).map(pet => `${pet.latitude},${pet.longitude}`).join("|")}` : ""}`
    : null;
  const checklist = [
    "Confirm each pet is still available",
    "Check shelter hours and appointment rules",
    "Bring household and resident-pet questions",
    "Ask about medical history, fees, and next steps",
  ];
  const toggle = item => setChecked(items => items.includes(item) ? items.filter(value => value !== item) : [...items, item]);

  return <section className="visit-planner" aria-labelledby="visit-planner-title">
    <header><span><Route /></span><div><small>Your adoption trail</small><h2 id="visit-planner-title">Plan a thoughtful visit</h2><p>{routeStops.length ? `${routeStops.length} saved ${routeStops.length === 1 ? "stop" : "stops"} near ${location}.` : "Save pets to build a nearby shelter route."}</p></div></header>
    {routeStops.length ? <ol className="visit-stops">{routeStops.map((pet, index) => <li key={pet.id}><span>{index + 1}</span><div><strong>{pet.name}</strong><small>{pet.shelter || pet.city}</small><em>{suppliedHours(pet) ? "Shelter hours supplied" : "Confirm hours before leaving"}</em></div></li>)}</ol> : <div className="visit-empty"><Heart /><span><strong>Your route starts with a heart</strong>Save a listing and Pawline will place it here.</span></div>}
    <fieldset className="visit-checklist"><legend><ListChecks /> Visit checklist</legend>{checklist.map(item => <label key={item}><input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)} /><span className="check-box"><Check /></span><span>{item}</span></label>)}</fieldset>
    {routeUrl ? <a className="button visit-route-link" href={routeUrl} target="_blank" rel="noreferrer"><Route /> Open adoption trail <ExternalLink /></a> : <span className="visit-route-note">Routes include coordinate-backed saved listings only.</span>}
  </section>;
}

function MapPanel({ location, coordinates, userCoordinates, locationPrompt, configured, view, petType, showEvents, densityMode, routePets, onOpenPet, onOpenEvent, onOpenDiscovery, onMapMove, onRequestLocation, onDismissLocation }) {
  const { pets: visiblePets, events: visibleEvents, discoveries: visibleDiscoveries } = view;
  const points = [
    ...visiblePets
      .map(pet => ({ id: pet.id, longitude: pet.longitude, latitude: pet.latitude, type: "pet" })),
    ...visibleEvents.slice(0, 10)
      .map(event => ({ id: event.id, longitude: event.longitude, latitude: event.latitude, type: "event" })),
    ...visibleDiscoveries.slice(0, 10)
      .map(item => ({ id: item.id, longitude: item.longitude, latitude: item.latitude, type: "discovery" })),
  ];
  const openPoint = (id, type) => {
    if (type === "discovery") {
      const discovery = visibleDiscoveries.find(item => String(item.id) === String(id));
      if (discovery) onOpenDiscovery?.(discovery);
      return;
    }
    if (type === "event") {
      const event = visibleEvents.find(item => String(item.id) === String(id));
      if (event) onOpenEvent?.(event);
      return;
    }
    const pet = visiblePets.find(item => String(item.id) === String(id));
    if (pet) onOpenPet?.(pet);
  };
  return <section id="map" className="map-discovery" aria-labelledby="map-title">
    <header className="map-header">
      <div><span className="map-kicker"><MapPin /> Explore nearby</span><h2 id="map-title">Find your next hello.</h2><p>Browse current pet listings and reviewed adoption events around your search area.</p></div>
      <div className="map-count" aria-live="polite"><strong>{visiblePets.length}</strong><span>mapped pets in this view</span></div>
    </header>
    <div className="map-canvas">
      {configured === true
        ? <InteractiveMap coordinates={coordinates} userCoordinates={userCoordinates} points={points} location={location} onPointClick={openPoint} onMoveSearch={onMapMove} densityMode={densityMode} routePets={routePets} />
        : <div className="map-unavailable" role={configured === null ? "status" : undefined}><span className="map-unavailable-icon"><MapPin /></span><strong>{configured === null ? "Checking map availability" : "Map preview is waiting for its connection"}</strong><span>{configured === null ? "Your discovery tools will be ready in a moment." : "Filters are ready to use. Connect Mapbox to turn on live location search and the map preview."}</span></div>}
      {configured === true && locationPrompt.status !== "hidden" && !userCoordinates ? <div className="location-permission" role="dialog" aria-labelledby="location-permission-title" aria-describedby="location-permission-description">
        <span className="location-permission-icon" aria-hidden="true"><LocateFixed /></span>
        <div><strong id="location-permission-title">See where you are</strong><span id="location-permission-description">{locationPrompt.message || "Share your location to show your position on the map."}</span></div>
        <button type="button" className="button primary" onClick={onRequestLocation} disabled={locationPrompt.status === "loading"}>{locationPrompt.status === "loading" ? "Locating…" : "Use my location"}</button>
        <button type="button" className="location-permission-dismiss" onClick={onDismissLocation}>Not now</button>
      </div> : null}
      <span className="map-legend"><PawPrint className="pet-paw" /> {petType === "All" ? "Pets" : `${petType}s`} {showEvents ? <><PawPrint className="event-paw" /> Events</> : null} <PawPrint className="discovery-paw" /> Web leads</span>
      <span className="map-attribution">Markers checked this session · Listing update times vary by provider</span>
    </div>
  </section>;
}

function normalizeEvent(event) {
  if (!event.starts_at) return event;
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const placeParts = [event.venue, event.city, event.country].filter((part, index, parts) =>
    part && !parts.slice(0, index).some(previous =>
      previous.toLocaleLowerCase().includes(part.toLocaleLowerCase())));
  return {
    ...event,
    month: start.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: start.toLocaleDateString("en-US", { day: "2-digit" }),
    date: start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    time: `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${end ? ` – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}`,
    place: placeParts.join(", "),
  };
}

function EventPanel({ events }) {
  if (!events.length) {
    return <article className="event-panel event-empty"><div className="event-label"><CalendarDays /> Verified events</div><h3>No verified events yet</h3><p>Partner events will appear here after their organizer and source are reviewed.</p></article>;
  }
  return <article className="event-panel"><div className="event-label"><CalendarDays /> Live dog adoption events</div><div className="event-list">{events.slice(0, 5).map(event => {
    const item = normalizeEvent(event);
    return <div className="event-content" key={item.id}><div className="event-date"><small>{item.month}</small><strong>{item.day}</strong></div><div><h3>{item.title}</h3><p>{item.time}</p><p><MapPin /> {item.place}</p>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">Official event details <ChevronRight /></a> : <span className="event-review">Confirm details with the organizer</span>}</div></div>;
  })}</div></article>;
}

const QUIZ_QUESTIONS = [
  { key: "home", title: "What’s your home like?", help: "This helps us understand the space a pet would share with you.", options: ["Apartment or condo", "House", "Townhome or duplex", "Other"] },
  { key: "energy", title: "What pace feels like you?", help: "Think about an ordinary week, not your most ambitious one.", options: ["Calm", "Balanced", "Active"] },
  { key: "kids", title: "Will this pet live with children?", help: "Shelter evaluations vary, so we’ll flag anything you should confirm.", options: ["Yes", "No"] },
  { key: "pets", title: "Any pets already at home?", help: "Choose the answer that best describes your household.", options: ["None", "Dogs", "Cats", "Dogs and cats"] },
  { key: "alone", title: "How often would they be home alone?", help: "A realistic answer helps us avoid mismatched expectations.", options: ["Rarely", "Sometimes", "Often"] },
  { key: "experience", title: "What’s your pet experience?", help: "Some animals thrive with first-time adopters; others need practiced handling.", options: ["First-time adopter", "Some experience", "Very experienced"] },
  { key: "species", title: "Who are you hoping to meet?", help: "You can keep this open and compare both.", options: ["Either", "Dog", "Cat"] },
];

function MatchResult({ match, rank }) {
  const { pet, score, reasons, considerations, questions } = match;
  return <article className="match-result">
    <span className="match-rank" aria-label={`Match ${rank}`}>{rank}</span>
    <img src={pet.image} alt={`${pet.name}, a ${pet.breed}`} />
    <div className="match-body">
      <div className="match-title"><div><h3>{pet.name}</h3><p>{[pet.breed, pet.age, pet.city].filter(Boolean).join(" · ")}</p></div><strong>{score}%<small>match</small></strong></div>
      <div className="match-evidence">
        <div><h4><CheckCircle2 /> Why this fits</h4>{reasons.length ? <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>We need more listing details to explain this match.</p>}</div>
        {considerations.length ? <div className="consider"><h4><AlertTriangle /> Things to consider</h4><p>{considerations[0]}</p></div> : null}
        {questions.length ? <div><h4><Info /> Ask the shelter</h4><ul>{questions.map(question => <li key={question}>{question}</li>)}</ul></div> : null}
      </div>
      {pet.sourceUrl ? <a className="button match-link" href={pet.sourceUrl} target="_blank" rel="noreferrer">View shelter listing <ExternalLink /></a> : <span className="match-link-unavailable">Shelter link unavailable</span>}
    </div>
  </article>;
}

function Matchmaker({ pets, feed, location, onLocationChange, onSpeciesChange, onFindLocation, locationState }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [complete, setComplete] = useState(false);
  const [consent, setConsent] = useState(false);
  const [aiState, setAiState] = useState({ status: "idle", matches: [], message: "" });
  const question = QUIZ_QUESTIONS[step];
  const rulesRanked = useMemo(() => rankPets(pets, answers).slice(0, 10), [pets, answers]);
  const ranked = useMemo(() => {
    if (aiState.status !== "success") return rulesRanked.slice(0, 5);
    const byId = new Map(pets.map(pet => [pet.id, pet]));
    return aiState.matches.map(match => ({ ...match, pet: byId.get(match.petId) }))
      .filter(match => match.pet).slice(0, 5);
  }, [aiState, pets, rulesRanked]);
  const choose = (value) => {
    const nextAnswers = { ...answers, [question.key]: value };
    setAnswers(nextAnswers);
    if (question.key === "species") onSpeciesChange(value === "Either" ? "All" : value);
    if (step === QUIZ_QUESTIONS.length - 1) setComplete(true);
    else setStep(current => current + 1);
  };
  const restart = () => {
    setComplete(false);
    setStarted(true);
    setStep(0);
    setConsent(false);
    setAiState({ status: "idle", matches: [], message: "" });
  };
  const analyzeWithAi = async () => {
    if (!consent || !rulesRanked.length) return;
    setAiState({ status: "loading", matches: [], message: "" });
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentToAiProcessing: true,
          answers,
          pets: rulesRanked.map(({ pet }) => pet),
        }),
      });
      const body = await readJson(response, "AI matching returned an invalid response.");
      if (!response.ok) throw new Error(body.error || "AI matching is unavailable.");
      setAiState({ status: "success", matches: body.matches || [], message: body.boundary });
    } catch (error) {
      setAiState({ status: "error", matches: [], message: error.message });
    }
  };

  return <section className={`matchmaker ${complete ? "is-complete" : ""}`} aria-labelledby="matchmaker-title">
    <div className="matchmaker-quiz">
      {!started ? <div className="match-intro">
        <div className="match-portrait"><img src={heroImage} alt="A dog and cat resting together" /></div>
        <h1 id="matchmaker-title">Find a pet who fits <em>your real life.</em></h1>
        <p>Answer a few practical questions and we’ll rank current shelter listings with clear reasons—not guesswork.</p>
        <Button onClick={() => setStarted(true)}>Start the match quiz <ChevronRight /></Button>
        <span><Clock3 /> About 2 minutes</span>
      </div> : !complete ? <>
        <div className="quiz-topline">
          <button className="quiz-back" onClick={() => step ? setStep(step - 1) : setStarted(false)}><ArrowLeft /> Back</button>
          <span><Clock3 /> About 2 minutes</span>
        </div>
        <div className="quiz-progress" aria-label={`Question ${step + 1} of ${QUIZ_QUESTIONS.length}`}><span style={{ width: `${((step + 1) / QUIZ_QUESTIONS.length) * 100}%` }} /></div>
        <div className="quiz-question">
          <p>Question {step + 1} of {QUIZ_QUESTIONS.length}</p>
          <h2>{question.title}</h2>
          <span>{question.help}</span>
          <div className="quiz-options">{question.options.map(option => <button key={option} className={answers[question.key] === option ? "selected" : ""} onClick={() => choose(option)}><span>{option}</span><ChevronRight /></button>)}</div>
        </div>
      </> : <div className="quiz-summary">
        <button className="quiz-back" onClick={restart}><ArrowLeft /> Start over</button>
        <p>Your match profile</p>
        <h2>Built around your everyday life.</h2>
        <dl>{QUIZ_QUESTIONS.map(item => <div key={item.key}><dt>{item.title}</dt><dd>{answers[item.key]}</dd></div>)}</dl>
        <button className="adjust-button" onClick={restart}><Pencil /> Adjust my answers</button>
      </div>}
      <div className="quiz-location"><MapPin /><label><span>Search area<small>Used to center nearby pets and events</small></span><input aria-label="City or postal code" value={location} onChange={event => onLocationChange(event.target.value)} /></label><button onClick={onFindLocation} disabled={locationState.status === "loading"}>{locationState.status === "loading" ? "Finding…" : "Update map"}</button></div>
      {locationState.message ? <p className={`location-state location-${locationState.status}`} role={locationState.status === "error" ? "alert" : "status"}>{locationState.message}</p> : null}
      <div className={`quiz-feed feed-${feed.mode}`}><Info /><span><strong>{feed.mode === "live" ? "Live adoptable pets" : feed.mode === "loading" ? "Checking live shelter listings" : "Live listings unavailable"}</strong>{feed.mode === "live" ? `${feed.count || pets.length} current records from ${feed.provider}. Always confirm availability with the shelter.` : feed.message || "No synthetic pet profiles are shown."}</span></div>
    </div>
    <div className="matchmaker-results" aria-live="polite">
      <div className="results-head"><div><h2>{complete ? "Your top matches nearby" : "Your matches will appear here"}</h2><p>{complete ? "Ranked from current listing facts and your answers" : "Finish the quiz to see transparent compatibility reasons."}</p></div>{complete ? <button onClick={restart}><Pencil /> Adjust my answers</button> : null}</div>
      {!complete ? <div className="results-placeholder"><PawPrint /><h3>No black-box recommendations</h3><p>We show what supported each match, what may not fit, and what the listing does not tell us.</p></div>
        : feed.mode === "loading" ? <div className="results-placeholder"><PawPrint /><h3>Loading current listings…</h3></div>
        : ranked.length ? <><div className="ai-controls">
          <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Send my quiz answers and these public listing facts to Vercel AI Gateway for a compatibility draft.</label>
          <Button onClick={analyzeWithAi} disabled={!consent || aiState.status === "loading"}>{aiState.status === "loading" ? "Analyzing…" : aiState.status === "success" ? "Refresh AI analysis" : "Analyze with AI"}</Button>
          <p className={aiState.status === "error" ? "form-error" : ""} role={aiState.status === "error" ? "alert" : "status"}>{aiState.message || "Until you request AI analysis, results use Pawline’s transparent listing-fact rules."}</p>
        </div><div className="match-list">{ranked.map((match, index) => <MatchResult key={match.pet.id} match={match} rank={index + 1} />)}</div></>
        : <div className="results-placeholder"><PawPrint /><h3>No verified matches available</h3><p>{feed.message || "Try adjusting your answers or check back when more shelter listings are available."}</p></div>}
    </div>
  </section>;
}

export default function App({ clerkPublishableKey = "" }) {
  const clerkConfigured = Boolean(clerkPublishableKey);
  const [saved, setSaved] = useState([]);
  const savedRef = useRef([]);
  const [savedHydrated, setSavedHydrated] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteSyncVersion, setFavoriteSyncVersion] = useState(0);
  const [species, setSpecies] = useState("All");
  const [location, setLocation] = useState("Pasadena, California, USA");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDiscovery, setSelectedDiscovery] = useState(null);
  const [messagePet, setMessagePet] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [remotePets, setRemotePets] = useState([]);
  const [remoteEvents, setRemoteEvents] = useState([]);
  const [remoteDiscoveries, setRemoteDiscoveries] = useState([]);
  const [communityLeads, setCommunityLeads] = useState([]);
  const [coordinates, setCoordinates] = useState({
    longitude: -118.1445,
    latitude: 34.1478,
    name: "Pasadena, California, USA",
  });
  const [locationState, setLocationState] = useState({ status: "idle", message: "" });
  const [userCoordinates, setUserCoordinates] = useState(null);
  const [locationPrompt, setLocationPrompt] = useState({ status: "idle", message: "" });
  const [feed, setFeed] = useState({ mode: "loading", message: "Checking trusted adoption sources…" });
  const [integrations, setIntegrations] = useState({ mapboxConfigured: null });
  const [activePanel, setActivePanel] = useState("explore");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mapPetType, setMapPetType] = useState("All");
  const [mapDistance, setMapDistance] = useState("150");
  const [showMapEvents, setShowMapEvents] = useState(true);
  const [densityMode, setDensityMode] = useState(false);
  const [hoursFilter, setHoursFilter] = useState("all");
  const [mapSearchMoved, setMapSearchMoved] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [accountSyncReady, setAccountSyncReady] = useState(false);
  const favoriteSyncRef = useRef(null);
  savedRef.current = saved;
  const loadAccountFavorites = useCallback(items => { savedRef.current = items; setSaved(items); setFavoriteError(""); }, []);
  const setFavoriteSession = useCallback(saveFavorite => {
    favoriteSyncRef.current = saveFavorite;
  }, []);
  const communityDiscoveries = useMemo(() => communityLeads
    .filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
    .map(item => ({
      ...item,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      title: item.name || "Community pet lead",
      source_url: item.sourceUrl,
      source_domain: item.sourceDomain,
      city: [item.city, item.country].filter(Boolean).join(", "),
      communityLead: true,
    })), [communityLeads]);
  const hoursFilteredPets = useMemo(() => hoursFilter === "known" ? remotePets.filter(pet => suppliedHours(pet)) : remotePets, [remotePets, hoursFilter]);
  const mapView = useMemo(() => buildMapView({
    pets: hoursFilteredPets,
    events: remoteEvents,
    discoveries: [...remoteDiscoveries, ...communityDiscoveries],
    center: coordinates,
    petType: mapPetType,
    distance: mapDistance,
    showEvents: showMapEvents,
  }), [hoursFilteredPets, remoteEvents, remoteDiscoveries, communityDiscoveries, coordinates, mapPetType, mapDistance, showMapEvents]);
  const routePets = useMemo(() => mapView.pets.filter(pet => saved.includes(pet.id)).slice(0, 8), [mapView.pets, saved]);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("pawline-saved") || "[]")); } catch { setSaved([]); setFavoriteError("Favorites could not be read from this browser."); }
    setSavedHydrated(true);
  }, []);
  useEffect(() => {
    if (!savedHydrated) return;
    try { localStorage.setItem("pawline-saved", JSON.stringify(saved)); }
    catch { setFavoriteError("Favorites could not be saved in this browser. Free storage space and retry."); }
  }, [saved, savedHydrated]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (species !== "All") params.set("species", species);
    fetch(`/api/pets?${params}`, { signal: controller.signal })
      .then(async response => {
        const body = await readJson(response, "Live feeds require the configured Pawline API.");
        if (!response.ok) throw new Error(body.message || "Feed unavailable");
        setRemotePets(body.pets || []);
        setFeed(body);
      })
      .catch(error => {
        if (error.name !== "AbortError") {
          setRemotePets([]);
          setFeed({ mode: "error", message: "Live feeds are temporarily unavailable." });
        }
      });
    return () => controller.abort();
  }, [species]);
  useEffect(() => {
    fetch("/api/events")
      .then(response => readJson(response, "Verified events require the configured Pawline API."))
      .then(body => setRemoteEvents(body.events || []))
      .catch(() => setRemoteEvents([]));
  }, []);
  useEffect(() => {
    fetch("/api/discoveries")
      .then(response => readJson(response, "Web discovery leads are unavailable."))
      .then(body => setRemoteDiscoveries(body.discoveries || []))
      .catch(() => setRemoteDiscoveries([]));
  }, []);
  useEffect(() => {
    fetch("/api/health")
      .then(response => readJson(response, "Integration status is unavailable."))
      .then(setIntegrations)
      .catch(() => setIntegrations({ mapboxConfigured: false }));
  }, []);

  const toggleSave = id => {
    if (clerkConfigured) setAccountSyncReady(true);
    const previousSaved = savedRef.current;
    const favorite = !previousSaved.includes(id);
    const nextSaved = favorite ? [...new Set([...previousSaved, id])] : previousSaved.filter(item => item !== id);
    setFavoriteError("");
    try {
      localStorage.setItem("pawline-saved", JSON.stringify(nextSaved));
    } catch {
      setFavoriteError("Favorites could not be saved in this browser. Free storage space and retry.");
      return;
    }
    savedRef.current = nextSaved;
    setSaved(nextSaved);
    favoriteSyncRef.current?.(id, favorite).catch((error) => {
      const current = savedRef.current;
      const restored = restoreFavoriteAfterFailure(current, id, favorite);
      try { localStorage.setItem("pawline-saved", JSON.stringify(restored)); }
      catch {
        setFavoriteError("Favorite cloud sync and browser rollback both failed. Retry favorites before making more changes.");
        return;
      }
      savedRef.current = restored;
      setSaved(restored);
      setFavoriteError(error.message || "Favorite could not be synchronized. Your previous state was restored.");
    });
  };
  const retryFavoriteSync = () => {
    try {
      localStorage.setItem("pawline-saved", JSON.stringify(saved));
      setFavoriteError("");
      if (clerkConfigured) { setAccountSyncReady(true); setFavoriteSyncVersion(value => value + 1); }
    } catch {
      setFavoriteError("Favorites still cannot be saved in this browser. Free storage space and retry.");
    }
  };
  const selectLocation = match => {
    const longitude = Number(match?.longitude);
    const latitude = Number(match?.latitude);
    if (!match?.name || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      setLocationState({ status: "error", message: "That location could not be placed on the map." });
      return;
    }
    setLocation(match.name);
    setCoordinates({ ...match, longitude, latitude });
    setMapSearchMoved(false);
    setLocationState({ status: "success", message: `Map centered on ${match.name}.` });
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
  };
  const findMatch = async () => {
    if (!location.trim()) {
      setLocationState({ status: "error", message: "Enter a city, state, or postal code." });
      return;
    }
    if (!integrations.mapboxConfigured) {
      setCoordinates(null);
      setLocationState({ status: "error", message: "Live location search is unavailable until the map provider is connected." });
      document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setLocationState({ status: "loading", message: "Finding that location…" });
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(location)}`);
      const body = await readJson(response, "Location search requires the configured Pawline API.");
      if (!response.ok) throw new Error(body.error || "Location search failed.");
      const match = body.results?.[0];
      if (!match) throw new Error("We could not find that location.");
      selectLocation(match);
    } catch (error) {
      setLocationState({ status: "error", message: error.message });
    }
  };
  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationPrompt({ status: "error", message: "Location sharing is not supported by this browser." });
      return;
    }
    setLocationPrompt({ status: "loading", message: "Waiting for your browser…" });
    navigator.geolocation.getCurrentPosition(
      position => {
        const next = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };
        setUserCoordinates(next);
        setCoordinates({ ...next, name: "Your location" });
        setLocation("Your location");
        setMapSearchMoved(false);
        setLocationState({ status: "success", message: "Your location is shown on the map." });
        setLocationPrompt({ status: "hidden", message: "" });
      },
      error => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location access was denied. You can enable it in your browser settings."
          : "We couldn’t get your location. Check your connection and try again.";
        setLocationPrompt({ status: "error", message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  const openPanel = panel => {
    if (["community", "messages"].includes(panel) && clerkConfigured) setAccountSyncReady(true);
    setActivePanel(panel);
    setRailCollapsed(false);
  };
  const toggleSavedOnly = () => {
    if (clerkConfigured) setAccountSyncReady(true);
    setShowSavedOnly(value => !value);
  };
  const resetMapFilters = () => {
    setMapPetType("All");
    setMapDistance("150");
    setShowMapEvents(true);
    setDensityMode(false);
    setHoursFilter("all");
  };
  const searchThisMapArea = ({ longitude, latitude }) => {
    setCoordinates(current => {
      if (current && Math.abs(current.longitude - longitude) < 0.0001 && Math.abs(current.latitude - latitude) < 0.0001) return current;
      return { longitude, latitude, name: current?.name || "Map area" };
    });
    setMapSearchMoved(true);
  };
  return <div className="app map-app">
    {clerkConfigured && accountSyncReady ? <Suspense fallback={null}><FavoritesSyncWithAuth key={favoriteSyncVersion} publishableKey={clerkPublishableKey} localFavorites={saved} onLoad={loadAccountFavorites} onSessionChange={setFavoriteSession} onError={setFavoriteError} /></Suspense> : null}
    {favoriteError ? <div className="favorites-sync-alert" role="alert"><span>{favoriteError}</span><button type="button" onClick={retryFavoriteSync}>Retry favorites</button></div> : null}
    <header className="map-app-header">
      <a className="brand" href="#map" aria-label="Pawline home"><span className="brand-mark"><PawPrint /></span><span>Pawline</span></a>
      <LocationAutocomplete value={location} mapboxConfigured={integrations.mapboxConfigured} locationState={locationState} onChange={setLocation} onSearch={findMatch} onSelect={selectLocation} />
      <div className="map-app-actions">
        <button className={`saved-action ${showSavedOnly ? "is-active" : ""}`} onClick={() => { openPanel("explore"); toggleSavedOnly(); }} aria-label={`${saved.length} favorite pets. ${showSavedOnly ? "Show all listings" : "Show favorites"}`} aria-pressed={showSavedOnly}><Heart fill={saved.length ? "currentColor" : "none"} /><span>Favorites</span>{saved.length ? <strong>{saved.length}</strong> : null}</button>
        <Button onClick={() => setSubmitOpen(true)} aria-label="List a pet"><span>List a pet</span><PawPrint /></Button>
      </div>
    </header>

  <main id="discover" className={`map-workspace panel-${activePanel} ${railCollapsed ? "rail-collapsed" : ""}`}>
      <MapPanel location={location} coordinates={coordinates} userCoordinates={userCoordinates} locationPrompt={locationPrompt} configured={integrations.mapboxConfigured} view={mapView} petType={mapPetType} showEvents={showMapEvents} densityMode={densityMode} routePets={routePets} onOpenPet={setSelectedPet} onOpenEvent={setSelectedEvent} onOpenDiscovery={setSelectedDiscovery} onMapMove={searchThisMapArea} onRequestLocation={requestUserLocation} onDismissLocation={() => setLocationPrompt({ status: "hidden", message: "" })} />

      <aside className={`map-rail ${railCollapsed ? "is-collapsed" : ""}`} aria-label="Map discovery tools">
        <button className="rail-toggle" type="button" onClick={() => setRailCollapsed(value => !value)} aria-expanded={!railCollapsed} aria-controls="map-rail-content">
          <ChevronRight />
          <span className="sr-only">{railCollapsed ? "Show discovery tools" : "Hide discovery tools"}</span>
        </button>
        <nav className="rail-tabs" aria-label="Discovery views">
          <button className={activePanel === "explore" ? "active" : ""} onClick={() => openPanel("explore")}><Search />Find pets</button>
          <button aria-label="Match quiz" className={activePanel === "match" ? "active" : ""} onClick={() => openPanel("match")}><PawPrint /><span className="rail-label-full">Match me</span><span className="rail-label-short" aria-hidden="true">Quiz</span></button>
          <details className={`rail-more ${["messages", "community", "events"].includes(activePanel) ? "active" : ""}`}>
            <summary><Menu />More</summary>
            <div>
              <button className={activePanel === "messages" ? "active" : ""} onClick={() => openPanel("messages")}><MessageCircle />Messages</button>
              <button className={activePanel === "community" ? "active" : ""} onClick={() => openPanel("community")}><MessageCircle />Community</button>
              <button className={activePanel === "events" ? "active" : ""} onClick={() => openPanel("events")}><CalendarDays />Events</button>
            </div>
          </details>
        </nav>
        <div id="map-rail-content" className="rail-content">
          {activePanel === "explore" ? <div className="explore-intro">
            <MapFilters petType={mapPetType} distance={mapDistance} showEvents={showMapEvents} densityMode={densityMode} hoursFilter={hoursFilter} onPetTypeChange={setMapPetType} onDistanceChange={setMapDistance} onShowEventsChange={setShowMapEvents} onDensityChange={setDensityMode} onHoursFilterChange={setHoursFilter} onReset={resetMapFilters} />
            <div className="explore-heading"><div><h1>Find adoptable pets</h1><span className={`live-state feed-${feed.mode}`}><i />{feed.mode === "live" ? "Current listings" : feed.mode === "loading" ? "Checking listings" : "Listings unavailable"}</span></div><button type="button" className="mobile-view-map" onClick={() => setRailCollapsed(true)}><Compass /> View map</button></div>
            <p>{feed.mode === "live" ? `${petCountLabel(mapView.pets.length, mapPetType)} within ${mapDistance} miles. Open a pet to see details and the shelter's listing.` : feed.message || "Current shelter listings are unavailable. Pawline does not show made-up pets."}</p>
            {mapSearchMoved ? <p className="map-area-status" role="status">Showing results around the map center.</p> : null}
            <MapResults view={mapView} saved={saved} showSavedOnly={showSavedOnly} onToggleSavedOnly={toggleSavedOnly} onSave={toggleSave} onOpenPet={setSelectedPet} onOpenEvent={setSelectedEvent} onOpenDiscovery={setSelectedDiscovery} />
            {routePets.length ? <VisitPlanner pets={routePets} location={location} /> : null}
            <button className="quiz-teaser" onClick={() => openPanel("match")}><PawPrint /><span><small>Not sure where to start?</small><strong>Get pet matches</strong><em>Answer a few lifestyle questions</em></span><ChevronRight /></button>
            {remoteDiscoveries.length ? <section className="web-leads" aria-label="Current web adoption leads">
              <div><Globe2 /><span><small>Web discovery</small><strong>Fresh adoption leads</strong></span></div>
              <p>Search results are approximate map leads, not shelter-verified pet records.</p>
              {remoteDiscoveries.slice(0, 3).map(item => <a key={item.id} href={item.source_url} target="_blank" rel="noreferrer">
                <span>{item.title}</span><small>{item.city} · {item.source_domain}</small>
              </a>)}
            </section> : null}
            <details className="source-methodology">
              <summary><ShieldCheck /> How listings are checked</summary>
              <ShieldCheck />
              <div>
                <h2>How Pawline finds adoptable pets</h2>
                <p>Current pet records come from official shelter feeds, authorized providers, or reviewed Pawline records. We link to the original listing so you can confirm availability and adoption requirements with the shelter.</p>
                <p>Approximate web leads are labeled separately and never presented as verified animals. Pawline does not substitute demo pets when live sources are unavailable.</p>
                <a href="/llms-full.txt">Read our source and matching methodology <ChevronRight /></a>
              </div>
            </details>
          </div> : null}
          {activePanel === "match" ? <Matchmaker pets={remotePets} feed={feed} location={location} onLocationChange={setLocation} onSpeciesChange={setSpecies} onFindLocation={findMatch} locationState={locationState} /> : null}
          {activePanel === "events" ? <EventPanel events={remoteEvents} /> : null}
          {activePanel === "messages" ? clerkConfigured
            ? <Suspense fallback={<div className="community-auth-state" role="status"><span><MessageCircle /></span><h2>Opening Messages…</h2></div>}><DirectMessages initialListing={messagePet} onInitialListingHandled={() => setMessagePet(null)} onBrowse={() => openPanel("explore")} /></Suspense>
            : <div className="community-auth-state"><span><MessageCircle /></span><h2>Messages need an account</h2><p>Configure Pawline Clerk to let shelters, fosters, and adopters register and message privately.</p><div className="auth-safety"><ShieldCheck /><span><strong>Failing closed</strong>Private listing chat never opens without verified identity.</span></div></div>
          : null}
          {activePanel === "community" ? clerkConfigured
            ? <Suspense fallback={<div className="community-auth-state" role="status"><span><MessageCircle /></span><h2>Opening the community…</h2></div>}><CommunityWithAuth publishableKey={clerkPublishableKey} onLeadsChange={setCommunityLeads} /></Suspense>
            : <div className="community-auth-state"><span><MessageCircle /></span><h2>Community needs Clerk</h2><p>Add the Pawline Clerk publishable key to enable account creation and sign-in. Chat stays closed until identity is configured.</p><div className="auth-safety"><ShieldCheck /><span><strong>Failing closed</strong>No anonymous or unverified chat access is allowed.</span></div></div>
          : null}
        </div>
      </aside>

    </main>
    {submitOpen && (clerkConfigured ? <Suspense fallback={<Dialog title="List a pet" onClose={() => setSubmitOpen(false)}><div className="community-auth-state"><h2>Opening your account…</h2></div></Dialog>}><SubmissionWithAuth onClose={() => setSubmitOpen(false)} onAuthenticated={getToken => <SubmissionForm onClose={() => setSubmitOpen(false)} getToken={getToken} />} /></Suspense> : <Dialog title="List a pet" onClose={() => setSubmitOpen(false)}><div className="community-auth-state"><span><PawPrint /></span><h2>Registration needs an account</h2><p>Pawline requires sign-in before a foster, shelter, or caretaker can create a listing and receive private messages.</p></div></Dialog>)}
    {selectedPet && <PetDetail pet={selectedPet} onClose={() => setSelectedPet(null)} saved={saved.includes(selectedPet.id)} onSave={toggleSave} onMessage={pet => { setMessagePet(pet); openPanel("messages"); }} />}
    {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    {selectedDiscovery && <DiscoveryDetail discovery={selectedDiscovery} onClose={() => setSelectedDiscovery(null)} />}
  </div>;
}
