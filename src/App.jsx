import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock3,
  ExternalLink, FileText, Globe2, Heart, Info, LocateFixed, MapPin, Menu, PawPrint, Pencil,
  MessageCircle, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Upload, X
} from "lucide-react";
import heroImage from "./heroData";
import { rankPets } from "./matching";
import { buildMapView } from "./mapView";

const Community = lazy(() => import("./Community"));

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
  const dialogRef = useRef(null);
  const titleId = `dialog-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter(element => !element.disabled && element.getClientRects().length);
    focusable()[0]?.focus();

    const handleKeyDown = event => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.classList.add("dialog-open");
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("dialog-open");
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return <div className="overlay" onMouseDown={onClose}><div ref={dialogRef} className="dialog" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="dialog-head"><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog"><X /></button></div>{children}</div></div>;
}

function SubmissionForm({ onClose }) {
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
    const total = [...files, ...incoming].reduce((sum, file) => sum + file.size, 0);
    if (total > 3 * 1024 * 1024) {
      setState({ status: "error", message: "Photos and documents must total 3 MB or less." });
      return;
    }
    setFiles(current => [...current, ...incoming]);
    if (incoming.length !== selected.length) setState({ status: "error", message: "Use PDF, TXT, JPG, PNG, or WebP files." });
  };
  const encodedFiles = () => Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
  const submit = async e => {
    e.preventDefault();
    setState({ status: "extracting", message: "Reading uploaded records and preparing an editable draft…" });
    try {
      const attachments = await encodedFiles();
      let draft = form;
      if (attachments.length) {
        const extractionResponse = await fetch("/api/extract-submission", {
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
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, files: attachments }) });
      const body = await readJson(response, "Submissions require the configured Pawline API.");
      if (!response.ok) throw new Error(body.error || "Submission failed");
      setState({ status: "success", message: body.message });
    } catch (error) { setState({ status: "error", message: error.message }); }
  };
  const finalSubmit = async () => {
    setState({ status: "saving", message: "Saving your listing for moderation…" });
    try {
      const attachments = await encodedFiles();
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, files: attachments }) });
      const body = await readJson(response, "Submissions require the configured Pawline API.");
      if (!response.ok) throw new Error(body.error || "Submission failed");
      setState({ status: "success", message: body.message });
    } catch (error) { setState({ status: "error", message: error.message }); }
  };
  const choice = (name, label, options = ["Unknown", "Yes", "No"]) => <label>{label}<select name={name} value={form[name]} onChange={update}>{options.map(option => <option key={option}>{option}</option>)}</select></label>;
  const busy = ["extracting", "saving"].includes(state.status);
  return <Dialog title="List a pet" onClose={onClose}>{state.status === "success" ? <div className="success"><Heart fill="currentColor" /><h3>Submitted for review</h3><p>{state.message}</p><Button onClick={onClose}>Done</Button></div> : <><p className="dialog-copy">Upload a photo and available health or identity records. Pawline can extract a draft, but you must review it. Every listing stays private until moderation.</p><form onSubmit={submit}>
    <section className="submission-section"><h3>Photos & records</h3>
      <div className={`drop-zone ${dragging ? "is-dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
        <Upload /><strong>Drag and drop files here</strong><span>or choose as many PDF, TXT, JPG, PNG, or WebP files as fit within 3 MB total</span>
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
    <label>Shelter or contact name<input required name="shelter" value={form.shelter} onChange={update} /></label>
    <label>Contact email<input required type="email" name="email" value={form.email} onChange={update} /></label>
    <div className="form-row"><label>Phone (optional)<input name="phone" value={form.phone} onChange={update} /></label><label>Rehoming fee (optional)<input name="rehomingFee" value={form.rehomingFee} onChange={update} /></label></div>
    <label>Reason for rehoming<textarea name="rehomingReason" value={form.rehomingReason} onChange={update} maxLength={1000} /></label>
    <label>Public listing description<textarea name="description" value={form.description} onChange={update} maxLength={2000} /></label>
    </section>
    <section className="submission-section attestations"><h3>Your attestations</h3>
      <label><input required type="checkbox" name="authorityConfirmed" checked={form.authorityConfirmed} onChange={update} />I own this pet or have documented authority to place them.</label>
      <label><input required type="checkbox" name="disclosureConfirmed" checked={form.disclosureConfirmed} onChange={update} />I disclosed all known medical, bite, aggression, and behavioral history accurately.</label>
      <label><input required type="checkbox" name="localLawConfirmed" checked={form.localLawConfirmed} onChange={update} />I will comply with licensing, transfer, health-certificate, and other rules where the pet is transferred.</label>
      <p><Info /> Requirements vary by jurisdiction and lister type. Pawline does not replace advice from animal control, a veterinarian, or a lawyer.</p>
    </section>
    <label className="honeypot" aria-hidden="true">Website<input tabIndex="-1" name="website" value={form.website} onChange={update} /></label>
    {state.message && <p className={state.status === "error" ? "form-error" : "form-status"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    {state.status === "review" ? <Button type="button" onClick={finalSubmit} disabled={busy}>Submit reviewed listing</Button> : <Button type="submit" disabled={busy}>{busy ? "Working…" : files.length ? <><Sparkles /> Read records & pre-fill</> : "Submit for review"}</Button>}
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
  const unavailableDetails = new Set([
    "See official listing",
    "Age available from LA Animal Services",
    "Details available from LA Animal Services",
    "Unknown",
  ]);
  const detailTags = [...new Set([pet.species, pet.age, pet.size, pet.sex])]
    .filter(value => value && !unavailableDetails.has(value));
  const hasSpecificBreed = pet.breed && !unavailableDetails.has(pet.breed);
  return <Dialog title={pet.name} onClose={onClose}>
    <div className="pet-detail">
      <div className="pet-detail-media"><img src={pet.image} alt={`${pet.name}${hasSpecificBreed ? `, a ${pet.breed}` : ""}`} /></div>
      {detailTags.length ? <div className="detail-meta">{detailTags.map(tag => <span key={tag}>{tag}</span>)}</div> : null}
      {hasSpecificBreed ? <h3>{pet.breed}</h3> : null}
      <p className="detail-location"><MapPin /><span><strong>{pet.locationAccuracy === "shelter" ? "Current shelter location" : "Location"}</strong>{pet.address || pet.city}{pet.address && pet.city ? <small>{pet.city}</small> : null}</span></p>
      <p><ShieldCheck /> {pet.shelter} · verified source</p>
      {pet.locationAccuracy === "shelter" ? <p className="detail-note">The map marker shows the shelter caring for {pet.name}, not a private or foster address. Confirm current availability before visiting.</p> : null}
      {pet.description ? <p>{pet.description}</p> : null}
      <div className="detail-actions">
        <Button variant="outline" onClick={() => onSave(pet.id)}><Heart fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}</Button>
        {pet.sourceUrl ? <a className="button" href={pet.sourceUrl} target="_blank" rel="noreferrer">View adoption listing <ChevronRight /></a> : <span className="button button-disabled" aria-disabled="true">Contact the listed rescue</span>}
      </div>
    </div>
  </Dialog>;
}

function EventDetail({ event, onClose }) {
  const item = normalizeEvent(event);
  return <Dialog title={item.title || "Adoption event"} onClose={onClose}>
    <div className="map-point-detail">
      <span className="point-detail-label"><CalendarDays /> Verified adoption event</span>
      <p><Clock3 /> {item.date ? `${item.date} · ${item.time}` : item.time || "Confirm the current time with the organizer"}</p>
      <p><MapPin /> {item.place || item.city}</p>
      {item.description ? <p>{item.description}</p> : null}
      {item.source_url ? <a className="button" href={item.source_url} target="_blank" rel="noreferrer">Official event details <ExternalLink /></a> : <span className="button button-disabled" aria-disabled="true">Confirm with the organizer</span>}
    </div>
  </Dialog>;
}

function DiscoveryDetail({ discovery, onClose }) {
  return <Dialog title={discovery.title || "Adoption lead"} onClose={onClose}>
    <div className="map-point-detail">
      <span className="point-detail-label"><Globe2 /> Current web adoption lead</span>
      <p><MapPin /> {discovery.city}</p>
      <p>This is an approximate web lead, not a shelter-verified pet listing. Confirm availability and details with the source.</p>
      <a className="button" href={discovery.source_url} target="_blank" rel="noreferrer">Open source website <ExternalLink /></a>
    </div>
  </Dialog>;
}

const DEFAULT_MAP_CENTER = [-118.1445, 34.1478];

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

function InteractiveMap({ coordinates, points, location, onPointClick, onMoveSearch }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoJsonRef = useRef(null);
  const pointClickRef = useRef(onPointClick);
  const moveSearchRef = useRef(onMoveSearch);
  const [mapState, setMapState] = useState({ status: "loading", message: "" });
  const center = coordinates
    ? [Number(coordinates.longitude), Number(coordinates.latitude)]
    : DEFAULT_MAP_CENTER;
  const geoJson = {
    type: "FeatureCollection",
    features: points.map(point => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        properties: { type: point.type, id: String(point.id) },
      })),
  };
  geoJsonRef.current = geoJson;
  pointClickRef.current = onPointClick;
  moveSearchRef.current = onMoveSearch;

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
        addPawImage(map, "pawline-pet-marker", "#2f7458");
        addPawImage(map, "pawline-event-marker", "#ad5d35");
        addPawImage(map, "pawline-discovery-marker", "#7a5a9b");
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
        map.on("moveend", event => {
          if (!event.originalEvent) return;
          const nextCenter = map.getCenter();
          moveSearchRef.current?.({ longitude: nextCenter.lng, latitude: nextCenter.lat });
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
    const current = map.getCenter();
    if (Math.abs(current.lng - center[0]) < 0.0001 && Math.abs(current.lat - center[1]) < 0.0001) return;
    map.easeTo({ center, zoom: Math.max(map.getZoom(), 10), duration: 700 });
  }, [coordinates?.longitude, coordinates?.latitude]);

  return <>
    <div ref={containerRef} className="interactive-map" role="region" aria-label={`Interactive pet map centered on ${location}`} />
    {mapState.status === "loading" ? <div className="map-loading" role="status">Loading interactive map…</div> : null}
    {mapState.status === "error" ? <div className="map-unavailable" role="alert"><span className="map-unavailable-icon"><MapPin /></span><strong>Map temporarily unavailable</strong><span>{mapState.message}</span></div> : null}
    {mapState.status === "ready" ? <>
      <span className="map-instructions">Move the map to search this area · Use +/− to zoom</span>
    </> : null}
  </>;
}

