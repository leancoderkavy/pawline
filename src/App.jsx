import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronDown, ExternalLink, Filter, Globe2, Heart, Info,
  List, Map, MapPin, Menu, PawPrint, Search, SlidersHorizontal, Star, X
} from "lucide-react";
import { events, pets as seedPets } from "./data";

function Button({ className = "", variant = "primary", children, ...props }) {
  return <button className={`button ${variant === "outline" ? "button-outline" : ""} ${className}`} {...props}>{children}</button>;
}

function Header({ saved, onSubmit }) {
  return <header className="header">
    <a className="brand" href="#"><span className="brand-mark"><PawPrint /></span>Pawline</a>
    <nav><a className="active" href="#discover">Discover</a><a href="#map">Map</a><a href="#events">Events</a><button onClick={onSubmit}>Submit</button><a href="#saved">Saved</a></nav>
    <div className="header-actions"><button className="global"><Globe2 /> Global <ChevronDown /></button><span className="saved-count"><Heart /> {saved}</span><button className="menu" aria-label="Open menu"><Menu /></button></div>
  </header>;
}

function PetCard({ pet, saved, onSave, onRate }) {
  return <article className="pet-card">
    <div className="pet-photo">
      <img src={pet.image} alt={`${pet.name}, a ${pet.breed}`} />
      <button aria-label={`${saved ? "Remove" : "Save"} ${pet.name}`} className={`heart ${saved ? "is-saved" : ""}`} onClick={() => onSave(pet.id)}><Heart fill={saved ? "currentColor" : "none"} /></button>
    </div>
    <div className="pet-info">
      <div className="pet-title"><div><h3>{pet.name}</h3><p>{pet.breed}</p></div><span>{pet.species === "Dog" ? "Shelter" : "Rescue"}</span></div>
      <p>{pet.age} · {pet.sex} · {pet.size}</p>
      <p><MapPin className="inline-icon" /> {pet.distance} mi · {pet.city}</p>
      <p className="shelter">{pet.shelter}</p>
      {pet.rating ? <button className="rating" onClick={() => onRate(pet)}><Star fill="currentColor" /> {pet.rating} <span>({pet.reviews} reviews)</span></button> : <p className="unrated">Shelter reviews coming soon</p>}
      <p className="source">{pet.source} <Info /></p>
    </div>
  </article>;
}

function MapPanel({ pets, selected, setSelected }) {
  return <section id="map" className="map-panel" aria-label="Pet location map">
    <div className="map-roads" />
    <span className="map-label label-a">Pasadena</span><span className="map-label label-b">Los Angeles</span><span className="map-label label-c">San Gabriel</span>
    {pets.map((pet, i) => <button key={pet.id} style={{ left: `${pet.x}%`, top: `${pet.y}%` }} className={`map-pin ${selected === pet.id ? "selected" : ""}`} onClick={() => setSelected(pet.id)} aria-label={`Show ${pet.name}`}>
      {selected === pet.id ? <img src={pet.image} alt="" /> : i + 1}
    </button>)}
    <div className="zoom"><button>+</button><button>−</button></div>
    <Button variant="outline" className="search-area"><Search /> Search this area</Button>
    <small>Map representation · locations are approximate</small>
  </section>;
}

