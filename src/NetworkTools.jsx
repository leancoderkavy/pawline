"use client";
import React, { useEffect, useRef, useState } from "react";
import { PET_SPECIES } from "../config/species.js";
import "./networkTools.css";
import PetImage from "./PetImage.jsx";
export async function publicRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Please try again.");
  return body;
}
export default function NetworkTools({ request, onSignIn, onOpenPet }) {
  const [tab, setTab] = useState("search"),
    [q, setQ] = useState(""),
    [species, setSpecies] = useState("All"),
    [pets, setPets] = useState([]),
    [cursor, setCursor] = useState(null),
    [searched, setSearched] = useState(false),
    [saved, setSaved] = useState([]),
    [reports, setReports] = useState([]),
    [mine, setMine] = useState([]),
    [tips, setTips] = useState([]),
    [source, setSource] = useState(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [location, setLocation] = useState(null),
    [radius, setRadius] = useState("150"),
    [searchName, setSearchName] = useState("");
  const [report, setReport] = useState({
    kind: "lost",
    species: "Dog",
    name: "",
    city: "",
    description: "",
    eventDate: "",
    publicConsent: false,
  });
  const [tip, setTip] = useState({ id: "", body: "" });
  const [savedContext, setSavedContext] = useState(null);
  const [reportCity, setReportCity] = useState("");
  const searchRevision = useRef(0);
  const clearSearchCursor = () => {
    searchRevision.current++;
    setCursor(null);
    setSavedContext(null);
  };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    publicRequest("/api/sources")
      .then((value) => {
        if (alive.current) setSource(value);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, []);
  const run = async (task) => {
    setBusy(true);
    setNotice("");
    try {
      await task();
    } catch (error) {
      if (alive.current) setNotice(error.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const filters = { q, species, ...(location ? { ...location, radius } : {}) };
  const search = async (more = false) => {
    const revision = ++searchRevision.current;
    const body =
      more && savedContext
        ? await request("/api/saved-searches", {
            method: "POST",
            body: JSON.stringify({ action: "check", ...savedContext, cursor }),
          })
        : await publicRequest(
            `/api/catalog?${new URLSearchParams({ ...filters, ...(more && cursor ? { cursor } : {}) })}`,
          );
    if (!alive.current || revision !== searchRevision.current) return;
    setPets((current) =>
      more
        ? [
            ...new Map(
              [...current, ...body.pets].map((p) => [p.id, p]),
            ).values(),
          ]
        : body.pets,
    );
    setCursor(body.nextCursor);
    setSearched(true);
    if (!more) setSavedContext(null);
  };
  const openSaved = async (item, onlyNew = false) => {
    const revision = ++searchRevision.current;
    const result = await request("/api/saved-searches", {
      method: "POST",
      body: JSON.stringify({ action: "check", id: item.id, onlyNew }),
    });
    if (!alive.current || revision !== searchRevision.current) return;
    setQ(item.filters.q || "");
    setSpecies(item.filters.species || "All");
    setLocation(
      item.filters.latitude === undefined
        ? null
        : {
            latitude: item.filters.latitude,
            longitude: item.filters.longitude,
          },
    );
    setRadius(String(item.filters.radius || 150));
    setSavedContext({ id: item.id, onlyNew });
    setPets(result.pets);
    setCursor(result.nextCursor);
    setSearched(true);
    setTab("search");
    setNotice(
      onlyNew
        ? `Showing pets added since you saved “${item.name}”.`
        : `Showing matches for “${item.name}”.`,
    );
  };
  const loadSaved = async () => {
    if (!request) return;
    const body = await request("/api/saved-searches");
    if (alive.current) setSaved(body.searches);
  };
  const loadReports = async () => {
    const body = await publicRequest(
      `/api/lost-pets?${new URLSearchParams({ city: reportCity })}`,
    );
    if (alive.current) setReports(body.reports);
    if (request) {
      const own = await request("/api/lost-pets?mine=true");
      if (alive.current) {
        setMine(own.reports);
        setTips(own.tips);
      }
    }
  };
  const account = (task) => (request ? run(task) : onSignIn?.());
  return (
    <section className="network-tools" aria-labelledby="network-title">
      <h1 id="network-title">Find and connect</h1>
      <div className="network-tabs" role="group" aria-label="Discovery tools">
        {[
          ["search", "Pet search"],
          ["saved", "Saved searches"],
          ["lost", "Lost & found"],
          ["sources", "Coverage"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setNotice("");
              if (key === "saved") run(loadSaved);
              if (key === "lost") run(loadReports);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notice ? (
        <p role="status" className="network-notice">
          {notice}
        </p>
      ) : null}
      {busy ? <p role="status">Working…</p> : null}
      {tab === "search" ? (
        <>
          <p>
            Search Pawline’s stored listings. The map also includes live
            provider results. Coverage varies by area.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(() => search());
            }}
          >
            <label>
              Name, breed, shelter, or city
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  clearSearchCursor();
                }}
                maxLength={100}
              />
            </label>
            <label>
              Species
              <select
                value={species}
                onChange={(e) => {
                  setSpecies(e.target.value);
                  clearSearchCursor();
                }}
              >
                <option>All</option>
                {PET_SPECIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Radius
              <select
                value={radius}
                onChange={(e) => {
                  setRadius(e.target.value);
                  clearSearchCursor();
                }}
              >
                {[25, 50, 150, 500, 3000].map((r) => (
                  <option key={r} value={r}>
                    {r} miles
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!navigator.geolocation) {
                  setNotice("Location is unavailable. Search by city instead.");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setLocation({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                    });
                    clearSearchCursor();
                    setNotice(
                      "Location added. Choose Search to update results.",
                    );
                  },
                  () =>
                    setNotice(
                      "Location access was unavailable. Search by city instead.",
                    ),
                  { timeout: 10000 },
                );
              }}
            >
              {location ? "Update my location" : "Use my location"}
            </button>
            {location ? (
              <button
                type="button"
                onClick={() => {
                  setLocation(null);
                  clearSearchCursor();
                }}
              >
                Clear location
              </button>
            ) : null}
            <button className="button" disabled={busy}>
              Search pets
            </button>
          </form>
          {searched && !pets.length ? (
            <p>
              {savedContext?.onlyNew
                ? "No new matching pets since this search was saved."
                : "No matching stored listings. Try a wider area or explore live providers on the map."}
            </p>
          ) : null}
          <div className="network-pets">
            {pets.map((pet) => (
              <button
                className="network-pet"
                key={pet.id}
                onClick={() => onOpenPet(pet)}
              >
                <PetImage
                  src={pet.image}
                  alt=""
                  className="network-pet-photo"
                  fallbackText="Photo unavailable"
                />
                <span className="network-pet-copy">
                  <strong>{pet.name}</strong>
                  <span>
                    {pet.species} · {pet.breed}
                  </span>
                  <span>{pet.shelter}</span>
                  <small>{pet.city}</small>
                </span>
              </button>
            ))}
          </div>
          {cursor ? (
            <button disabled={busy} onClick={() => run(() => search(true))}>
              Load more pets
            </button>
          ) : null}
          <details>
            <summary>Save this search</summary>
            <label>
              Search name
              <input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                maxLength={100}
              />
            </label>
            <p>
              Saved searches show new listings when you check them here. No
              email is sent.
            </p>
            <button
              disabled={busy || !searchName.trim()}
              onClick={() =>
                account(async () => {
                  await request("/api/saved-searches", {
                    method: "POST",
                    body: JSON.stringify({ name: searchName, filters }),
                  });
                  setNotice(
                    "Search saved. Open Saved searches to check for new pets.",
                  );
                })
              }
            >
              Save search
            </button>
          </details>
        </>
      ) : null}
      {tab === "saved" ? (
        <>
          <p>Save a search, then return here to check for new pets. Email and push alerts are not enabled.</p>
          {!request ? (
            <button onClick={onSignIn}>Sign in to save searches</button>
          ) : !saved.length ? (
            <div className="network-empty"><p>No saved searches yet. Choose the pets and area you want to check.</p><button className="button" onClick={() => setTab("search")}>Find pets to save a search</button></div>
          ) : (
            saved.map((item) => (
              <article key={item.id}>
                <h2>{item.name}</h2>
                <p>
                  {item.filters.species} ·{" "}
                  {item.filters.q || "All stored listings"}
                </p>
                <button
                  disabled={busy}
                  onClick={() => run(() => openSaved(item))}
                >
                  Check matches
                </button>
                <button
                  disabled={busy}
                  onClick={() => run(() => openSaved(item, true))}
                >
                  New pets since saved
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await request("/api/saved-searches", {
                        method: "DELETE",
                        body: JSON.stringify({ id: item.id }),
                      });
                      await loadSaved();
                    })
                  }
                >
                  Remove
                </button>
              </article>
            ))
          )}
        </>
      ) : null}
      {tab === "sources" ? (
        <>
          <h2>Observed coverage</h2>
          <p>
            Stored inventory excludes live provider totals. Directory entries
            and participating shelter teams are counted separately.
          </p>
          {source?.inventory ? (
            <dl>
              <dt>Reviewed public shelter locations</dt>
              <dd>{source.directory?.locations ?? "Unknown"}</dd>
              <dt>Available stored pet records</dt>
              <dd>{source.inventory.available}</dd>
              <dt>Organization records</dt>
              <dd>{source.inventory.organizations}</dd>
              <dt>Organizations with account members</dt>
              <dd>{source.inventory.participating_organizations}</dd>
            </dl>
          ) : (
            <p>Inventory counts are currently unavailable.</p>
          )}
          {source?.observed?.map((item) => (
            <article key={item.name}>
              <h3>{item.name}</h3>
              <p>
                {item.state.replaceAll("_", " ")} · {item.availableRecords}{" "}
                available records
              </p>
              <small>
                Last successful fetch:{" "}
                {item.lastSuccessAt
                  ? new Date(item.lastSuccessAt).toLocaleString()
                  : "Not yet observed"}
              </small>
            </article>
          ))}
        </>
      ) : null}
      {tab === "lost" ? (
        <>
          <h2>Lost and found pets</h2>
          <p>
            Community reports are not adoption listings or proof of ownership.
            Verify ownership privately before returning an animal.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(loadReports);
            }}
          >
            <label>
              City or neighborhood
              <input
                value={reportCity}
                onChange={(e) => setReportCity(e.target.value)}
                maxLength={120}
              />
            </label>
            <button disabled={busy}>Find reports</button>
          </form>
          {!reports.length ? (
            <p>No open reports found here.</p>
          ) : (
            reports.map((r) => (
              <article key={r.id}>
                <h3>
                  {r.kind === "lost" ? "Lost" : "Found"}: {r.name}
                </h3>
                <p>
                  {r.species} · {r.city} · {String(r.event_date).slice(0, 10)}
                </p>
                <p>{r.description}</p>
                <button
                  onClick={() =>
                    request ? setTip({ id: r.id, body: "" }) : onSignIn?.()
                  }
                >
                  Send a private tip
                </button>
                <button
                  onClick={() =>
                    account(async () => {
                      await request("/api/lost-pets", {
                        method: "POST",
                        body: JSON.stringify({ action: "flag", id: r.id }),
                      });
                      setNotice(
                        "Report flagged. Repeated reports from different accounts hide a listing for review.",
                      );
                    })
                  }
                >
                  Report concern
                </button>
              </article>
            ))
          )}
          {tip.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                account(async () => {
                  await request("/api/lost-pets", {
                    method: "POST",
                    body: JSON.stringify({ ...tip, action: "tip" }),
                  });
                  setTip({ id: "", body: "" });
                  setNotice(
                    "Tip saved privately for the reporter to read in My reports.",
                  );
                });
              }}
            >
              <label>
                Private tip
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  value={tip.body}
                  onChange={(e) => setTip({ ...tip, body: e.target.value })}
                />
              </label>
              <p>
                Only the reporter can read this tip. Include a safe way to reply
                if you wish.
              </p>
              <button disabled={busy}>Send tip</button>
              <button
                type="button"
                onClick={() => setTip({ id: "", body: "" })}
              >
                Cancel
              </button>
            </form>
          ) : null}
          <details>
            <summary>Post a report</summary>
            <p>
              Use a city or neighborhood. Keep exact addresses, microchip
              numbers, and contact details private.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                account(async () => {
                  await request("/api/lost-pets", {
                    method: "POST",
                    body: JSON.stringify(report),
                  });
                  setReport({
                    ...report,
                    name: "",
                    description: "",
                    publicConsent: false,
                  });
                  await loadReports();
                  setNotice(
                    "Report published. Check My reports here for private tips.",
                  );
                });
              }}
            >
              <label>
                Report type
                <select
                  value={report.kind}
                  onChange={(e) =>
                    setReport({ ...report, kind: e.target.value })
                  }
                >
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </label>
              <label>
                Species
                <select
                  value={report.species}
                  onChange={(e) =>
                    setReport({ ...report, species: e.target.value })
                  }
                >
                  {PET_SPECIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {[
                ["name", "Name or short description", 100],
                ["city", "City or neighborhood", 120],
              ].map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    maxLength={max}
                    value={report[key]}
                    onChange={(e) =>
                      setReport({ ...report, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Date lost or found
                <input
                  type="date"
                  required
                  value={report.eventDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) =>
                    setReport({ ...report, eventDate: e.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  value={report.description}
                  onChange={(e) =>
                    setReport({ ...report, description: e.target.value })
                  }
                />
              </label>
              <label className="network-checkbox">
                <input
                  type="checkbox"
                  required
                  checked={report.publicConsent}
                  onChange={(e) =>
                    setReport({ ...report, publicConsent: e.target.checked })
                  }
                />
                I am authorized to publish this report and understand it will be
                public.
              </label>
              <button disabled={busy}>Publish report</button>
            </form>
          </details>
          {request ? (
            <details>
              <summary>My reports and private tips</summary>
              {mine.map((r) => (
                <article key={r.id}>
                  <h3>
                    {r.name} · {r.status}
                  </h3>
                  {tips
                    .filter((t) => t.report_id === r.id)
                    .map((t) => (
                      <p key={t.id}>{t.body}</p>
                    ))}
                  {r.status === "open" ? (
                    <>
                      {["reunited", "closed"].map((status) => (
                        <button
                          key={status}
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await request("/api/lost-pets", {
                                method: "PATCH",
                                body: JSON.stringify({ id: r.id, status }),
                              });
                              await loadReports();
                            })
                          }
                        >
                          Mark {status}
                        </button>
                      ))}
                    </>
                  ) : null}
                </article>
              ))}
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