function MapFilters({ petType, distance, showEvents, onPetTypeChange, onDistanceChange, onShowEventsChange, onReset }) {
  return <div className="map-toolbar" role="group" aria-label="Map filters">
    <label className="map-select"><SlidersHorizontal /><span>Pet type</span><select value={petType} onChange={event => onPetTypeChange(event.target.value)} aria-label="Filter map by pet type"><option>All</option><option>Dog</option><option>Cat</option></select></label>
    <label className="map-select"><LocateFixed /><span>Radius</span><select value={distance} onChange={event => onDistanceChange(event.target.value)} aria-label="Map search radius"><option value="25">25 mi</option><option value="50">50 mi</option><option value="100">100 mi</option><option value="150">150 mi</option></select></label>
    <button type="button" className={`map-toggle ${showEvents ? "is-active" : ""}`} onClick={() => onShowEventsChange(value => !value)} aria-pressed={showEvents}><CalendarDays /> Events</button>
    <button type="button" className="map-reset" onClick={onReset} aria-label="Reset map filters"><RotateCcw /> Reset</button>
  </div>;
}

function MapResults({ view, onOpenPet, onOpenEvent, onOpenDiscovery }) {
  const items = [
    ...view.pets.slice(0, 4).map(item => ({ ...item, resultType: "pet" })),
    ...view.events.slice(0, 2).map(item => ({ ...item, resultType: "event" })),
    ...view.discoveries.slice(0, 2).map(item => ({ ...item, resultType: "discovery" })),
  ];
  const open = item => {
    if (item.resultType === "pet") onOpenPet(item);
    if (item.resultType === "event") onOpenEvent(item);
    if (item.resultType === "discovery") onOpenDiscovery(item);
  };
  const icon = type => type === "event" ? <CalendarDays /> : type === "discovery" ? <Globe2 /> : <PawPrint />;
  const detail = item => item.resultType === "event"
    ? `${normalizeEvent(item).month} ${normalizeEvent(item).day} · ${normalizeEvent(item).time}`
    : item.breed || item.city || "Open details";
  const accessibleName = item => item.resultType === "event"
    ? `Open ${item.title} on ${normalizeEvent(item).month} ${normalizeEvent(item).day} details`
    : `Open ${item.name || item.title || item.resultType} details`;

  return <section className="map-results" aria-labelledby="map-results-title">
    <div><strong id="map-results-title">On this map</strong><span>{view.pets.length + view.events.length + view.discoveries.length} results</span></div>
    {items.length ? <div className="map-result-list">{items.map(item =>
      <button type="button" key={`${item.resultType}-${item.id}`} onClick={() => open(item)} aria-label={accessibleName(item)}>
        <span className={`map-result-icon result-${item.resultType}`}>{icon(item.resultType)}</span>
        <span><strong>{item.name || item.title}</strong><small>{detail(item)}</small></span>
        <ChevronRight />
      </button>,
    )}</div> : <p>No coordinate-backed results match this map area and filters.</p>}
  </section>;
}

