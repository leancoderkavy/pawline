"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarClock, Check, CheckCircle2, ChevronRight, ClipboardList,
  Compass, ExternalLink, Heart, House, Info, Map, MapPin, MessageCircle,
  PawPrint, Search, ShieldCheck, Sparkles, UserRound, UsersRound,
} from "lucide-react";
import { rankPets } from "./matching";
import ApplicationCoach from "./ApplicationCoach";
import {
  APPLICATION_STATUS, DEFAULT_PROFILE, JOURNEY_STEPS, PROFILE_FIELDS,
  applicationStatus, createApplicationDraft, nextApplicationStatus, normalizeAdopterProfile,
  profileReadiness, safeHttpUrl,
} from "./adopterJourney";

const STORAGE_KEY = "pawline-adopter-journey-v1";

function suppliedHours(item) {
  return typeof item?.hours === "string" && item.hours.trim()
    ? item.hours.trim()
    : typeof item?.todayHours === "string" && item.todayHours.trim()
      ? item.todayHours.trim()
      : null;
}

function loadLocalJourney() {
  if (typeof window === "undefined") return { profile: DEFAULT_PROFILE, applications: [] };
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      // Guest storage deliberately contains preference choices only. Household
      // names, accessibility notes, and any application text stay in memory.
      profile: normalizeAdopterProfile({
        species: stored.profile?.species,
        home: stored.profile?.home,
        energy: stored.profile?.energy,
        kids: stored.profile?.kids,
        pets: stored.profile?.pets,
        alone: stored.profile?.alone,
        experience: stored.profile?.experience,
        distance: stored.profile?.distance,
      }),
      applications: [],
    };
  } catch {
    return { profile: DEFAULT_PROFILE, applications: [] };
  }
}

async function authorizedJson(getToken, path, options = {}) {
  const token = await getToken();
  if (!token) throw new Error("Sign in to use this private adoption feature.");
  const response = await fetch(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Pawline returned an invalid private-data response.");
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "This private adoption feature is unavailable.");
  return body;
}

function resultFreshness(pet) {
  if (pet.status && pet.status !== "available") return "Status needs confirmation";
  if (pet.verified_at || pet.verifiedAt) return "Provider-verified listing";
  return "Confirm with the shelter";
}

function NavButton({ active, icon: Icon, children, onClick }) {
  return <button type="button" className={active ? "journey-nav-active" : ""} onClick={onClick} aria-current={active ? "page" : undefined}><Icon aria-hidden="true" /><span>{children}</span></button>;
}

function ProfileReadiness({ profile, onEdit }) {
  const readiness = profileReadiness(profile);
  return <section className="journey-card readiness-card" aria-labelledby="readiness-title"><div className="journey-card-heading"><span><UserRound /></span><div><p className="eyebrow">Profile readiness</p><h2 id="readiness-title">A little context makes matches clearer.</h2></div></div><div className="readiness-meter" aria-label={`${readiness.percent}% of core preferences complete`}><span style={{ width: `${readiness.percent}%` }} /></div><p>{readiness.complete} of {readiness.total} household details complete. Missing facts stay visible rather than being guessed.</p><button type="button" className="text-action" onClick={onEdit}>{readiness.missing.length ? "Finish profile" : "Review preferences"} <ChevronRight /></button></section>;
}

function JourneyTimeline({ application }) {
  const current = applicationStatus(application?.status || "draft");
  const activeIndex = application?.status === "adopted" ? 4 : application?.status === "meet_and_greet" || application?.status === "approved" ? 3 : application ? 2 : 0;
  return <section className="journey-card timeline-card" aria-labelledby="timeline-title"><div className="journey-card-heading"><span><ClipboardList /></span><div><p className="eyebrow">Your adoption journey</p><h2 id="timeline-title">{application ? `${application.petName} is in progress` : "Take it one thoughtful step at a time."}</h2></div></div>{application ? <p><strong className={`status-badge status-${current.tone}`}>{current.label}</strong> {application.status === "awaiting_participation" ? "Your answers are still private; Pawline has not shared them with the shelter." : `Your application is linked to ${application.shelter}.`}</p> : <p>Start with your household preferences, then use each listing’s source link to confirm the next step.</p>}<ol className="journey-timeline">{JOURNEY_STEPS.map((step, index) => <li key={step} className={index <= activeIndex ? "complete" : ""}><span>{index < activeIndex ? <Check /> : index + 1}</span>{step}</li>)}</ol></section>;
}

