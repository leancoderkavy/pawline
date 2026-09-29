import { getDatabase } from "./_db.js";
import { consumeUsageChain, createUsageFallbackLimiter, requestClientKey } from "./_usage-limit.js";

const PASADENA_EVENTS =
  "https://pasadenahumane.org/wp-json/tribe/events/v1/events";
const KING_COUNTY_EVENTS = "https://data.kingcounty.gov/resource/grxi-zqg2.json";
const KING_COUNTY_CALENDAR = "https://kingcounty.gov/en/dept/executive-services/animals-pets-pests/regional-animal-services/calendar";
const EVENT_FEED_WINDOW_MS = 60 * 60 * 1000;
const EVENT_WINDOW_DAYS = new Set([7, 14, 30]);
const MAX_VISIBLE_EVENTS = 100;
const PASADENA_MAX_PAGES = 10;
const PASADENA_TRAINING_ADDRESS = "361 S. Raymond Avenue, Pasadena, CA 91105";
const ADDRESS_PATTERN =
  /\b\d{2,6}\s+[^,<>\n]{1,65}\b(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Rd|Road|Dr(?:ive)?|Ln|Lane|Way|Hwy|Highway)\.?,\s*[^,<>\n()]{2,50}(?:,\s*CA\s+\d{5}(?:-\d{4})?)?\b/i;

export const createEventFeedFallbackLimiter = (options = {}) => createUsageFallbackLimiter({
  clientLimit: 60,
  globalLimit: 1000,
  windowMs: EVENT_FEED_WINDOW_MS,
  ...options,
});

const reserveFallbackEventFeedUsage = createEventFeedFallbackLimiter();

async function reserveEventFeedUsage(database, request) {
  const limits = [
    { scope: "event_feed_client", subject: requestClientKey(request), limit: 60, windowMs: EVENT_FEED_WINDOW_MS },
    { scope: "event_feed_global", subject: "all", limit: 1000, windowMs: EVENT_FEED_WINDOW_MS },
  ];
  if (database) {
    try {
      return (await consumeUsageChain(database, limits)).allowed;
    } catch (error) {
      console.error("Durable event feed rate limit unavailable; using bounded fallback", error);
    }
  }
  return reserveFallbackEventFeedUsage(limits[0].subject);
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&#8217;/g, "’")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeEventUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
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
  if (!event?.id || !event?.title || !event?.start_date) {
    return null;
  }
  const description = cleanText(event.description);
  const title = cleanText(event.title);
  const categories = Array.isArray(event.categories) ? event.categories : [];
  const training = categories.some(category => category.slug === "training-classes") || /\b(training|class|workshop|playschool)\b/i.test(title);
  const type = isDogAdoptionEvent(event) || /\badopt(?:ion|ions|able|ing)?\b/i.test(title)
    ? "adoption"
    : training ? "training"
      : /\b(clinic|vaccine|microchip|spay|neuter)\b/i.test(title) ? "clinic" : "community";
  const address = description.match(ADDRESS_PATTERN)?.[0] || (training ? PASADENA_TRAINING_ADDRESS : null);
  return {
    id: `pasadena-${event.id}`,
    external_id: String(event.id),
    title,
    type,
    description,
    venue: address || "Pasadena Humane event",
    address,
    city: address?.match(/,\s*([^,]+?)(?:,\s*CA\b|$)/i)?.[1]?.replace(/[.!]+$/, "") || "Pasadena",
    country: "United States",
    starts_at: `${(event.utc_start_date || event.start_date).replace(" ", "T")}Z`,
    ends_at: event.utc_end_date || event.end_date
      ? `${(event.utc_end_date || event.end_date).replace(" ", "T")}Z`
      : null,
    source_url: safeEventUrl(event.url),
    source: "Pasadena Humane · Live",
    latitude: null,
    longitude: null,
  };
}

async function fetchPasadenaEvents(through) {
  const url = new URL(PASADENA_EVENTS);
  url.searchParams.set("per_page", "50");
  url.searchParams.set("start_date", "now");
  url.searchParams.set("end_date", new Date(through.getTime() + 86_400_000).toISOString().slice(0, 19).replace("T", " "));
  const fetchPage = async (page) => {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("page", String(page));
    const upstream = await fetch(pageUrl, {
      headers: { Accept: "application/json", "User-Agent": "Pawline/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) throw new Error(`Pasadena Humane returned ${upstream.status}`);
    const payload = await upstream.json();
    if (!Array.isArray(payload.events)) throw new Error("Pasadena Humane returned invalid data");
    return payload;
  };
  const first = await fetchPage(1);
  const pages = Number(first.total_pages) || 1;
  if (pages > PASADENA_MAX_PAGES) throw new Error("Pasadena Humane event pagination exceeds reviewed limit");
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => fetchPage(index + 2)));
  return [first, ...rest].flatMap(page => page.events).map(normalizePasadenaEvent).filter(Boolean);
}

function kingCountyUtc(localTime) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?$/.test(localTime || "")) return null;
  const parts = localTime.match(/\d+/g).map(Number);
  const asUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" })
    .formatToParts(new Date(asUtc)).find(part => part.type === "timeZoneName")?.value;
  const offset = zone?.match(/^GMT([+-])(\d{1,2})$/);
  if (!offset) return null;
  const hours = Number(offset[2]) * (offset[1] === "+" ? 1 : -1);
  return new Date(asUtc - hours * 60 * 60 * 1000).toISOString();
}

