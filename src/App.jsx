import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock3,
  ExternalLink, Globe2, Heart, Info, MapPin, Menu, PawPrint, Pencil,
  Search, ShieldCheck, X
} from "lucide-react";
import heroImage from "./heroData";
import { rankPets } from "./matching";

function Button({ className = "", variant = "primary", children, ...props }) {
  return <button className={`button ${variant === "outline" ? "button-outline" : ""} ${className}`} {...props}>{children}</button>;
}

async function readJson(response, fallbackMessage) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(fallbackMessage);
  }
  return response.json();
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

function Dialog({ title, children, onClose }) {
  return <div className="overlay" onMouseDown={onClose}><div className="dialog" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true"><div className="dialog-head"><h2>{title}</h2><button onClick={onClose} aria-label="Close"><X /></button></div>{children}</div></div>;
}

function SubmissionForm({ onClose }) {
  const [form, setForm] = useState({ name: "", species: "Dog", breed: "", age: "", city: "", country: "", shelter: "", email: "", phone: "", imageUrl: "", sourceUrl: "", description: "", website: "" });
  const [state, setState] = useState({ status: "idle", message: "" });
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    setState({ status: "loading", message: "" });
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await readJson(response, "Submissions require the configured Pawline API.");
      if (!response.ok) throw new Error(body.error || "Submission failed");
      setState({ status: "success", message: body.message });
    } catch (error) { setState({ status: "error", message: error.message }); }
  };
  return <Dialog title="List a pet" onClose={onClose}>{state.status === "success" ? <div className="success"><Heart fill="currentColor" /><h3>Submitted for review</h3><p>{state.message}</p><Button onClick={onClose}>Done</Button></div> : <><p className="dialog-copy">Submit a dog or cat you are authorized to list. Pawline reviews every submission before it becomes public.</p><form onSubmit={submit}>
    <label>Pet name<input required name="name" value={form.name} onChange={update} placeholder="e.g. Poppy" /></label>
    <div className="form-row"><label>Species<select name="species" value={form.species} onChange={update}><option>Dog</option><option>Cat</option></select></label><label>Breed<input required name="breed" value={form.breed} onChange={update} /></label></div>
    <div className="form-row"><label>City<input required name="city" value={form.city} onChange={update} /></label><label>Country<input required name="country" value={form.country} onChange={update} /></label></div>
    <label>Shelter or contact name<input required name="shelter" value={form.shelter} onChange={update} /></label>
    <label>Contact email<input required type="email" name="email" value={form.email} onChange={update} /></label>
    <label>Pet photo URL (optional)<input type="url" name="imageUrl" value={form.imageUrl} onChange={update} /></label>
    <label>Description (optional)<textarea name="description" value={form.description} onChange={update} maxLength={2000} /></label>
    <label className="honeypot" aria-hidden="true">Website<input tabIndex="-1" name="website" value={form.website} onChange={update} /></label>
    {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
    <Button type="submit" disabled={state.status === "loading"}>{state.status === "loading" ? "Submitting…" : "Submit for review"}</Button>
  </form></>}</Dialog>;
}

function PetTile({ pet, saved, onSave, onOpen }) {
  return <article className="pet-tile">
    <img src={pet.image} alt={`${pet.name}, a ${pet.breed}`} />
    <button className={`heart ${saved ? "is-saved" : ""}`} onClick={() => onSave(pet.id)} aria-label={`${saved ? "Remove" : "Save"} ${pet.name}`}><Heart fill={saved ? "currentColor" : "none"} /></button>
    <button className="pet-open" onClick={() => onOpen(pet)} aria-label={`View ${pet.name}'s details`}><span className="pet-overlay"><strong>{pet.name}</strong><span>{pet.age} · {pet.breed}</span><span><MapPin /> {pet.distance} mi away</span></span></button>
  </article>;
}

function PetDetail({ pet, onClose, saved, onSave }) {
  return <Dialog title={pet.name} onClose={onClose}>
    <div className="pet-detail">
      <img src={pet.image} alt={`${pet.name}, a ${pet.breed}`} />
      <div className="detail-meta"><span>{pet.species}</span><span>{pet.age}</span><span>{pet.size}</span><span>{pet.sex}</span></div>
      <h3>{pet.breed}</h3>
      <p><MapPin /> {pet.city}</p>
      <p><ShieldCheck /> {pet.shelter} · verified source</p>
      {pet.description ? <p>{pet.description}</p> : null}
      <div className="detail-actions">
        <Button variant="outline" onClick={() => onSave(pet.id)}><Heart fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}</Button>
        {pet.sourceUrl ? <a className="button" href={pet.sourceUrl} target="_blank" rel="noreferrer">View adoption listing <ChevronRight /></a> : <span className="button button-disabled" aria-disabled="true">Contact the listed rescue</span>}
      </div>
    </div>
  </Dialog>;
}