function MatchCard({ match, saved, onSave, onOpen }) {
  const { pet, reasons, considerations, questions } = match;
  return <article className="journey-pet-card"><img src={pet.image} alt={`${pet.name}${pet.breed ? `, a ${pet.breed}` : ""}`} /><div><div className="pet-card-topline"><p className="eyebrow">{resultFreshness(pet)}</p><button type="button" className={saved ? "journey-heart saved" : "journey-heart"} onClick={() => onSave(pet.id)} aria-label={`${saved ? "Remove" : "Save"} ${pet.name}`}><Heart fill={saved ? "currentColor" : "none"} /></button></div><h3>{pet.name}</h3><p className="pet-card-meta">{[pet.breed, pet.age, pet.city].filter(Boolean).join(" · ")}</p>{reasons[0] ? <p className="fit-reason"><CheckCircle2 /> {reasons[0]}</p> : null}{considerations[0] ? <p className="fit-consider"><Info /> {considerations[0]}</p> : null}{questions[0] ? <p className="fit-question">Ask: {questions[0]}</p> : null}<button type="button" className="text-action" onClick={() => onOpen(pet)}>See fit details <ChevronRight /></button></div></article>;
}

function Discovery({ pets, profile, saved, onSave, onOpen, onOpenMap, feed }) {
  const [species, setSpecies] = useState(profile.species === "Either" ? "All" : profile.species || "All");
  const ranked = useMemo(() => rankPets(pets, { ...profile, species: species === "All" ? "Either" : species }), [pets, profile, species]);
  const isLoading = feed?.mode === "loading";
  const unavailable = feed?.mode === "error";
  const emptyHeading = isLoading ? "Current listings are loading." : unavailable ? "Current listings are temporarily unavailable." : "No current listings match this view.";
  const emptyMessage = isLoading
    ? "Pawline is checking current shelter feeds. We will show listings only after they arrive."
    : unavailable
      ? "Pawline could not load live shelter feeds just now. Please try again shortly."
      : "Pawline never fills empty results with pretend pets. Change the filters or check back after the shelter feeds refresh.";
  return <section className="journey-content" aria-labelledby="discover-title"><header className="journey-page-heading"><div><p className="eyebrow">Discover</p><h1 id="discover-title">Current pets, shown with their evidence.</h1><p>Start with the map to plan a visit, or browse the evidence-backed list.</p></div><button type="button" className="outline-action" onClick={onOpenMap}><Map /> Open adoption map</button></header><div className="discovery-controls" role="group" aria-label="Pet type"><span>Show</span>{["All", "Dog", "Cat"].map(option => <button key={option} type="button" className={species === option ? "selected" : ""} onClick={() => setSpecies(option)} aria-pressed={species === option}>{option === "All" ? "All pets" : `${option}s`}</button>)}</div>{ranked.length ? <div className="journey-pet-grid">{ranked.map(match => <MatchCard key={match.pet.id} match={match} saved={saved.includes(match.pet.id)} onSave={onSave} onOpen={onOpen} />)}</div> : <div className="journey-empty" role={isLoading ? "status" : undefined}><PawPrint /><h2>{emptyHeading}</h2><p>{emptyMessage}</p></div>}</section>;
}

function PetPage({ pet, profile, saved, onSave, onBack, onStartApplication }) {
  const match = useMemo(() => rankPets([pet], profile)[0], [pet, profile]);
  const sourceUrl = safeHttpUrl(pet.sourceUrl || pet.source_url);
  const directionsUrl = pet.latitude != null && pet.longitude != null
    && Number.isFinite(Number(pet.latitude)) && Number.isFinite(Number(pet.longitude))
    ? `https://www.google.com/maps/dir/?api=1&destination=${pet.latitude},${pet.longitude}` : null;
  return <section className="journey-pet-page" aria-labelledby="pet-page-title">
    <button type="button" className="back-action" onClick={onBack}><ArrowLeft /> Back to pets</button>
    <div className="pet-page-sticky"><button type="button" onClick={() => onStartApplication(pet)}><ClipboardList /> Start application</button>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">External route <ExternalLink /></a> : null}</div>
    <div className="journey-pet-layout"><div className="pet-page-image"><img src={pet.image} alt={`${pet.name}${pet.breed ? `, a ${pet.breed}` : ""}`} /></div><div className="pet-page-main"><p className="eyebrow">{resultFreshness(pet)}</p><h1 id="pet-page-title">{pet.name}</h1><p className="pet-page-meta">{[pet.species, pet.breed, pet.age, pet.size, pet.sex].filter(Boolean).join(" · ")}</p><p className="pet-page-location"><MapPin /> {pet.address || pet.city || "Location available from the official listing"}</p><section className="fit-panel"><h2>What Pawline can explain</h2>{match?.reasons.length ? <ul>{match.reasons.map(reason => <li key={reason}><CheckCircle2 /> {reason}</li>)}</ul> : <p>There are not enough public listing facts to assess fit yet.</p>}{match?.considerations.length ? <ul className="considerations">{match.considerations.map(item => <li key={item}><Info /> {item}</li>)}</ul> : null}{match?.questions.length ? <div><h3>Questions to ask the shelter</h3><ul>{match.questions.map(question => <li key={question}>{question}</li>)}</ul></div> : null}</section><section className="shelter-facts"><h2>About this listing</h2><p><ShieldCheck /> {pet.shelter || "Listed organization"}</p><p><CalendarClock /> {suppliedHours(pet) || "Hours were not supplied by this listing. Confirm before visiting."}</p><p><Info /> Availability and adoption requirements should be confirmed with the shelter.</p></section><div className="pet-page-actions"><button type="button" className="outline-action" onClick={() => onSave(pet.id)}><Heart fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save pet"}</button>{directionsUrl ? <a className="outline-action" href={directionsUrl} target="_blank" rel="noreferrer"><Compass /> Directions</a> : null}{sourceUrl ? <a className="outline-action" href={sourceUrl} target="_blank" rel="noreferrer">Official listing <ExternalLink /></a> : null}</div></div></div>
  </section>;
}