function EventCard({ event }) {
  function addCalendar() {
    const body = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${event.date}\nDTEND:${event.end}\nSUMMARY:${event.title}\nLOCATION:${event.place}\nEND:VEVENT\nEND:VCALENDAR`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" })); a.download = `${event.title.toLowerCase().replaceAll(" ", "-")}.ics`; a.click(); URL.revokeObjectURL(a.href);
  }
  return <article className="event-card"><div className="date"><b>{event.month}</b><strong>{event.day}</strong></div><div><h3>{event.title}</h3><p>{event.place}</p><p>{event.time}</p><button onClick={addCalendar}><CalendarDays /> Add to calendar</button></div></article>;
}

function Dialog({ title, children, onClose }) {
  return <div className="overlay" onMouseDown={onClose}><div className="dialog" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true"><div className="dialog-head"><h2>{title}</h2><button onClick={onClose} aria-label="Close"><X /></button></div>{children}</div></div>;
}

function SubmissionForm({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", species: "Dog", breed: "", city: "", shelter: "" });
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  return <Dialog title="List a pet" onClose={onClose}><p className="dialog-copy">Shelters, rescues, and community members can submit a pet for review. Listings are marked pending until verified.</p><form onSubmit={e => { e.preventDefault(); onAdd(form); }}>
    <label>Pet name<input required name="name" value={form.name} onChange={update} placeholder="e.g. Poppy" /></label>
    <div className="form-row"><label>Species<select name="species" value={form.species} onChange={update}><option>Dog</option><option>Cat</option></select></label><label>Breed<input required name="breed" value={form.breed} onChange={update} /></label></div>
    <label>City and country<input required name="city" value={form.city} onChange={update} placeholder="Tokyo, Japan" /></label>
    <label>Shelter or contact name<input required name="shelter" value={form.shelter} onChange={update} /></label>
    <Button type="submit">Submit for review</Button>
  </form></Dialog>;
}

function RatingDialog({ pet, onClose }) {
  const [done, setDone] = useState(false);
  return <Dialog title={`Rate ${pet.shelter}`} onClose={onClose}>{done ? <div className="success"><span>♥</span><h3>Thank you!</h3><p>Your feedback helps future adopters.</p></div> : <><p className="dialog-copy">How was your adoption experience?</p><div className="rate-stars">{[1,2,3,4,5].map(n => <button key={n} aria-label={`${n} stars`} onClick={() => setDone(true)}><Star fill="currentColor" /></button>)}</div><p className="fine">Ratings are community submitted and are not endorsements by Pawline.</p></>}</Dialog>;
}

export default function App() {
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("pawline-saved") || "[]"));
  const [view, setView] = useState("list");
  const [species, setSpecies] = useState("All");
  const [location, setLocation] = useState("Pasadena, California, USA");
  const [queryLocation, setQueryLocation] = useState(location);
  const [selected, setSelected] = useState(1);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [ratingPet, setRatingPet] = useState(null);
  const [userPets, setUserPets] = useState([]);
  const [remotePets, setRemotePets] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [feed, setFeed] = useState({ mode: "loading", message: "Checking partner feeds…" });
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
        setFeed({
          mode: body.mode,
          message: body.message,
          provider: body.provider,
          count: body.count,
          providerCount: body.providerCount,
          partial: body.partial,
          fetchedAt: body.fetchedAt,
        });
      })
      .catch(error => {
        if (error.name !== "AbortError") {
          setRemotePets([]);
          setFeed({ mode: "error", message: "Partner feed unavailable; showing demo listings." });
        }
      });
    return () => controller.abort();
  }, [species]);
  const allPets = remotePets.length ? [...userPets, ...remotePets] : [...userPets, ...seedPets];
  const visible = useMemo(() => allPets.filter(p => species === "All" || p.species === species), [allPets, species]);
  const toggleSave = id => setSaved(x => x.includes(id) ? x.filter(v => v !== id) : [...x, id]);
  const addPet = form => {
    setUserPets(current => [{ ...form, id: Date.now(), age: "Age unknown", sex: "Unknown", size: "Unknown", distance: 0, rating: "New", reviews: 0, source: "Community submission · Pending review", image: form.species === "Dog" ? seedPets[0].image : seedPets[1].image, x: 56, y: 50 }, ...current]);
    setSpecies("All");
    setSubmitOpen(false);
  };

  return <div className="app">
    <Header saved={saved.length} onSubmit={() => setSubmitOpen(true)} />
    <main id="discover">
      <section className="hero">
        <h1>Meet your new<br />favorite person.</h1>
        <form className="search-box" onSubmit={e => { e.preventDefault(); setQueryLocation(location); }}>
          <label><MapPin /><input aria-label="Location" value={location} onChange={e => setLocation(e.target.value)} /></label>
          <label><PawPrint /><select aria-label="Species" value={species} onChange={e => setSpecies(e.target.value)}><option>All</option><option>Dog</option><option>Cat</option></select></label>
          <Button type="submit">Search <Search /></Button>
        </form>
        <div className={`data-note feed-${feed.mode}`}><Info /> {feed.mode === "live" ? `${feed.count || 0} live adoptable listings supplied by ${feed.provider}. ${feed.partial ? "Coverage is temporarily partial. " : ""}Confirm availability with the shelter.` : feed.message || "Demo listings are shown. Connect live partner feeds to see current availability."}</div>
      </section>

      <div className="toolbar">
        <div><h2>Pets near {queryLocation.split(",")[0]}</h2><p>{visible.length} {feed.mode === "live" ? "live partner listings" : "demo listings"} · Confirm availability with the shelter</p></div>
        <div className="view-toggle"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List /> List</button><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Map /> Map</button></div>
        <Button variant="outline" className="filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><SlidersHorizontal /> Filters</Button>
      </div>

      <section className={`discover-layout ${view === "map" ? "show-map" : ""}`}>
        <aside className={`filters ${filtersOpen ? "mobile-open" : ""}`}>
          <h3><span>Filters</span><span className="filter-actions"><button>Reset</button><button className="close-filters" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X /></button></span></h3>
          {["Distance · Anywhere", "Age · Any age", "Size · Any size", "Rating · 4.0+ stars", "Source · All sources"].map(x => <button key={x}>{x}<ChevronDown /></button>)}
          <div className="submit-card"><div><PawPrint /></div><h3>List a pet</h3><p>Shelters, rescues, and verified community members can submit adoptable pets.</p><Button onClick={() => setSubmitOpen(true)}>List a pet</Button></div>
          <div className="coverage"><Globe2 /><div><h3>Global coverage, local care</h3><p>No single database includes every adoptable pet. Coverage varies by country and source.</p></div></div>
        </aside>
        <div className="results-list">{visible.map(p => <PetCard key={p.id} pet={p} saved={saved.includes(p.id)} onSave={toggleSave} onRate={setRatingPet} />)}</div>
        <MapPanel pets={visible} selected={selected} setSelected={setSelected} />
      </section>
      {filtersOpen ? <button className="filter-backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)} /> : null}

      <section id="events" className="events"><div className="section-heading"><div><h2>Upcoming adoption events</h2><p>Meet pets and local rescue teams in person.</p></div><button>View all events <ExternalLink /></button></div><div className="event-grid">{events.map(e => <EventCard key={e.id} event={e} />)}</div></section>
    </main>
    <footer><a className="brand" href="#"><span className="brand-mark"><PawPrint /></span>Pawline</a><p>Helping good people find great animals.</p><p>© 2026 Pawline · Demo experience</p></footer>
    <nav className="mobile-nav"><button className="active"><Search />Discover</button><button onClick={() => { setView("map"); document.getElementById("map").scrollIntoView(); }}><Map />Map</button><button onClick={() => document.getElementById("events").scrollIntoView()}><CalendarDays />Events</button><button><Heart />Saved</button></nav>
    {submitOpen && <SubmissionForm onClose={() => setSubmitOpen(false)} onAdd={addPet} />}
    {ratingPet && <RatingDialog pet={ratingPet} onClose={() => setRatingPet(null)} />}
  </div>;
}
