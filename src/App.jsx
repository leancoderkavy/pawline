import React, { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock3,
  ExternalLink, Globe2, Heart, Info, LocateFixed, MapPin, Menu, PawPrint, Pencil,
  RotateCcw, Search, ShieldCheck, SlidersHorizontal, X
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

const DEFAULT_MAP_CENTER = [-118.1445, 34.1478];

function InteractiveMap({ coordinates, points, location, onPointClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoJsonRef = useRef(null);
  const pointClickRef = useRef(onPointClick);
  const [mapState, setMapState] = useState({ status: "loading", message: "" });
  const center = coordinates
    ? [Number(coordinates.longitude), Number(coordinates.latitude)]
    : DEFAULT_MAP_CENTER;
  const geoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: center },
        properties: { type: "center" },
      },
      ...points.map(point => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        properties: { type: point.type, id: String(point.id) },
      })),
    ],
  };
  geoJsonRef.current = geoJson;
  pointClickRef.current = onPointClick;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let active = true;
    let map;

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
        style: "mapbox://styles/mapbox/streets-v12",
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
        map.addLayer({
          id: "pawline-pets",
          type: "circle",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "pet"],
          paint: {
            "circle-radius": 7,
            "circle-color": "#2f7458",
            "circle-stroke-color": "#fffaf1",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "pawline-events",
          type: "circle",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "event"],
          paint: {
            "circle-radius": 7,
            "circle-color": "#ad5d35",
            "circle-stroke-color": "#fffaf1",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "pawline-center",
          type: "circle",
          source: "pawline-points",
          filter: ["==", ["get", "type"], "center"],
          paint: {
            "circle-radius": 10,
            "circle-color": "#17382f",
            "circle-stroke-color": "#fffaf1",
            "circle-stroke-width": 3,
          },
        });
        map.on("mouseenter", "pawline-pets", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "pawline-pets", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "pawline-pets", event => {
          const id = event.features?.[0]?.properties?.id;
          if (id) pointClickRef.current?.(id);
        });
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
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("pawline-points");
    if (source) source.setData(geoJson);
  }, [points, coordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coordinates) return;
    map.easeTo({ center, zoom: Math.max(map.getZoom(), 10), duration: 700 });
  }, [coordinates?.longitude, coordinates?.latitude]);

  return <>
    <div ref={containerRef} className="interactive-map" role="region" aria-label={`Interactive pet map centered on ${location}`} />
    {mapState.status === "loading" ? <div className="map-loading" role="status">Loading interactive map…</div> : null}
    {mapState.status === "error" ? <div className="map-unavailable" role="alert"><span className="map-unavailable-icon"><MapPin /></span><strong>Map temporarily unavailable</strong><span>{mapState.message}</span></div> : null}
    {mapState.status === "ready" ? <span className="map-instructions">Drag to explore · Scroll or use +/− to zoom</span> : null}
  </>;
}

