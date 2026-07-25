import { getDatabase } from "./_db.js";

const PASADENA_EVENTS =
  "https://pasadenahumane.org/wp-json/tribe/events/v1/events";
const ADDRESS_PATTERN =
  /\b\d{2,6}\s+[^,<>\n]{3,80},\s*[^,<>\n()]{2,50}(?:,\s*CA\s+\d{5}(?:-\d{4})?)?\b/i;

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&#8217;/g, "’")
    .replace(/\s+/g, " ")
    .trim();
}

function isDogAdoptionEvent(event) {
  const title = cleanText(event.title).toLowerCase();
  const description = cleanText(event.description).toLowerCase();
  if (["food bank", "closed", "training", "workshop", "class"].some((term) => title.includes(term))) {
    return false;
  }
  const titleIsDogAdoption =
    /(dog|pup|mutt).{0,50}adopt|adopt.{0,50}(dog|pup|mutt)/.test(title);
  const descriptionNamesAdoptableDogs =
    /(adoptable|adoption fees?).{0,100}(dog|pup|mutt|all animals|all adult)/.test(description) ||
    /(dog|pup|mutt).{0,100}(adoptable|adoption event|adoption fees?)/.test(description);
  return titleIsDogAdoption || descriptionNamesAdoptableDogs;
}

export function normalizePasadenaEvent(event) {
  if (!event?.id || !event?.title || !event?.start_date || !isDogAdoptionEvent(event)) {
    return null;
  }
  const description = cleanText(event.description);
  const address = description.match(ADDRESS_PATTERN)?.[0] || null;
  return {
    id: `pasadena-${event.id}`,
    external_id: String(event.id),
    title: cleanText(event.title),
    description,
    venue: address || "Pasadena Humane adoption event",
    address,
    city: address?.match(/,\s*([^,]+?)(?:,\s*CA\b|$)/i)?.[1]?.replace(/[.!]+$/, "") || "Pasadena",
    country: "United States",
    starts_at: `${(event.utc_start_date || event.start_date).replace(" ", "T")}Z`,
    ends_at: event.utc_end_date || event.end_date
      ? `${(event.utc_end_date || event.end_date).replace(" ", "T")}Z`
      : null,
    source_url: event.url || null,
    source: "Pasadena Humane · Live",
    latitude: null,
    longitude: null,
  };
}

async function fetchPasadenaEvents() {
  const url = new URL(PASADENA_EVENTS);
  url.searchParams.set("per_page", "50");
  url.searchParams.set("start_date", "now");
  url.searchParams.set("search", "adoption");
  const upstream = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Pawline/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!upstream.ok) throw new Error(`Pasadena Humane returned ${upstream.status}`);
  const payload = await upstream.json();
  if (!Array.isArray(payload.events)) throw new Error("Pasadena Humane returned invalid data");
  return payload.events.map(normalizePasadenaEvent).filter(Boolean);
}

async function geocodeEvent(event) {
  if (!event.address || !process.env.MAPBOX_ACCESS_TOKEN) return event;
  const url = new URL(
    `https://api.mapbox.com/search/geocode/v6/forward`,
  );
  url.searchParams.set("q", event.address);
  url.searchParams.set("country", "US");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", process.env.MAPBOX_ACCESS_TOKEN);
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!upstream.ok) return event;
    const payload = await upstream.json();
    const coordinates = payload.features?.[0]?.geometry?.coordinates;
    return Array.isArray(coordinates) && coordinates.length >= 2
      ? { ...event, longitude: Number(coordinates[0]), latitude: Number(coordinates[1]) }
      : event;
  } catch {
    return event;
  }
}

async function fetchDatabaseEvents() {
  const database = getDatabase();
  if (!database) return [];
  const rows = await database`
    SELECT id, external_id, title, venue, city, country, starts_at, ends_at, source_url
    FROM adoption_events
    WHERE status = 'published' AND starts_at >= now()
    ORDER BY starts_at ASC
    LIMIT 50
  `;
  return rows.map((row) => ({
    ...row,
    id: `database-${row.id}`,
    source: "Pawline reviewed event",
    latitude: null,
    longitude: null,
  }));
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const settled = await Promise.allSettled([fetchDatabaseEvents(), fetchPasadenaEvents()]);
  const databaseEvents = settled[0].status === "fulfilled" ? settled[0].value : [];
  const liveEvents = settled[1].status === "fulfilled" ? settled[1].value : [];
  const combined = [...liveEvents, ...databaseEvents].filter(
    (event, index, all) =>
      all.findIndex((item) =>
        item.external_id && event.external_id
          ? String(item.external_id) === String(event.external_id)
          : item.source_url === event.source_url && item.starts_at === event.starts_at,
      ) === index,
  );
  const events = await Promise.all(combined.slice(0, 20).map(geocodeEvent));
  const providersAvailable = settled.some((result) => result.status === "fulfilled");

  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  return response.status(200).json({
    mode: !providersAvailable ? "error" : events.length ? "live" : "empty",
    events,
    count: events.length,
    provider: liveEvents.length ? "Pasadena Humane" : databaseEvents.length ? "Pawline" : null,
    message: !providersAvailable
      ? "Verified dog adoption events are temporarily unavailable."
      : events.length ? undefined : "No verified upcoming dog adoption events are available.",
  });
}