function Profile({ profile, onChange, onSave, isSignedIn }) {
  const [collaborator, setCollaborator] = useState("");
  const update = (key, value) => onChange({ ...profile, [key]: value });
  const addCollaborator = () => {
    const name = collaborator.trim();
    if (!name) return;
    onChange({ ...profile, collaborators: [...profile.collaborators, name].slice(0, 4) });
    setCollaborator("");
  };
  return <section className="journey-content profile-page" aria-labelledby="profile-title"><header className="journey-page-heading"><div><p className="eyebrow">Profile</p><h1 id="profile-title">Tell us about the life you can share.</h1><p>Use this to clarify matches. Pawline does not turn it into an applicant score.</p></div></header><div className="profile-grid">{PROFILE_FIELDS.map(field => <label key={field.key}>{field.label}<select value={profile[field.key]} onChange={event => update(field.key, event.target.value)}>{field.options.map(option => <option key={option} value={option}>{option || "Choose one"}</option>)}</select></label>)}<label>Preferred distance<select value={profile.distance} onChange={event => update("distance", event.target.value)}><option value="25">Within 25 miles</option><option value="50">Within 50 miles</option><option value="100">Within 100 miles</option></select></label><label>Accessibility or visit needs (optional)<input value={profile.accessibility} maxLength="160" onChange={event => update("accessibility", event.target.value)} placeholder="e.g. step-free visit access" /></label></div><section className="household-panel"><div><UsersRound /><div><h2>Household context</h2><p>One verified adult owns an application. Pawline records these names as your private notes; collaborator invitations are not enabled in this release.</p></div></div><label>Household name (optional)<input value={profile.householdName} maxLength="80" onChange={event => update("householdName", event.target.value)} placeholder="The Martinez household" /></label><div className="collaborator-row"><input value={collaborator} onChange={event => setCollaborator(event.target.value)} maxLength="80" placeholder="Add a household member’s first name" /><button type="button" onClick={addCollaborator}>Add</button></div>{profile.collaborators.length ? <ul>{profile.collaborators.map(name => <li key={name}>{name}<button type="button" onClick={() => onChange({ ...profile, collaborators: profile.collaborators.filter(item => item !== name) })} aria-label={`Remove ${name}`}>Remove</button></li>)}</ul> : null}</section><div className="profile-save"><button type="button" onClick={onSave}><Check /> Save preferences</button><p>{isSignedIn ? "Save private preferences and household context to your Pawline account." : "You can explore without an account. Only non-sensitive matching preferences are saved in this browser."}</p></div></section>;
}

function HeldApplicationNotice({ application }) {
  if (application.status !== "awaiting_participation" || !application.heldInvitationState) return null;
  const detail = {
    invite_queued: {
      title: "Invitation queued for review",
      message: "Pawline queued a reviewed invitation for this organization to claim or update its listing. It is not a confirmation that the organization has received, accepted, or enabled applications.",
    },
    invite_already_queued: {
      title: "Invitation already queued",
      message: "A reviewed invitation for this organization is already queued. Pawline will not create a duplicate or claim that the organization has enabled applications.",
    },
    manual_contact_required: {
      title: "Use the official route",
      message: "Pawline could not safely queue an invitation from the available public evidence. Contact the organization through its official route to ask about its current application process.",
    },
  }[application.heldInvitationState];
  if (!detail) return null;
  return <aside className="held-application-notice" role="status"><Info aria-hidden="true" /><div><strong>{detail.title}</strong><p>{detail.message}</p><p><b>No answers have been shared with the organization.</b> This draft remains private and is purged after its 30-day hold ends.</p></div></aside>;
}

