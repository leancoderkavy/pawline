import { getDatabase } from "./_db.js";
import { consumeUsageChain, requestClientKey } from "./_usage-limit.js";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_LIMIT = 80;
const SEARCH_WINDOW_MS = 15 * 60 * 1000;
const MAX_RADIUS_MILES = 50;
const MAX_RESULTS = 30;
const searchCache = new Map();

export function createShelterSearchLimiter({
  clientLimit = 12,
  globalLimit = 160,
  windowMs = SEARCH_WINDOW_MS,
} = {}) {
  let windowStart = null;
  let globalCount = 0;
  const clientCounts = new Map();

  return (clientKey, now = Date.now()) => {
    const nextWindowStart = Math.floor(now / windowMs) * windowMs;
    if (windowStart !== nextWindowStart) {
      windowStart = nextWindowStart;
      globalCount = 0;
      clientCounts.clear();
    }
    const clientCount = clientCounts.get(clientKey) || 0;
    if (clientCount >= clientLimit || globalCount >= globalLimit) return false;
    clientCounts.set(clientKey, clientCount + 1);
    globalCount += 1;
    return true;
  };
}

const reserveFallbackShelterSearch = createShelterSearchLimiter();

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function finiteCoordinate(value, minimum, maximum) {
  const coordinate = Number(first(value));
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

export function normalizeShelterQuery(query = {}) {
  const latitude = finiteCoordinate(query.latitude, -90, 90);
  const longitude = finiteCoordinate(query.longitude, -180, 180);
  const requestedRadius = Number(first(query.radius));
  return {
    latitude,
    longitude,
    radiusMiles: Math.min(
      Math.max(Number.isFinite(requestedRadius) ? requestedRadius : 25, 1),
      MAX_RADIUS_MILES,
    ),
  };
}

export function buildShelterQuery({ latitude, longitude, radiusMiles }) {
  const meters = Math.round(radiusMiles * 1609.344);
  const center = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  return `[out:json][timeout:12];nwr["amenity"="animal_shelter"](around:${meters},${center});out center ${MAX_RESULTS};`;
}

function safeText(value, fallback = null, maxLength = 180) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  return text && text.length <= maxLength ? text : fallback;
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function coordinatesFor(element) {
  const latitude = Number(element?.lat ?? element?.center?.lat);
  const longitude = Number(element?.lon ?? element?.center?.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function addressFor(tags) {
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .map(value => safeText(value, null, 120))
    .filter(Boolean)
    .join(" ");
  const locality = [tags["addr:city"], tags["addr:state"], tags["addr:postcode"]]
    .map(value => safeText(value, null, 80))
    .filter(Boolean)
    .join(", ");
  return [street, locality].filter(Boolean).join(", ") || null;
}

function acceptsAdoptions(tags) {
  const adoption = safeText(tags["animal_shelter:adoption"], "", 80).toLowerCase();
  return adoption !== "" && adoption !== "no";
}

export function normalizeNearbyShelter(element) {
  const coordinates = coordinatesFor(element);
  const tags = element?.tags || {};
  if (!coordinates || !["node", "way", "relation"].includes(element?.type)) return null;
  return {
    id: `osm-${element.type}-${element.id}`,
    name: safeText(tags.name, "Animal shelter", 180),
    operator: safeText(tags.operator, null, 180),
    address: addressFor(tags),
    city: safeText(tags["addr:city"], null, 100),
    openingHours: safeText(tags.opening_hours, null, 180),
    animals: safeText(tags.animal_shelter, null, 100),
    adoptionIndicated: acceptsAdoptions(tags),
    website: safeHttpUrl(tags["contact:website"] || tags.website),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    source: "OpenStreetMap · Nearby shelter",
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

export function parseNearbyShelters(payload) {
  if (!Array.isArray(payload?.elements)) return [];
  const seen = new Set();
  return payload.elements
    .map(normalizeNearbyShelter)
    .filter(shelter => shelter && !seen.has(shelter.id) && seen.add(shelter.id))
    .slice(0, MAX_RESULTS);
}

async function reserveShelterSearch(database, request) {
  const limits = [
    { scope: "nearby_shelter_client", subject: requestClientKey(request), limit: 12, windowMs: SEARCH_WINDOW_MS },
    { scope: "nearby_shelter_global", subject: "all", limit: 160, windowMs: SEARCH_WINDOW_MS },
  ];
  if (database) {
    try {
      return (await consumeUsageChain(database, limits)).allowed;
    } catch (error) {
      console.error("Durable nearby-shelter rate limit unavailable; using bounded fallback", error);
    }
  }
  return reserveFallbackShelterSearch(limits[0].subject);
}

function cacheKey({ latitude, longitude, radiusMiles }) {
  return `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${radiusMiles.toFixed(0)}`;
}

function getCached(key, now = Date.now()) {
  const entry = searchCache.get(key);
  if (!entry || entry.expiresAt <= now) {
    searchCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  searchCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (searchCache.size > CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value);
}

async function fetchNearbyShelters(query) {
  const endpoint = new URL(process.env.OVERPASS_API_BASE_URL || OVERPASS_API);
  endpoint.searchParams.set("data", buildShelterQuery(query));
  const upstream = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Pawline nearby-shelter map (https://www.pawlineadopt.com)",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!upstream.ok) throw new Error(`Nearby shelter source returned ${upstream.status}`);
  return parseNearbyShelters(await upstream.json());
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=900");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const query = normalizeShelterQuery(request.query);
  if (query.latitude === null || query.longitude === null) {
    return response.status(400).json({ error: "A valid map latitude and longitude are required." });
  }

  const key = cacheKey(query);
  const cached = getCached(key);
  if (cached) return response.status(200).json({ ...cached, cached: true });

  if (!await reserveShelterSearch(getDatabase(), request)) {
    return response.status(429).json({ mode: "error", shelters: [], message: "Nearby shelter search is busy. Try again shortly." });
  }

  try {
    const shelters = await fetchNearbyShelters(query);
    const result = {
      mode: shelters.length ? "live" : "empty",
      shelters,
      count: shelters.length,
      radiusMiles: query.radiusMiles,
      provider: "OpenStreetMap via Overpass API",
      attribution: {
        text: "OpenStreetMap contributors",
        url: "https://www.openstreetmap.org/copyright",
      },
      message: shelters.length
        ? undefined
        : "No mapped animal shelters were found in this area. Check the map or try a wider radius.",
    };
    setCached(key, result);
    return response.status(200).json(result);
  } catch (error) {
    console.error("Nearby shelter lookup failed", error);
    return response.status(503).json({
      mode: "error",
      shelters: [],
      message: "Nearby shelter locations are temporarily unavailable. Current pet listings are unchanged.",
    });
  }
}