export function normalizeKingCountyEvent(row) {
  const title = cleanText(row?.event_name);
  const coordinates = row?.location?.coordinates;
  if (!title || /\b(closed|holiday|appreciation week)\b/i.test(title) ||
      !row.location_city || !Array.isArray(coordinates) || coordinates.length < 2 ||
      !Number.isFinite(Number(coordinates[0])) || !Number.isFinite(Number(coordinates[1]))) return null;
  const starts_at = kingCountyUtc(row.start_time);
  if (!starts_at) return null;
  const type = /\badopt/i.test(title) ? "adoption" :
    /\b(training|class|workshop)\b/i.test(title) ? "training" :
      /\b(clinic|vaccine|microchip|spay|neuter)\b/i.test(title) ? "clinic" : "community";
  const address = [row.location_address, row.location_city, row.location_state, row.location_zip].filter(Boolean).join(", ");
  return {
    id: `king-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${row.start_time}`,
    title, type, description: cleanText(row.event_description_details),
    venue: cleanText(row.location_name) || address, address, city: cleanText(row.location_city),
    country: "United States", starts_at, ends_at: kingCountyUtc(row.end_time),
    source_url: safeEventUrl(row.url) || KING_COUNTY_CALENDAR,
    source: "King County · Official calendar",
    longitude: Number(coordinates[0]), latitude: Number(coordinates[1]),
  };
}

export async function fetchKingCountyEvents(through = new Date(Date.now() + 14 * 86_400_000)) {
  const url = new URL(KING_COUNTY_EVENTS);
  url.searchParams.set("pets", "true");
  url.searchParams.set("$where", `start_time >= '${new Date(Date.now() - 86_400_000).toISOString().slice(0, 19)}' AND start_time < '${new Date(through.getTime() + 86_400_000).toISOString().slice(0, 19)}'`);
  url.searchParams.set("$limit", "500");
  const upstream = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Pawline/1.0" }, signal: AbortSignal.timeout(10000) });
  if (!upstream.ok) throw new Error(`King County returned ${upstream.status}`);
  const payload = await upstream.json();
  if (!Array.isArray(payload) || payload.length >= 500) throw new Error("King County returned an incomplete event snapshot");
  return payload.map(normalizeKingCountyEvent).filter(Boolean);
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

async function fetchDatabaseEvents(through) {
  const database = getDatabase();
  if (!database) return [];
  const rows = await database`
    SELECT id, external_id, title, venue, city, country, starts_at, ends_at, source_url
    FROM adoption_events
    WHERE status = 'published' AND starts_at >= now() AND starts_at < ${through.toISOString()}
    ORDER BY starts_at ASC
    LIMIT 250
  `;
  return rows.map((row) => ({
    ...row,
    city: typeof row.city === "string" && row.city.length <= 100 && !row.city.startsWith("{") ? row.city : null,
    type: "adoption",
    source_url: safeEventUrl(row.source_url),
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
  const database = getDatabase();
  if (!await reserveEventFeedUsage(database, request)) {
    return response.status(429).json({ mode: "error", events: [], message: "Event feed request limit reached. Try again later." });
  }

  const requestedDays = Number(request.query?.days);
  const windowDays = EVENT_WINDOW_DAYS.has(requestedDays) ? requestedDays : 14;
  const now = Date.now();
  const through = new Date(now + windowDays * 86_400_000);
  const settled = await Promise.allSettled([fetchDatabaseEvents(through), fetchPasadenaEvents(through), fetchKingCountyEvents(through)]);
  const databaseEvents = settled[0].status === "fulfilled" ? settled[0].value : [];
  const liveEvents = settled[1].status === "fulfilled" ? settled[1].value : [];
  const kingEvents = settled[2].status === "fulfilled" ? settled[2].value : [];
  const combined = [...liveEvents, ...kingEvents, ...databaseEvents].filter(event => {
    const start = Date.parse(event.starts_at);
    return Number.isFinite(start) && start >= now && start < through.getTime();
  }).filter(
    (event, index, all) =>
      all.findIndex((item) =>
        item.source_url && event.source_url
          ? item.source_url === event.source_url && new Date(item.starts_at).getTime() === new Date(event.starts_at).getTime()
          : item.source === event.source && item.external_id && event.external_id && String(item.external_id) === String(event.external_id),
      ) === index,
  ).sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
  const page = Math.min(Math.max(Math.trunc(Number(request.query?.page)) || 1, 1), 100);
  const limit = Math.min(Math.max(Math.trunc(Number(request.query?.limit)) || MAX_VISIBLE_EVENTS, 1), MAX_VISIBLE_EVENTS);
  const selected = combined.slice((page - 1) * limit, page * limit);
  const geocodedAddresses = new Map();
  const events = await Promise.all(selected.map(event => {
    if (!event.address) return event;
    if (!geocodedAddresses.has(event.address)) geocodedAddresses.set(event.address, geocodeEvent(event));
    return geocodedAddresses.get(event.address).then(location => ({ ...event, latitude: location.latitude, longitude: location.longitude }));
  }));
  const providersAvailable = settled.some((result) => result.status === "fulfilled");

  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  return response.status(200).json({
    mode: !providersAvailable ? "error" : events.length ? "live" : "empty",
    events,
    windowDays,
    through: through.toISOString(),
    count: events.length,
    total: combined.length,
    page,
    limit,
    hasMore: page * limit < combined.length,
    provider: [liveEvents.length && "Pasadena Humane", kingEvents.length && "King County", databaseEvents.length && "Pawline"].filter(Boolean).join(", ") || null,
    message: !providersAvailable
      ? "Verified pet events are temporarily unavailable."
      : events.length ? undefined : `No verified pet events are available in the next ${windowDays} days.`,
  });
}