function MapPanel({ location, coordinates, configured, pets, events }) {
  const nearby = (item) => {
    if (!coordinates || !Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) return true;
    const radians = value => value * Math.PI / 180;
    const deltaLat = radians(item.latitude - coordinates.latitude);
    const deltaLng = radians(item.longitude - coordinates.longitude);
    const value = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(radians(coordinates.latitude)) * Math.cos(radians(item.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
    return 3959 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) <= 150;
  };
  const points = [
    ...pets.filter(pet => nearby(pet))
      .slice(0, 30).map(pet => `${pet.longitude},${pet.latitude},p`),
    ...events.filter(event => nearby(event))
      .slice(0, 10).map(event => `${event.longitude},${event.latitude},e`),
  ];
  const mapParams = new URLSearchParams();
  if (coordinates) {
    mapParams.set("longitude", coordinates.longitude);
    mapParams.set("latitude", coordinates.latitude);
  }
  if (points.length) mapParams.set("points", points.join("|"));
  const mapUrl = `/api/map?${mapParams}`;
  return <section id="map" className="map-panel" aria-label="Pet location map">
    {configured ? <img className="map-image" src={mapUrl} alt={`Map centered on ${location}`} /> : <div className="map-unavailable"><MapPin /><strong>Map preview unavailable</strong><span>Connect Mapbox to enable live location search and maps.</span></div>}
    {configured ? <><span className="map-city">{location}</span><span className="map-legend"><i className="pet-dot" /> Pets <i className="event-dot" /> Events</span></> : null}
  </section>;
}

function normalizeEvent(event) {
  if (!event.starts_at) return event;
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  return {
    ...event,
    month: start.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: start.toLocaleDateString("en-US", { day: "2-digit" }),
    time: `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${end ? ` – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}`,
    place: [event.venue, event.city, event.country].filter(Boolean).join(", "),
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

export default function App() {
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("pawline-saved") || "[]"));
  const [species, setSpecies] = useState("All");
  const [location, setLocation] = useState("Pasadena, California, USA");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [remotePets, setRemotePets] = useState([]);
  const [remoteEvents, setRemoteEvents] = useState([]);
  const [coordinates, setCoordinates] = useState({
    longitude: -118.1445,
    latitude: 34.1478,
    name: "Pasadena, California, USA",
  });
  const [locationState, setLocationState] = useState({ status: "idle", message: "" });
  const [feed, setFeed] = useState({ mode: "loading", message: "Checking trusted adoption sources…" });
  const [integrations, setIntegrations] = useState({ mapboxConfigured: false });

  useEffect(() => localStorage.setItem("pawline-saved", JSON.stringify(saved)), [saved]);
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
    fetch("/api/health")
      .then(response => readJson(response, "Integration status is unavailable."))
      .then(setIntegrations)
      .catch(() => setIntegrations({ mapboxConfigured: false }));
  }, []);

  const toggleSave = id => setSaved(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);
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
      setLocation(match.name);
      setCoordinates(match);
      setLocationState({ status: "success", message: `Map centered on ${match.name}.` });
      document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setLocationState({ status: "error", message: error.message });
    }
  };
  const scrollToMap = () => {
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!integrations.mapboxConfigured) {
      setLocationState({ status: "success", message: "The map preview is unavailable until Mapbox is connected." });
    }
  };

  return <div className="app">
    <Header saved={saved.length} onSubmit={() => setSubmitOpen(true)} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(open => !open)} />
    {menuOpen ? <MobileMenu onClose={() => setMenuOpen(false)} onSubmit={() => setSubmitOpen(true)} /> : null}
    <main id="discover">
      <Matchmaker pets={remotePets} feed={feed} location={location} onLocationChange={setLocation} onSpeciesChange={setSpecies} onFindLocation={findMatch} locationState={locationState} />

      <section className="support-grid">
        <MapPanel location={location} coordinates={coordinates} configured={integrations.mapboxConfigured} pets={remotePets} events={remoteEvents} />
        <div className="map-copy"><h2>Pets and adoption events<br />on one live map.</h2><p>{integrations.mapboxConfigured ? "Green markers are current pet listings; rust markers are verified dog adoption events." : "Live maps will appear here after the location provider is connected."}</p><button onClick={scrollToMap}>{integrations.mapboxConfigured ? "Explore the map" : "View map status"} <ChevronRight /></button></div>
        <EventPanel events={remoteEvents} />
      </section>

      <section id="how" className="mission"><PawPrint /><div><small>HOW PAWLINE HELPS</small><h2>One trusted line between pets and people.</h2></div><p>We bring together authorized shelter feeds, public records, and reviewed community submissions—without pretending one database covers every animal in the world.</p></section>
      <span id="events" />
    </main>
    <nav className="floating-nav" aria-label="App navigation"><a className="active" href="#discover"><Search />Discover</a><a href="#map"><MapPin />Map</a><a href="#events"><CalendarDays />Events</a><button onClick={() => setSubmitOpen(true)}><PawPrint />List a pet</button></nav>
    <footer><a className="brand" href="#discover"><span className="brand-mark"><PawPrint /></span><span>Pawline</span></a><p>Helping good people find great animals.</p><p>© 2026 Pawline</p></footer>
    {submitOpen && <SubmissionForm onClose={() => setSubmitOpen(false)} />}
    {selectedPet && <PetDetail pet={selectedPet} onClose={() => setSelectedPet(null)} saved={saved.includes(selectedPet.id)} onSave={toggleSave} />}
  </div>;
}