function ApplicationForm({ application, onUpdate, onSaveDraft, onSubmitApplication, onOpenSource, getToken }) {
  const [heldConsent, setHeldConsent] = useState(false);
  const [sharedFields, setSharedFields] = useState({ household: false, carePlan: true, schedule: true, notes: false });
  const [state, setState] = useState({ status: "idle", message: "" });
  const updateAnswer = (key, value) => onUpdate({ ...application, coreAnswers: { ...application.coreAnswers, [key]: value }, updatedAt: new Date().toISOString() });
  const save = async () => { setState({ status: "loading", message: "" }); const result = await onSaveDraft(application, { heldDataConsent: heldConsent }); setState(result?.error ? { status: "error", message: result.error } : { status: "saved", message: "Draft saved privately." }); };
  const submit = async () => { setState({ status: "loading", message: "" }); const core = Object.keys(sharedFields).filter(key => sharedFields[key] && application.coreAnswers[key]); const result = await onSubmitApplication(application, { core, addOn: [] }); setState(result?.error ? { status: "error", message: result.error } : { status: "saved", message: "Application submitted. The organization can now review only the selected fields." }); };
  const canSubmit = Boolean(application.applicationEnabled && !String(application.id).startsWith("local-") && application.status === "draft");
  return <section className="application-form" aria-labelledby="application-form-title"><header><p className="eyebrow">Reusable core application</p><h2 id="application-form-title">{application.petName}</h2><p>Review your draft and decide exactly which fields Pawline may share.</p></header><label>Who is in your household?<textarea value={application.coreAnswers.household} maxLength="1000" onChange={event => updateAnswer("household", event.target.value)} placeholder="Adults, children, and resident animals who will share care." /></label><label>Describe your care plan<textarea value={application.coreAnswers.carePlan} maxLength="1200" onChange={event => updateAnswer("carePlan", event.target.value)} placeholder="How you will handle routine care, training, exercise, and veterinary care." /></label><ApplicationCoach question="Describe your care plan" answer={application.coreAnswers.carePlan} getToken={getToken} onAccept={suggestion => updateAnswer("carePlan", suggestion)} /><label>What does a typical weekday look like?<textarea value={application.coreAnswers.schedule} maxLength="1200" onChange={event => updateAnswer("schedule", event.target.value)} placeholder="Share a truthful outline of time at home, work, and care coverage." /></label><label>Anything you want the shelter to know? (optional)<textarea value={application.coreAnswers.notes} maxLength="1200" onChange={event => updateAnswer("notes", event.target.value)} /></label>{!application.applicationEnabled ? <label className="coach-consent"><input type="checkbox" checked={heldConsent} onChange={event => setHeldConsent(event.target.checked)} /> <span>I consent to Pawline holding this private draft for up to 30 days while this organization is not participating. It will not be shared.</span></label> : <fieldset className="application-share-fields"><legend>Share only these fields</legend>{Object.keys(sharedFields).map(key => <label key={key}><input type="checkbox" checked={sharedFields[key]} onChange={event => setSharedFields(current => ({ ...current, [key]: event.target.checked }))} /> {key === "carePlan" ? "Care plan" : key === "schedule" ? "Weekday schedule" : key === "household" ? "Household" : "Optional note"}</label>)}</fieldset>}<aside className="share-review"><ShieldCheck /><div><strong>{application.applicationEnabled ? "Pawline applications are enabled" : "This organization has not enabled Pawline applications"}</strong><p>{application.applicationEnabled ? "Save your draft first, then submit the exact fields you selected. Pawline will not share unselected fields." : "Use the official route at any time. A held draft is private and is purged after 30 days."}</p></div></aside><HeldApplicationNotice application={application} />{state.message ? <p className={state.status === "error" ? "coach-error" : "coach-manual"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}<div className="application-form-actions">{application.sourceUrl ? <button type="button" className="outline-action" onClick={onOpenSource}>View official route <ExternalLink /></button> : null}<button type="button" onClick={save} disabled={state.status === "loading" || (!application.applicationEnabled && !heldConsent)}>Save private draft <ChevronRight /></button>{canSubmit ? <button type="button" className="outline-action" onClick={submit} disabled={state.status === "loading"}>Submit selected fields <ChevronRight /></button> : null}</div></section>;
}

function AdoptionLifecycle({ application, checkin, isSignedIn, onConfirmOutcome, onConfirmCheckin }) {
  const [outcome, setOutcome] = useState("adopted");
  const [placementState, setPlacementState] = useState("continues");
  const [state, setState] = useState({ status: "idle", message: "" });
  const dueAt = checkin?.dueAt ? new Date(checkin.dueAt) : null;
  const checkinDue = Boolean(dueAt && Number.isFinite(dueAt.getTime()) && dueAt.getTime() <= Date.now() && !checkin.confirmedAt);
  const dueLabel = dueAt && Number.isFinite(dueAt.getTime()) ? dueAt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;
  useEffect(() => setState({ status: "idle", message: "" }), [application.id, application.status, checkin?.confirmedAt]);
  const confirmOutcome = async () => {
    setState({ status: "loading", message: "" });
    const result = await onConfirmOutcome(application, outcome);
    setState(result?.error
      ? { status: "error", message: result.error }
      : { status: "saved", message: "Your confirmation is recorded. Pawline waits for the organization’s matching confirmation before changing the application outcome." });
  };
  const confirmCheckin = async () => {
    setState({ status: "loading", message: "" });
    const result = await onConfirmCheckin(application, placementState);
    setState(result?.error ? { status: "error", message: result.error } : { status: "saved", message: "Thank you for sharing a placement update." });
  };
  if (!isSignedIn || !["adoption_pending", "adopted"].includes(application.status)) return null;
  return <section className="adoption-lifecycle" aria-labelledby="adoption-lifecycle-title"><div><p className="eyebrow">After adoption</p><h2 id="adoption-lifecycle-title">Keep the outcome accurate.</h2><p>Pawline records your confirmation separately from the organization’s. It does not infer an adoption from messages or an application status.</p></div>{application.status === "adoption_pending" ? <div className="lifecycle-action"><label>What happened with {application.petName}?<select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="adopted">The adoption happened</option><option value="not_adopted">It did not go ahead</option><option value="placement_changed">The placement changed</option></select></label><button type="button" onClick={confirmOutcome} disabled={state.status === "loading"}>Confirm outcome <ChevronRight /></button></div> : checkin?.confirmedAt ? <p className="lifecycle-complete"><CheckCircle2 /> Your 30-day placement update is complete.</p> : checkinDue ? <div className="lifecycle-action"><label>How is placement going?<select value={placementState} onChange={event => setPlacementState(event.target.value)}><option value="continues">The placement continues</option><option value="changed">The placement changed</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><button type="button" onClick={confirmCheckin} disabled={state.status === "loading"}>Share 30-day update <ChevronRight /></button></div> : <p className="lifecycle-wait"><CalendarClock /> {dueLabel ? `Your optional 30-day check-in opens on ${dueLabel}.` : "Pawline will offer a 30-day check-in when it is due."}</p>}{state.message ? <p className={state.status === "error" ? "coach-error" : "coach-manual"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}</section>;
}

function Applications({ applications, selectedApplication, onSelect, onUpdate, onSaveDraft, onSubmitApplication, onConfirmOutcome, onConfirmCheckin, checkins, isSignedIn, onDiscover, getToken }) {
  const application = selectedApplication || applications[0];
  if (!application) return <section className="journey-content"><header className="journey-page-heading"><div><p className="eyebrow">Applications</p><h1>One place for thoughtful next steps.</h1><p>Start from a current pet listing to build a reusable core application.</p></div></header><div className="journey-empty"><ClipboardList /><h2>No applications yet.</h2><p>Pawline will never submit an application automatically or claim a shelter has reviewed it.</p><button type="button" onClick={onDiscover}>Explore current pets</button></div></section>;
  return <section className="journey-content applications-page" aria-labelledby="applications-title"><header className="journey-page-heading"><div><p className="eyebrow">Applications</p><h1 id="applications-title">Keep the conversation and next step together.</h1><p>Private drafts persist only after Pawline’s authenticated workflow confirms them.</p></div></header><div className="application-layout"><aside className="application-list" aria-label="Your applications">{applications.map(item => { const status = applicationStatus(item.status); return <button type="button" key={item.id} className={item.id === application.id ? "selected" : ""} onClick={() => onSelect(item.id)}><strong>{item.petName}</strong><span>{item.shelter}</span><em className={`status-badge status-${status.tone}`}>{status.label}</em></button>; })}</aside><div className="application-detail"><ApplicationForm application={application} getToken={getToken} onUpdate={onUpdate} onSaveDraft={onSaveDraft} onSubmitApplication={onSubmitApplication} onOpenSource={() => { const url = safeHttpUrl(application.sourceUrl); if (url) window.open(url, "_blank", "noopener,noreferrer"); }} /><AdoptionLifecycle application={application} checkin={checkins.find(item => item.applicationId === application.id)} isSignedIn={isSignedIn} onConfirmOutcome={onConfirmOutcome} onConfirmCheckin={onConfirmCheckin} /></div></div></section>;
}

function ApplicationMessages({ applications, isSignedIn, getToken, onDiscover }) {
  const available = applications.filter(item => ["submitted", "reviewing", "follow_up_needed", "meet_and_greet", "approved", "adoption_pending"].includes(item.status));
  const [applicationId, setApplicationId] = useState(available[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState({ status: "idle", message: "" });
  const active = available.find(item => item.id === applicationId) || available[0];
  useEffect(() => { setApplicationId(current => available.some(item => item.id === current) ? current : available[0]?.id || ""); }, [applications.length]);
  useEffect(() => {
    if (!isSignedIn || !active || typeof getToken !== "function") { setMessages([]); return undefined; }
    let alive = true;
    authorizedJson(getToken, `/api/adoption-application-messages?applicationId=${encodeURIComponent(active.id)}`)
      .then(result => { if (alive) setMessages(result.messages || []); })
      .catch(error => { if (alive) setState({ status: "error", message: error.message }); });
    return () => { alive = false; };
  }, [active?.id, isSignedIn, getToken]);
  const send = async () => {
    if (!active || !draft.trim()) return;
    setState({ status: "loading", message: "" });
    try {
      const result = await authorizedJson(getToken, "/api/adoption-application-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: active.id, body: draft }) });
      setMessages(current => [...current, result.message]); setDraft(""); setState({ status: "ready", message: "Message sent." });
    } catch (error) { setState({ status: "error", message: error.message }); }
  };
  if (!isSignedIn) return <section className="journey-content"><header className="journey-page-heading"><div><p className="eyebrow">Messages</p><h1>Keep adoption conversations private.</h1><p>Sign in before Pawline can show or send application-linked messages.</p></div></header><div className="journey-empty"><MessageCircle /><h2>Private messages need an account.</h2><p>Guest browsing stays open, but no anonymous application conversation is created.</p></div></section>;
  if (!active) return <section className="journey-content"><header className="journey-page-heading"><div><p className="eyebrow">Messages</p><h1>Messages open after a confirmed submission.</h1><p>Drafts and held applications are not visible to organizations and cannot start a conversation.</p></div></header><div className="journey-empty"><MessageCircle /><h2>No application conversations yet.</h2><p>When an organization-enabled application is submitted, its messages will appear here.</p><button type="button" onClick={onDiscover}>Explore current pets</button></div></section>;
  return <section className="journey-content application-messages" aria-labelledby="application-messages-title"><header className="journey-page-heading"><div><p className="eyebrow">Messages</p><h1 id="application-messages-title">{active.petName}</h1><p>Private, application-linked conversation with {active.shelter}.</p></div><select value={active.id} onChange={event => setApplicationId(event.target.value)} aria-label="Choose application conversation">{available.map(item => <option key={item.id} value={item.id}>{item.petName} — {item.shelter}</option>)}</select></header><div className="message-thread" aria-live="polite">{messages.length ? messages.map(message => <p key={message.id} className={`message-${message.senderRole}`}><strong>{message.senderRole === "organization" ? active.shelter : "You"}</strong>{message.body}</p>) : <p className="message-empty">No messages yet. You can follow up once, or wait for the organization to review the submitted application.</p>}</div><label className="message-compose">Reply<textarea value={draft} maxLength="4000" onChange={event => setDraft(event.target.value)} placeholder="Write a concise, respectful follow-up." /></label>{state.message ? <p className={state.status === "error" ? "coach-error" : "coach-manual"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}<button type="button" className="message-send" onClick={send} disabled={!draft.trim() || state.status === "loading"}>Send message <ChevronRight /></button></section>;
}

function Home({ profile, applications, pets, saved, onSave, onOpen, onNavigate, isSignedIn }) {
  const readiness = profileReadiness(profile);
  const ranked = useMemo(() => rankPets(pets, profile).slice(0, 3), [pets, profile]);
  const activeApplication = applications.find(item => !["declined", "withdrawn", "adopted"].includes(item.status));
  return <section className="journey-content home-page" aria-labelledby="home-title"><header className="journey-hero"><div><p className="eyebrow">Your adoption journey</p><h1 id="home-title">Find the right next step, not just the next pet.</h1><p>Pawline keeps your household preferences, current listing facts, and application progress together—without deciding for you.</p>{!isSignedIn ? <p className="journey-guest-note"><Info /> You are browsing as a guest. Sign in to use private messaging or request an AI-assisted writing suggestion.</p> : null}<div><button type="button" onClick={() => onNavigate("discover")}>Discover pets <Search /></button><button type="button" className="outline-action" onClick={() => onNavigate("profile")}>Update profile <UserRound /></button></div></div><aside><span><PawPrint /></span><strong>{readiness.percent}% ready</strong><p>Complete your profile to make match explanations more useful.</p></aside></header><div className="home-grid"><JourneyTimeline application={activeApplication} /><ProfileReadiness profile={profile} onEdit={() => onNavigate("profile")} /></div><section className="home-matches" aria-labelledby="home-matches-title"><header><div><p className="eyebrow">Matches near you</p><h2 id="home-matches-title">Supported by listing facts, never guesswork.</h2></div><button type="button" className="text-action" onClick={() => onNavigate("discover")}>View all pets <ChevronRight /></button></header>{ranked.length ? <div className="journey-pet-grid">{ranked.map(match => <MatchCard key={match.pet.id} match={match} saved={saved.includes(match.pet.id)} onSave={onSave} onOpen={onOpen} />)}</div> : <div className="journey-empty"><PawPrint /><h3>Current listings are loading.</h3><p>When the feed is unavailable, Pawline leaves this honest and empty.</p></div>}</section></section>;
}

export default function AdopterExperience({ pets, saved, onSave, clerkConfigured, isSignedIn = false, initialView = "discover", authAction = null, onOpenMap, onOpenMessages, getToken, feed }) {
  const [localJourney, setLocalJourney] = useState(loadLocalJourney);
  const [view, setView] = useState(initialView);
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [privateState, setPrivateState] = useState({ status: "idle", message: "" });
  const { profile, applications } = localJourney;
  const syncServerApplications = useCallback(serverApplications => {
    setLocalJourney(current => ({
      ...current,
      applications: (serverApplications || []).map(item => ({
        ...item,
        sourceUrl: safeHttpUrl(current.applications.find(local => local.petId === item.petId)?.sourceUrl),
        organizationClaimed: Boolean(item.applicationEnabled),
      })),
    }));
  }, []);
  const refreshAdoptionLifecycle = useCallback(async () => {
    if (!isSignedIn || typeof getToken !== "function") return null;
    const applicationResult = await authorizedJson(getToken, "/api/adoption-applications");
    syncServerApplications(applicationResult.applications);
    try {
      const checkinResult = await authorizedJson(getToken, "/api/adoption-checkins");
      setCheckins(checkinResult.checkins || []);
    } catch {
      // An unavailable optional check-in service must not hide applications.
      setCheckins([]);
    }
    return applicationResult;
  }, [getToken, isSignedIn, syncServerApplications]);
  useEffect(() => {
    if (isSignedIn) return;
    const storedProfile = Object.fromEntries(["species", "home", "energy", "kids", "pets", "alone", "experience", "distance"].map(key => [key, profile[key]]));
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: storedProfile })); } catch { /* Browser storage is an optional convenience. */ }
  }, [profile, isSignedIn]);
  useEffect(() => {
    if (!isSignedIn || typeof getToken !== "function") return undefined;
    let active = true;
    setPrivateState({ status: "loading", message: "" });
    Promise.all([
      authorizedJson(getToken, "/api/adopter-profile"),
      authorizedJson(getToken, "/api/adoption-applications"),
    ]).then(([profileResult, applicationResult]) => {
      if (!active) return;
      const serverProfile = profileResult.profile;
      setLocalJourney(current => ({
        profile: serverProfile ? normalizeAdopterProfile({
          ...serverProfile.preferences,
          householdName: serverProfile.household?.name,
          collaborators: serverProfile.household?.collaborators,
          accessibility: serverProfile.household?.accessibility,
        }) : current.profile,
        applications: (applicationResult.applications || []).map(item => ({
          ...item,
          sourceUrl: safeHttpUrl(current.applications.find(local => local.petId === item.petId)?.sourceUrl),
          organizationClaimed: Boolean(item.applicationEnabled),
        })),
      }));
      setPrivateState({ status: "ready", message: "" });
    }).catch(error => { if (active) setPrivateState({ status: "error", message: error.message }); });
    authorizedJson(getToken, "/api/adoption-checkins")
      .then(result => { if (active) setCheckins(result.checkins || []); })
      .catch(() => { if (active) setCheckins([]); });
    return () => { active = false; };
  }, [isSignedIn, getToken]);
  const closePet = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("pet");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setSelectedPet(null);
  };
  const openPet = pet => {
    const url = new URL(window.location.href);
    url.searchParams.set("pet", String(pet.id));
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setSelectedPet(pet);
  };
  useEffect(() => {
    const syncPetRoute = () => {
      const id = new URLSearchParams(window.location.search).get("pet");
      setSelectedPet(id ? pets.find(pet => String(pet.id) === id) || null : null);
    };
    syncPetRoute();
    window.addEventListener("popstate", syncPetRoute);
    return () => window.removeEventListener("popstate", syncPetRoute);
  }, [pets]);
  const navigate = next => { if (selectedPet) closePet(); setView(next); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const updateProfile = nextProfile => setLocalJourney(current => ({ ...current, profile: normalizeAdopterProfile(nextProfile) }));
  const updateApplication = next => setLocalJourney(current => ({ ...current, applications: current.applications.map(item => item.id === next.id ? next : item) }));
  const saveProfile = async () => {
    if (!isSignedIn || typeof getToken !== "function") return setPrivateState({ status: "error", message: "Sign in to save private household details to your Pawline account." });
    try {
      const result = await authorizedJson(getToken, "/api/adopter-profile", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          preferences: Object.fromEntries(["species", "home", "energy", "kids", "pets", "alone", "experience", "distance"].map(key => [key, profile[key]])),
          household: { name: profile.householdName, collaborators: profile.collaborators, accessibility: profile.accessibility },
        }),
      });
      setPrivateState({ status: "saved", message: "Private profile saved to your Pawline account." });
      return result;
    } catch (error) { setPrivateState({ status: "error", message: error.message }); return { error: error.message }; }
  };
  const saveDraft = async (application, { heldDataConsent }) => {
    if (!isSignedIn || typeof getToken !== "function") return { error: "Sign in before Pawline can save a private application draft." };
    try {
      const method = String(application.id).startsWith("local-") ? "POST" : "PATCH";
      const body = method === "POST"
        ? { petId: application.petId, coreAnswers: application.coreAnswers, heldDataConsent }
        : { id: application.id, coreAnswers: application.coreAnswers };
      const result = await authorizedJson(getToken, "/api/adoption-applications", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const next = { ...result.application, sourceUrl: application.sourceUrl, organizationClaimed: Boolean(result.application.applicationEnabled) };
      setLocalJourney(current => ({ ...current, applications: current.applications.map(item => item.id === application.id ? next : item) }));
      setSelectedApplicationId(next.id);
      return result;
    } catch (error) { return { error: error.message }; }
  };
  const submitApplication = async (application, sharedFields) => {
    if (!isSignedIn || typeof getToken !== "function") return { error: "Sign in before Pawline can submit an application." };
    try {
      const result = await authorizedJson(getToken, "/api/adoption-applications", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: application.id, submit: true, sharedFields }),
      });
      const next = { ...result.application, sourceUrl: application.sourceUrl, organizationClaimed: Boolean(result.application.applicationEnabled) };
      setLocalJourney(current => ({ ...current, applications: current.applications.map(item => item.id === application.id ? next : item) }));
      return result;
    } catch (error) { return { error: error.message }; }
  };
  const confirmAdoptionOutcome = async (application, outcome) => {
    if (!isSignedIn || typeof getToken !== "function") return { error: "Sign in before confirming an adoption outcome." };
    try {
      const result = await authorizedJson(getToken, "/api/adoption-outcomes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id, outcome }),
      });
      try { await refreshAdoptionLifecycle(); } catch { /* The confirmation succeeded; a later refresh will reconcile status. */ }
      return result;
    } catch (error) { return { error: error.message }; }
  };
  const confirmPlacementCheckin = async (application, placementState) => {
    if (!isSignedIn || typeof getToken !== "function") return { error: "Sign in before sharing a placement update." };
    try {
      const result = await authorizedJson(getToken, "/api/adoption-checkins", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id, placementState }),
      });
      try { await refreshAdoptionLifecycle(); } catch { /* The confirmed update remains server-side. */ }
      return result;
    } catch (error) { return { error: error.message }; }
  };
  const startApplication = pet => {
    const existing = applications.find(item => item.petId === String(pet.id) && !["declined", "withdrawn", "adopted"].includes(item.status));
    const draft = existing || createApplicationDraft(pet, profile);
    if (!existing) setLocalJourney(current => ({ ...current, applications: [draft, ...current.applications] }));
    setSelectedApplicationId(draft.id);
    navigate("applications");
  };
  const currentPage = selectedPet
    ? <PetPage pet={selectedPet} profile={profile} saved={saved.includes(selectedPet.id)} onSave={onSave} onBack={closePet} onStartApplication={startApplication} />
    : view === "discover" ? <Discovery pets={pets} feed={feed} profile={profile} saved={saved} onSave={onSave} onOpen={openPet} onOpenMap={onOpenMap} />
      : view === "applications" ? <Applications applications={applications} selectedApplication={applications.find(item => item.id === selectedApplicationId)} checkins={checkins} isSignedIn={isSignedIn} getToken={getToken} onSelect={setSelectedApplicationId} onUpdate={updateApplication} onSaveDraft={saveDraft} onSubmitApplication={submitApplication} onConfirmOutcome={confirmAdoptionOutcome} onConfirmCheckin={confirmPlacementCheckin} onDiscover={() => navigate("discover")} />
        : view === "messages" ? <ApplicationMessages applications={applications} isSignedIn={isSignedIn} getToken={getToken} onDiscover={() => navigate("discover")} />
          : view === "profile" ? <><Profile profile={profile} onChange={updateProfile} onSave={saveProfile} isSignedIn={isSignedIn} />{privateState.message ? <p className={privateState.status === "error" ? "journey-private-error" : "journey-private-state"} role={privateState.status === "error" ? "alert" : "status"}>{privateState.message}</p> : null}</>
            : <Home profile={profile} applications={applications} pets={pets} saved={saved} onSave={onSave} onOpen={openPet} onNavigate={navigate} isSignedIn={isSignedIn} />;
  return <div className="adopter-experience">
    <header className="journey-header">
      <a href="#pawline-home" onClick={event => { event.preventDefault(); navigate("home"); }} className="brand" aria-label="Pawline adoption journey"><span className="brand-mark"><PawPrint /></span><span>Pawline</span></a>
      <nav aria-label="Adopter navigation"><NavButton active={view === "home" && !selectedPet} icon={House} onClick={() => navigate("home")}>Home</NavButton><NavButton active={false} icon={Map} onClick={onOpenMap}>Map</NavButton><NavButton active={view === "discover" || Boolean(selectedPet)} icon={Search} onClick={() => navigate("discover")}>Discover</NavButton><NavButton active={view === "applications"} icon={ClipboardList} onClick={() => navigate("applications")}>Applications</NavButton><NavButton active={view === "messages"} icon={MessageCircle} onClick={() => navigate("messages")}>Messages</NavButton><NavButton active={view === "profile"} icon={UserRound} onClick={() => navigate("profile")}>Profile</NavButton></nav>
      <div className="journey-header-actions">{authAction}</div>
    </header>
    <nav className="journey-bottom-nav" aria-label="Adopter navigation">{[["home", House, "Home"], ["map", Map, "Map"], ["discover", Search, "Discover"], ["applications", ClipboardList, "Applications"], ["messages", MessageCircle, "Messages"], ["profile", UserRound, "Profile"]].map(([key, Icon, label]) => <NavButton key={key} active={view === key && !selectedPet} icon={Icon} onClick={() => key === "map" ? onOpenMap() : navigate(key)}>{label}</NavButton>)}</nav>
    <main id="pawline-home">{currentPage}</main>
  </div>;
}