function MapPanel({ location, coordinates, configured, view, petType, showEvents, onOpenPet, onOpenEvent, onOpenDiscovery, onMapMove }) {
  const { pets: visiblePets, events: visibleEvents, discoveries: visibleDiscoveries } = view;
  const points = [
    ...visiblePets.slice(0, 30)
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
      {configured ? <InteractiveMap coordinates={coordinates} points={points} location={location} onPointClick={openPoint} onMoveSearch={onMapMove} /> : <div className="map-unavailable"><span className="map-unavailable-icon"><MapPin /></span><strong>Map preview is waiting for its connection</strong><span>Filters are ready to use. Connect Mapbox to turn on live location search and the map preview.</span></div>}
      <span className="map-legend"><PawPrint className="pet-paw" /> {petType === "All" ? "Pets" : `${petType}s`} {showEvents ? <><PawPrint className="event-paw" /> Events</> : null} <PawPrint className="discovery-paw" /> Web leads</span>
      <span className="map-attribution">Verified listings + current web leads · Always confirm with the shelter</span>
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

export default function App({ clerkConfigured = false }) {
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("pawline-saved") || "[]"));
  const [species, setSpecies] = useState("All");
  const [location, setLocation] = useState("Pasadena, California, USA");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDiscovery, setSelectedDiscovery] = useState(null);
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
  const [feed, setFeed] = useState({ mode: "loading", message: "Checking trusted adoption sources…" });
  const [integrations, setIntegrations] = useState({ mapboxConfigured: false });
  const [activePanel, setActivePanel] = useState("explore");
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [mapPetType, setMapPetType] = useState("All");
  const [mapDistance, setMapDistance] = useState("150");
  const [showMapEvents, setShowMapEvents] = useState(true);
  const [mapSearchMoved, setMapSearchMoved] = useState(false);
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
  const mapView = useMemo(() => buildMapView({
    pets: remotePets,
    events: remoteEvents,
    discoveries: [...remoteDiscoveries, ...communityDiscoveries],
    center: coordinates,
    petType: mapPetType,
    distance: mapDistance,
    showEvents: showMapEvents,
  }), [remotePets, remoteEvents, remoteDiscoveries, communityDiscoveries, coordinates, mapPetType, mapDistance, showMapEvents]);

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
      setMapSearchMoved(false);
      setLocationState({ status: "success", message: `Map centered on ${match.name}.` });
      document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setLocationState({ status: "error", message: error.message });
    }
  };
  const openPanel = panel => {
    setActivePanel(panel);
    setRailCollapsed(false);
  };
  const resetMapFilters = () => {
    setMapPetType("All");
    setMapDistance("150");
    setShowMapEvents(true);
  };
  const searchThisMapArea = ({ longitude, latitude }) => {
    setCoordinates(current => {
      if (current && Math.abs(current.longitude - longitude) < 0.0001 && Math.abs(current.latitude - latitude) < 0.0001) return current;
      return { longitude, latitude, name: current?.name || "Map area" };
    });
    setMapSearchMoved(true);
  };
  return <div className="app map-app">
    <header className="map-app-header">
      <a className="brand" href="#map" aria-label="Pawline home"><span className="brand-mark"><PawPrint /></span><span>Pawline</span></a>
      <form className={`global-location ${locationState.status === "error" ? "is-error" : ""}`} onSubmit={event => { event.preventDefault(); findMatch(); }}>
        <span className="global-location-icon" aria-hidden="true"><MapPin /></span>
        <span className="global-location-field">
          <label htmlFor="global-location-input">Find pets near</label>
          <input id="global-location-input" value={location} onChange={event => setLocation(event.target.value)} placeholder="City or ZIP code" autoComplete="postal-code" aria-invalid={locationState.status === "error"} aria-describedby="global-location-status" />
        </span>
        <button type="submit" disabled={locationState.status === "loading"} aria-label={locationState.status === "loading" ? "Searching for pets" : "Search this location"}>
          {locationState.status === "loading" ? <RotateCcw className="location-spinner" /> : <Search />}
        </button>
        <span id="global-location-status" className="sr-only" role={locationState.status === "error" ? "alert" : "status"} aria-live="polite">{locationState.status === "loading" ? "Searching for pets nearby" : locationState.message}</span>
      </form>
      <div className="map-app-actions">
        <button className="saved-action" aria-label={`${saved.length} saved pets`}><Heart fill={saved.length ? "currentColor" : "none"} /><span>Saved</span>{saved.length ? <strong>{saved.length}</strong> : null}</button>
        <Button onClick={() => setSubmitOpen(true)} aria-label="List a pet"><span>List a pet</span><PawPrint /></Button>
      </div>
    </header>

  <main id="discover" className={`map-workspace panel-${activePanel} ${railCollapsed ? "rail-collapsed" : ""}`}>
      <MapPanel location={location} coordinates={coordinates} configured={integrations.mapboxConfigured} view={mapView} petType={mapPetType} showEvents={showMapEvents} onOpenPet={setSelectedPet} onOpenEvent={setSelectedEvent} onOpenDiscovery={setSelectedDiscovery} onMapMove={searchThisMapArea} />

      <aside className={`map-rail ${railCollapsed ? "is-collapsed" : ""}`} aria-label="Map discovery tools">
        <button className="rail-toggle" type="button" onClick={() => setRailCollapsed(value => !value)} aria-expanded={!railCollapsed} aria-controls="map-rail-content">
          <ChevronRight />
          <span className="sr-only">{railCollapsed ? "Show discovery tools" : "Hide discovery tools"}</span>
        </button>
        <nav className="rail-tabs" aria-label="Discovery views">
          <button className={activePanel === "explore" ? "active" : ""} onClick={() => openPanel("explore")}><Search />Explore</button>
          <button className={activePanel === "community" ? "active" : ""} onClick={() => openPanel("community")}><MessageCircle />Community</button>
          <button className={activePanel === "match" ? "active" : ""} onClick={() => openPanel("match")}><PawPrint />Match quiz</button>
          <button className={activePanel === "events" ? "active" : ""} onClick={() => openPanel("events")}><CalendarDays />Events</button>
        </nav>
        <div id="map-rail-content" className="rail-content">
          {activePanel === "explore" ? <div className="explore-intro">
            <MapFilters petType={mapPetType} distance={mapDistance} showEvents={showMapEvents} onPetTypeChange={setMapPetType} onDistanceChange={setMapDistance} onShowEventsChange={setShowMapEvents} onReset={resetMapFilters} />
            <div><h1>Pets in this area</h1><span className={`live-state feed-${feed.mode}`}><i />{feed.mode === "live" ? "Live" : feed.mode === "loading" ? "Checking" : "Unavailable"}</span></div>
            <p>{feed.mode === "live" ? `${mapView.pets.length} mapped within ${mapDistance} mi · ${feed.count || remotePets.length} verified records total.` : feed.message || "No synthetic pet profiles are shown."}</p>
            {mapSearchMoved ? <p className="map-area-status" role="status">Showing results around the map center.</p> : null}
            <MapResults view={mapView} onOpenPet={setSelectedPet} onOpenEvent={setSelectedEvent} onOpenDiscovery={setSelectedDiscovery} />
            <Button onClick={() => openPanel("match")}><PawPrint />Find my match</Button>
            <button className="quiz-teaser" onClick={() => openPanel("match")}><span className="quiz-ring">0%</span><span><small>Match quiz progress</small><strong>Tell us about your lifestyle</strong><em>About 2 minutes</em></span><ChevronRight /></button>
            {remoteDiscoveries.length ? <section className="web-leads" aria-label="Current web adoption leads">
              <div><Globe2 /><span><small>Web discovery</small><strong>Fresh adoption leads</strong></span></div>
              <p>Search results are approximate map leads, not shelter-verified pet records.</p>
              {remoteDiscoveries.slice(0, 3).map(item => <a key={item.id} href={item.source_url} target="_blank" rel="noreferrer">
                <span>{item.title}</span><small>{item.city} · {item.source_domain}</small>
              </a>)}
            </section> : null}
            <section className="source-methodology" aria-labelledby="source-methodology-title">
              <ShieldCheck />
              <div>
                <h2 id="source-methodology-title">How Pawline finds adoptable pets</h2>
                <p>Current pet records come from official shelter feeds, authorized providers, or reviewed Pawline records. We link to the original listing so you can confirm availability and adoption requirements with the shelter.</p>
                <p>Approximate web leads are labeled separately and never presented as verified animals. Pawline does not substitute demo pets when live sources are unavailable.</p>
                <a href="/llms-full.txt">Read our source and matching methodology <ChevronRight /></a>
              </div>
            </section>
          </div> : null}
          {activePanel === "match" ? <Matchmaker pets={remotePets} feed={feed} location={location} onLocationChange={setLocation} onSpeciesChange={setSpecies} onFindLocation={findMatch} locationState={locationState} /> : null}
          {activePanel === "events" ? <EventPanel events={remoteEvents} /> : null}
          {activePanel === "community" ? clerkConfigured
            ? <Suspense fallback={<div className="community-auth-state" role="status"><span><MessageCircle /></span><h2>Opening the community…</h2></div>}><Community onLeadsChange={setCommunityLeads} /></Suspense>
            : <div className="community-auth-state"><span><MessageCircle /></span><h2>Community needs Clerk</h2><p>Add the Pawline Clerk publishable key to enable account creation and sign-in. Chat stays closed until identity is configured.</p><div className="auth-safety"><ShieldCheck /><span><strong>Failing closed</strong>No anonymous or unverified chat access is allowed.</span></div></div>
          : null}
        </div>
      </aside>

    </main>
    {submitOpen && <SubmissionForm onClose={() => setSubmitOpen(false)} />}
    {selectedPet && <PetDetail pet={selectedPet} onClose={() => setSelectedPet(null)} saved={saved.includes(selectedPet.id)} onSave={toggleSave} />}
    {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    {selectedDiscovery && <DiscoveryDetail discovery={selectedDiscovery} onClose={() => setSelectedDiscovery(null)} />}
  </div>;
}
