import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronRight, Globe2, Heart, Info, MapPin, Menu,
  PawPrint, Search, ShieldCheck, SlidersHorizontal, X
} from "lucide-react";
import { events, pets as seedPets } from "./data";
import heroImage from "./heroData";

function Button({ className = "", variant = "primary", children, ...props }) {
  return <button className={`button ${variant === "outline" ? "button-outline" : ""} ${className}`} {...props}>{children}</button>;
}

function Header({ saved, onSubmit }) {
  return <header className="header">
    <a className="brand" href="#discover"><span className="brand-mark"><PawPrint /></span><span>Pawline<small>A GLOBAL ADOPTION COMMUNITY</small></span></a>
    <nav><a href="#how">How it works</a><a href="#discover">Discover</a><a href="#map">Map</a><a href="#events">Events</a></nav>
    <div className="header-actions"><button className="language"><Globe2 /> EN</button><button className="saved"><Heart /> {saved}</button><Button variant="outline" onClick={onSubmit}>List a pet</Button><button className="menu" aria-label="Open menu"><Menu /></button></div>
  </header>;
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
      const body = await response.json();
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

function PetTile({ pet, saved, onSave }) {
  return <article className="pet-tile">
    <img src={pet.image} alt={`${pet.name}, a ${pet.breed}`} />
    <button className={`heart ${saved ? "is-saved" : ""}`} onClick={() => onSave(pet.id)} aria-label={`${saved ? "Remove" : "Save"} ${pet.name}`}><Heart fill={saved ? "currentColor" : "none"} /></button>
    <div className="pet-overlay"><h3>{pet.name}</h3><p>{pet.age} · {pet.breed}</p><span><MapPin /> {pet.distance} mi away</span></div>
  </article>;
}

function MapPanel({ pets }) {
  return <section id="map" className="map-panel" aria-label="Pet location map">
    <div className="map-roads" />
    {pets.slice(0, 6).map((pet, i) => <button key={pet.id} style={{ left: `${pet.x}%`, top: `${pet.y}%` }} className={`map-pin ${i === 0 ? "featured" : ""}`} aria-label={`Show ${pet.name}`}>{i === 0 ? <PawPrint /> : i + 3}</button>)}
    <span className="map-city">Pasadena</span>
  </section>;
}

function EventPanel() {
  const event = events[0];
  return <article className="event-panel"><div className="event-label"><CalendarDays /> Upcoming event</div><div className="event-content"><div className="event-date"><small>{event.month}</small><strong>{event.day}</strong></div><div><h3>{event.title}</h3><p>{event.time}</p><p><MapPin /> {event.place}</p><button>See event details <ChevronRight /></button></div></div></article>;
}

export default function App() {
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("pawline-saved") || "[]"));
  const [species, setSpecies] = useState("All");
  const [location, setLocation] = useState("Pasadena, California, USA");
  const [lifestyle, setLifestyle] = useState("Any lifestyle");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [remotePets, setRemotePets] = useState([]);
  const [feed, setFeed] = useState({ mode: "loading", message: "Checking trusted adoption sources…" });

  useEffect(() => localStorage.setItem("pawline-saved", JSON.stringify(saved)), [saved]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (species !== "All") params.set("species", species);
    fetch(`/api/pets?${params}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Feed unavailable");
        setRemotePets(body.pets || []);
        setFeed(body);
      })
      .catch(error => {
        if (error.name !== "AbortError") setFeed({ mode: "error", message: "Live feeds are temporarily unavailable." });
      });
    return () => controller.abort();
  }, [species]);

  const pets = useMemo(() => {
    const source = remotePets.length ? remotePets : seedPets;
    return source.filter(pet => species === "All" || pet.species === species);
  }, [remotePets, species]);
  const toggleSave = id => setSaved(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);

  return <div className="app">
    <Header saved={saved.length} onSubmit={() => setSubmitOpen(true)} />
    <main id="discover">
      <section className="hero">
        <div className="hero-image"><img src={heroImage} alt="A dog and cat resting together" /><div className="coverage"><Globe2 /><div><small>GLOBAL COVERAGE</small><strong>Growing shelter network</strong><span>{feed.mode === "live" ? "Live verified listings" : "Partner feeds onboarding"}</span></div></div></div>
        <div className="hero-copy">
          <p className="eyebrow">FIND A FRIEND FOR LIFE</p>
          <h1>Who are you<br /><em>looking for?</em></h1>
          <p>Tell us what matters most and we’ll help you find pets who could be your perfect match.</p>
          <div className="match-form">
            <label><MapPin /><span>Where<small>{location}</small></span><ChevronRight /><input aria-label="Location" value={location} onChange={e => setLocation(e.target.value)} /></label>
            <label><PawPrint /><span>Dog or cat<small>{species === "All" ? "Either" : species}</small></span><select aria-label="Species" value={species} onChange={e => setSpecies(e.target.value)}><option value="All">Either</option><option>Dog</option><option>Cat</option></select><ChevronRight /></label>
            <label><Heart /><span>Lifestyle fit<small>{lifestyle}</small></span><select aria-label="Lifestyle" value={lifestyle} onChange={e => setLifestyle(e.target.value)}><option>Any lifestyle</option><option>Active & outdoorsy</option><option>Calm & cozy</option><option>Family friendly</option></select><ChevronRight /></label>
            <Button onClick={() => document.getElementById("nearby").scrollIntoView()}><span>Find my match</span><Search /></Button>
          </div>
          <div className="verified"><ShieldCheck /> Every public listing is reviewed or supplied by an authorized source.</div>
        </div>
      </section>

      <section id="nearby" className="nearby">
        <div className="section-heading"><div><h2>New near you <span>Live</span></h2><p>Fresh arrivals from trusted shelters and community partners</p></div><button>View all pets <ChevronRight /></button></div>
        <div className="pet-gallery">{pets.slice(0, 5).map(pet => <PetTile key={pet.id} pet={pet} saved={saved.includes(pet.id)} onSave={toggleSave} />)}</div>
        <div className={`feed-note feed-${feed.mode}`}><Info /> {feed.mode === "live" ? `${feed.count || pets.length} current records from ${feed.provider}. Confirm availability with the shelter.` : `${feed.message || "Demo pets are shown while partner feeds are connected."}`}</div>
      </section>

      <section className="support-grid">
        <MapPanel pets={pets} />
        <div className="map-copy"><h2>Pets are waiting<br />closer than you think.</h2><p>Explore the map to find adoptable pets and shelters near you.</p><button>Explore the map <ChevronRight /></button></div>
        <EventPanel />
      </section>

      <section id="how" className="mission"><PawPrint /><div><small>HOW PAWLINE HELPS</small><h2>One trusted line between pets and people.</h2></div><p>We bring together authorized shelter feeds, public records, and reviewed community submissions—without pretending one database covers every animal in the world.</p></section>
      <span id="events" />
    </main>
    <nav className="floating-nav" aria-label="App navigation"><a className="active" href="#discover"><Search />Discover</a><a href="#map"><MapPin />Map</a><a href="#events"><CalendarDays />Events</a><button onClick={() => setSubmitOpen(true)}><PawPrint />List a pet</button></nav>
    <footer><a className="brand" href="#discover"><span className="brand-mark"><PawPrint /></span><span>Pawline</span></a><p>Helping good people find great animals.</p><p>© 2026 Pawline</p></footer>
    {submitOpen && <SubmissionForm onClose={() => setSubmitOpen(false)} />}
  </div>;
}
