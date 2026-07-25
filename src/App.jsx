import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronRight, Globe2, Heart, Info, MapPin, Menu,
  PawPrint, Search, ShieldCheck, X
} from "lucide-react";
import heroImage from "./heroData";
import { ANY_LIFESTYLE, matchPets } from "./matching";

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

function MapPanel({ location, coordinates, configured }) {
  const mapUrl = coordinates
    ? `/api/map?longitude=${encodeURIComponent(coordinates.longitude)}&latitude=${encodeURIComponent(coordinates.latitude)}`
    : "/api/map";
  return <section id="map" className="map-panel" aria-label="Pet location map">
    {configured ? <img className="map-image" src={mapUrl} alt={`Map centered on ${location}`} /> : <div className="map-unavailable"><MapPin /><strong>Map preview unavailable</strong><span>Connect Mapbox to enable live location search and maps.</span></div>}
    {configured ? <span className="map-city">{location}</span> : null}
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

function EventPanel({ event }) {
  if (!event) {
    return <article className="event-panel event-empty"><div className="event-label"><CalendarDays /> Verified events</div><h3>No verified events yet</h3><p>Partner events will appear here after their organizer and source are reviewed.</p></article>;
  }
  const item = normalizeEvent(event);
  return <article className="event-panel"><div className="event-label"><CalendarDays /> Upcoming event</div><div className="event-content"><div className="event-date"><small>{item.month}</small><strong>{item.day}</strong></div><div><h3>{item.title}</h3><p>{item.time}</p><p><MapPin /> {item.place}</p>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">See event details <ChevronRight /></a> : <span className="event-review">Confirm details with the organizer</span>}</div></div></article>;
}

export default function App() {
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("pawline-saved") || "[]"));
  const [species, setSpecies] = useState("All");
  const [location, setLocation] = useState("Pasadena, California, USA");
  const [lifestyle, setLifestyle] = useState(ANY_LIFESTYLE);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [remotePets, setRemotePets] = useState([]);
  const [remoteEvents, setRemoteEvents] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
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

  const pets = useMemo(() => {
    return matchPets(remotePets, { species, lifestyle, location });
  }, [remotePets, species, lifestyle, location]);
  const toggleSave = id => setSaved(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);
  const findMatch = async () => {
    if (!location.trim()) {
      setLocationState({ status: "error", message: "Enter a city, state, or postal code." });
      return;
    }
    if (!integrations.mapboxConfigured) {
      setCoordinates(null);
      setLocationState({ status: "error", message: "Live location search is unavailable until the map provider is connected." });
      document.getElementById("nearby")?.scrollIntoView({ behavior: "smooth" });
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
      document.getElementById("nearby").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setLocationState({ status: "error", message: error.message });
    }
  };
  const featuredEvent = remoteEvents[0] || null;
  const visiblePets = showAll ? pets : pets.slice(0, 5);
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
      <section className="hero">
        <div className="hero-image"><img src={heroImage} alt="A dog and cat resting together" /><div className="coverage"><Globe2 /><div><small>ADOPTION DISCOVERY</small><strong>{feed.mode === "live" ? "Verified partner listings" : "Live listings only"}</strong><span>{feed.mode === "live" ? "Confirm availability with the source" : "No synthetic listings are shown"}</span></div></div></div>
        <div className="hero-copy">
          <p className="eyebrow">FIND A FRIEND FOR LIFE</p>
          <h1>Who are you<br /><em>looking for?</em></h1>
          <p>Tell us what matters most and we’ll help you find pets who could be your perfect match.</p>
          <div className="match-form">
            <label><MapPin /><span>Where<small>{location}</small></span><ChevronRight /><input aria-label="Location" value={location} onChange={e => setLocation(e.target.value)} /></label>
            <label><PawPrint /><span>Dog or cat<small>{species === "All" ? "Either" : species}</small></span><select aria-label="Species" value={species} onChange={e => setSpecies(e.target.value)}><option value="All">Either</option><option>Dog</option><option>Cat</option></select><ChevronRight /></label>
            <label><Heart /><span>Lifestyle fit<small>{lifestyle}</small></span><select aria-label="Lifestyle" value={lifestyle} onChange={e => setLifestyle(e.target.value)}><option>Any lifestyle</option><option>Active & outdoorsy</option><option>Calm & cozy</option><option>Family friendly</option></select><ChevronRight /></label>
            <Button onClick={findMatch} disabled={locationState.status === "loading"}><span>{locationState.status === "loading" ? "Finding…" : "Find my match"}</span><Search /></Button>
          </div>
          {locationState.message && <p className={`location-state location-${locationState.status}`} role={locationState.status === "error" ? "alert" : "status"}>{locationState.message}</p>}
          <div className="verified"><ShieldCheck /> Every public listing is reviewed or supplied by an authorized source.</div>
        </div>
      </section>

      <section id="nearby" className="nearby">
        <div className="section-heading"><div><h2>Adoptable pets {feed.mode === "live" ? <span>Live</span> : null}</h2><p>Current records from verified shelters and community partners</p></div>{pets.length > 5 ? <button onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer" : "View all pets"} <ChevronRight /></button> : null}</div>
        {feed.mode === "loading" ? <div className="empty-state"><PawPrint /><h3>Loading live listings…</h3><p>Checking verified adoption sources.</p></div> : visiblePets.length ? <div className="pet-gallery">{visiblePets.map(pet => <PetTile key={pet.id} pet={pet} saved={saved.includes(pet.id)} onSave={toggleSave} onOpen={setSelectedPet} />)}</div> : <div className="empty-state"><PawPrint /><h3>{feed.mode === "error" ? "Live listings unavailable" : "No verified matches available"}</h3><p>{feed.message || "Try another species or lifestyle."}</p>{feed.mode !== "error" ? <button onClick={() => { setSpecies("All"); setLifestyle(ANY_LIFESTYLE); }}>Reset filters</button> : null}</div>}
        <div className={`feed-note feed-${feed.mode}`}><Info /> {feed.mode === "live" ? `${feed.count || pets.length} current records from ${feed.provider}. Confirm availability with the shelter.` : feed.message || "Only verified live listings are displayed."}</div>
      </section>

      <section className="support-grid">
        <MapPanel location={location} coordinates={coordinates} configured={integrations.mapboxConfigured} />
        <div className="map-copy"><h2>Pets are waiting<br />closer than you think.</h2><p>{integrations.mapboxConfigured ? "Explore the map to find adoptable pets and shelters near you." : "Live maps will appear here after the location provider is connected."}</p><button onClick={scrollToMap}>{integrations.mapboxConfigured ? "Explore the map" : "View map status"} <ChevronRight /></button></div>
        <EventPanel event={featuredEvent} />
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