function MapPanel({ location, coordinates, configured, pets, events, onLocationChange, onFindLocation, locationState, onOpenPet }) {
  const [petType, setPetType] = useState("All");
  const [distance, setDistance] = useState("150");
  const [showEvents, setShowEvents] = useState(true);
  const distanceLimit = Number(distance);
  const distanceFromCenter = (item) => {
    if (!coordinates || !Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) return true;
    const radians = value => value * Math.PI / 180;
    const deltaLat = radians(item.latitude - coordinates.latitude);
    const deltaLng = radians(item.longitude - coordinates.longitude);
    const value = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(radians(coordinates.latitude)) * Math.cos(radians(item.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
    return 3959 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  };
  const nearby = item => {
    const miles = distanceFromCenter(item);
    return miles === true || miles <= distanceLimit;
  };
  const visiblePets = pets.filter(pet => (petType === "All" || pet.species === petType) && nearby(pet));
  const visibleEvents = showEvents ? events.filter(event => nearby(event)) : [];
  const points = [
    ...visiblePets.slice(0, 30)
      .filter(pet => Number.isFinite(pet.longitude) && Number.isFinite(pet.latitude))
      .map(pet => ({ id: pet.id, longitude: pet.longitude, latitude: pet.latitude, type: "pet" })),
    ...visibleEvents.slice(0, 10)
      .filter(event => Number.isFinite(event.longitude) && Number.isFinite(event.latitude))
      .map(event => ({ id: event.id, longitude: event.longitude, latitude: event.latitude, type: "event" })),
  ];
  const openPoint = id => {
    const pet = visiblePets.find(item => String(item.id) === String(id));
    if (pet) onOpenPet?.(pet);
  };
  const resetFilters = () => {
    setPetType("All");
    setDistance("150");
    setShowEvents(true);
  };
  return <section id="map" className="map-discovery" aria-labelledby="map-title">
    <header className="map-header">
      <div><span className="map-kicker"><MapPin /> Explore nearby</span><h2 id="map-title">Find your next hello.</h2><p>Browse current pet listings and reviewed adoption events around your search area.</p></div>
      <div className="map-count" aria-live="polite"><strong>{visiblePets.length}</strong><span>pets in this view</span></div>
    </header>
    <form className="map-toolbar" onSubmit={event => { event.preventDefault(); onFindLocation(); }}>
      <label className="map-search"><Search /><span className="sr-only">Search location</span><input value={location} onChange={event => onLocationChange(event.target.value)} aria-label="Map location" /><button type="submit" disabled={locationState.status === "loading"}>{locationState.status === "loading" ? "Finding…" : "Search"}</button></label>
      <label className="map-select"><SlidersHorizontal /><span>Pet type</span><select value={petType} onChange={event => setPetType(event.target.value)} aria-label="Filter map by pet type"><option>All</option><option>Dog</option><option>Cat</option></select></label>
      <label className="map-select"><LocateFixed /><span>Radius</span><select value={distance} onChange={event => setDistance(event.target.value)} aria-label="Map search radius"><option value="25">25 mi</option><option value="50">50 mi</option><option value="100">100 mi</option><option value="150">150 mi</option></select></label>
      <button type="button" className={`map-toggle ${showEvents ? "is-active" : ""}`} onClick={() => setShowEvents(value => !value)} aria-pressed={showEvents}><CalendarDays /> Events</button>
      <button type="button" className="map-reset" onClick={resetFilters} aria-label="Reset map filters"><RotateCcw /> Reset</button>
    </form>
    {locationState.message ? <p className={`map-status location-${locationState.status}`} role={locationState.status === "error" ? "alert" : "status"}>{locationState.message}</p> : null}
    <div className="map-canvas">
      {configured ? <InteractiveMap coordinates={coordinates} points={points} location={location} onPointClick={openPoint} /> : <div className="map-unavailable"><span className="map-unavailable-icon"><MapPin /></span><strong>Map preview is waiting for its connection</strong><span>Filters are ready to use. Connect Mapbox to turn on live location search and the map preview.</span></div>}
      <span className="map-legend"><i className="pet-dot" /> {petType === "All" ? "Pets" : `${petType}s`} {showEvents ? <><i className="event-dot" /> Events</> : null}</span>
      <span className="map-attribution">Current listings · Always confirm with the shelter</span>
    </div>
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
  const [activePanel, setActivePanel] = useState("explore");

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
  const previewPet = remotePets[0];
  return <div className="app map-app">
    <header className="map-app-header">
      <a className="brand" href="#map" aria-label="Pawline home"><span className="brand-mark"><PawPrint /></span><span>Pawline</span></a>
      <form className="global-location" onSubmit={event => { event.preventDefault(); findMatch(); }}>
        <MapPin /><span>Find pets near</span>
        <input value={location} onChange={event => setLocation(event.target.value)} aria-label="Find pets near" />
        <button type="submit" disabled={locationState.status === "loading"}><Search /><span className="sr-only">Search</span></button>
      </form>
      <div className="map-app-actions">
        <button className="saved-action" aria-label={`${saved.length} saved pets`}><Heart fill={saved.length ? "currentColor" : "none"} /><span>Saved</span>{saved.length ? <strong>{saved.length}</strong> : null}</button>
        <Button onClick={() => setSubmitOpen(true)}>List a pet <PawPrint /></Button>
      </div>
    </header>

    <main id="discover" className={`map-workspace panel-${activePanel}`}>
      <MapPanel location={location} coordinates={coordinates} configured={integrations.mapboxConfigured} pets={remotePets} events={remoteEvents} onLocationChange={setLocation} onFindLocation={findMatch} locationState={locationState} onOpenPet={setSelectedPet} />

      <aside className="map-rail" aria-label="Map discovery tools">
        <nav className="rail-tabs" aria-label="Discovery views">
          <button className={activePanel === "explore" ? "active" : ""} onClick={() => setActivePanel("explore")}><Search />Explore</button>
          <button className={activePanel === "match" ? "active" : ""} onClick={() => setActivePanel("match")}><PawPrint />Match quiz</button>
          <button className={activePanel === "events" ? "active" : ""} onClick={() => setActivePanel("events")}><CalendarDays />Events</button>
        </nav>
        <div className="rail-content">
          {activePanel === "explore" ? <div className="explore-intro">
            <div><h1>Pets in this area</h1><span className={`live-state feed-${feed.mode}`}><i />{feed.mode === "live" ? "Live" : feed.mode === "loading" ? "Checking" : "Unavailable"}</span></div>
            <p>{feed.mode === "live" ? `${feed.count || remotePets.length} current records from ${feed.provider}.` : feed.message || "No synthetic pet profiles are shown."}</p>
            <Button onClick={() => setActivePanel("match")}><PawPrint />Find my match</Button>
            <button className="quiz-teaser" onClick={() => setActivePanel("match")}><span className="quiz-ring">0%</span><span><small>Match quiz progress</small><strong>Tell us about your lifestyle</strong><em>About 2 minutes</em></span><ChevronRight /></button>
          </div> : null}
          {activePanel === "match" ? <Matchmaker pets={remotePets} feed={feed} location={location} onLocationChange={setLocation} onSpeciesChange={setSpecies} onFindLocation={findMatch} locationState={locationState} /> : null}
          {activePanel === "events" ? <EventPanel events={remoteEvents} /> : null}
        </div>
      </aside>

      {activePanel === "explore" && previewPet ? <article className="map-pet-preview">
        <img src={previewPet.image} alt={`${previewPet.name}, a ${previewPet.breed}`} />
        <div><small>{[previewPet.species, previewPet.age, previewPet.size].filter(Boolean).join(" · ")}</small><h2>{previewPet.name}</h2><p>{previewPet.breed}</p><span><MapPin /> {previewPet.city}</span></div>
        <button className={`preview-save ${saved.includes(previewPet.id) ? "is-saved" : ""}`} onClick={() => toggleSave(previewPet.id)} aria-label={`Save ${previewPet.name}`}><Heart fill={saved.includes(previewPet.id) ? "currentColor" : "none"} /></button>
        <Button variant="outline" onClick={() => setSelectedPet(previewPet)}>View profile <ChevronRight /></Button>
      </article> : null}
    </main>
    {submitOpen && <SubmissionForm onClose={() => setSubmitOpen(false)} />}
    {selectedPet && <PetDetail pet={selectedPet} onClose={() => setSelectedPet(null)} saved={saved.includes(selectedPet.id)} onSave={toggleSave} />}
  </div>;
}
