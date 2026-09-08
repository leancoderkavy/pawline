import { getDatabase } from "./_db.js";
import { consumeUsageChain, requestClientKey } from "./_usage-limit.js";
import { createPublicFeedCoalescer, readBoundedText } from "./_public-feed.js";
import { PUBLIC_SHELTERS } from "../config/public-shelters.js";
import {
  readShelterCache,
  claimShelterRefresh,
  writeShelterCache,
  SHELTER_CACHE_FRESH_MS,
  SHELTER_CACHE_STALE_MS,
} from "./_shelter-cache.js";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const CACHE_LIMIT = 80;
const SEARCH_WINDOW_MS = 15 * 60 * 1000;
const MAX_RADIUS_MILES = 50;
const MAX_RESULTS = 30;
const PRIMARY_QUERY_RADIUS_MILES = 25;
const FALLBACK_QUERY_RADIUS_MILES = 12;
const OVERPASS_TIMEOUT_MS = 8000;

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
  if (
    first(value) === undefined ||
    first(value) === null ||
    String(first(value)).trim() === ""
  )
    return null;
  const coordinate = Number(first(value));
  return Number.isFinite(coordinate) &&
    coordinate >= minimum &&
    coordinate <= maximum
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

export function shelterSearchRadii(radiusMiles) {
  const primaryRadius = Math.min(radiusMiles, PRIMARY_QUERY_RADIUS_MILES);
  return primaryRadius > FALLBACK_QUERY_RADIUS_MILES
    ? [primaryRadius, FALLBACK_QUERY_RADIUS_MILES]
    : [primaryRadius];
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
  const latitude = finiteCoordinate(
    element?.lat ?? element?.center?.lat,
    -90,
    90,
  );
  const longitude = finiteCoordinate(
    element?.lon ?? element?.center?.lon,
    -180,
    180,
  );
  return latitude !== null && longitude !== null
    ? { latitude, longitude }
    : null;
}

function addressFor(tags) {
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .map((value) => safeText(value, null, 120))
    .filter(Boolean)
    .join(" ");
  const locality = [
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ]
    .map((value) => safeText(value, null, 80))
    .filter(Boolean)
    .join(", ");
  return [street, locality].filter(Boolean).join(", ") || null;
}

function acceptsAdoptions(tags) {
  const adoption = safeText(
    tags["animal_shelter:adoption"],
    "",
    80,
  ).toLowerCase();
  return adoption !== "" && adoption !== "no";
}

export function normalizeNearbyShelter(element) {
  const coordinates = coordinatesFor(element);
  const tags = element?.tags || {};
  if (
    !coordinates ||
    !["node", "way", "relation"].includes(element?.type) ||
    !Number.isSafeInteger(element.id) ||
    element.id <= 0
  )
    return null;
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
  if (!Array.isArray(payload?.elements) || payload.remark)
    throw new Error("Incomplete shelter source response");
  const seen = new Set();
  return payload.elements
    .map(normalizeNearbyShelter)
    .filter(
      (shelter) => shelter && !seen.has(shelter.id) && seen.add(shelter.id),
    )
    .slice(0, MAX_RESULTS);
}

async function reserveShelterSearch(database, request) {
  const limits = [
    {
      scope: "nearby_shelter_client",
      subject: requestClientKey(request),
      limit: 12,
      windowMs: SEARCH_WINDOW_MS,
    },
    {
      scope: "nearby_shelter_global",
      subject: "all",
      limit: 160,
      windowMs: SEARCH_WINDOW_MS,
    },
  ];
  if (database) {
    try {
      return (await consumeUsageChain(database, limits)).allowed;
    } catch (error) {
      console.error(
        "Durable nearby-shelter rate limit unavailable; using bounded fallback",
        error,
      );
    }
  }
  return reserveFallbackShelterSearch(limits[0].subject);
}

function cacheKey({ latitude, longitude, radiusMiles }) {
  return `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${radiusMiles.toFixed(0)}`;
}

function isRetryableShelterSourceError(error) {
  return (
    error?.retryable === true ||
    ["TimeoutError", "TypeError", "SyntaxError"].includes(error?.name)
  );
}

async function fetchSheltersAtRadius(query, fetchImpl, endpointUrl) {
  const endpoint = new URL(endpointUrl);
  endpoint.searchParams.set("data", buildShelterQuery(query));
  const upstream = await fetchImpl(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Pawline nearby-shelter map (https://www.pawlineadopt.com)",
    },
    signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    redirect: "error",
  });
  if (!upstream.ok) {
    const error = new Error(
      `Nearby shelter source returned ${upstream.status}`,
    );
    error.retryable = upstream.status >= 500;
    error.retryMs =
      upstream.status === 429
        ? Math.min(
            Math.max(Number(upstream.headers?.get("retry-after")) || 60, 60),
            3600,
          ) * 1000
        : 60000;
    await upstream.body?.cancel();
    throw error;
  }
  return parseNearbyShelters(
    JSON.parse(await readBoundedText(upstream, 512000)),
  );
}

export async function fetchNearbyShelters(
  query,
  fetchImpl = fetch,
  endpointUrl = process.env.OVERPASS_API_BASE_URL || OVERPASS_API,
) {
  let lastError;
  for (const radiusMiles of shelterSearchRadii(query.radiusMiles)) {
    try {
      return {
        shelters: await fetchSheltersAtRadius(
          { ...query, radiusMiles },
          fetchImpl,
          endpointUrl,
        ),
        radiusMiles,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableShelterSourceError(error)) break;
    }
  }
  throw lastError;
}

export function nearbyDirectory(query) {
  const radians = (n) => (n * Math.PI) / 180;
  return PUBLIC_SHELTERS.map((shelter) => {
    const a =
      Math.sin(radians(shelter.latitude - query.latitude) / 2) ** 2 +
      Math.cos(radians(query.latitude)) *
        Math.cos(radians(shelter.latitude)) *
        Math.sin(radians(shelter.longitude - query.longitude) / 2) ** 2;
    return {
      ...shelter,
      distance: 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, a))),
    };
  })
    .filter((shelter) => shelter.distance <= query.radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}

function usableCache(entry, now, age) {
  return (
    entry?.value &&
    Array.isArray(entry.value.shelters) &&
    entry.observedAt > now - age
  );
}

export function createNearbySheltersHandler(dependencies = {}) {
  const memory = new Map(),
    coalesce = createPublicFeedCoalescer();
  const now = dependencies.now || Date.now;
  const remember = (key, entry) => {
    memory.set(key, entry);
    while (memory.size > CACHE_LIMIT) memory.delete(memory.keys().next().value);
  };
  const fallback = (query, entry, statusCode = 503) => {
    if (
      usableCache(entry, now(), SHELTER_CACHE_STALE_MS) &&
      entry.value.shelters.length
    )
      return {
        status: 200,
        body: {
          ...entry.value,
          mode: "cached",
          cached: true,
          stale: true,
          partial: true,
          message:
            "Showing previously retrieved shelter locations while the map source is unavailable. Confirm current details with each shelter.",
        },
      };
    const shelters = nearbyDirectory(query);
    if (shelters.length)
      return {
        status: 200,
        body: {
          mode: "directory",
          shelters,
          count: shelters.length,
          partial: true,
          radiusMiles: query.radiusMiles,
          requestedRadiusMiles: query.radiusMiles,
          provider: "Reviewed public shelter directory",
          attribution: {
            text: "LA Animal Services",
            url: "https://www.laanimalservices.com/give-us-feedback",
          },
          message:
            "Limited directory results are shown while the map source is unavailable. This is not a complete list of nearby shelters.",
        },
      };
    return {
      status: statusCode,
      body: {
        mode: "error",
        shelters: [],
        message:
          "Nearby shelter locations are temporarily unavailable. Current pet listings are unchanged.",
      },
    };
  };
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      return response.status(405).json({ error: "Method not allowed" });
    }
    const query = normalizeShelterQuery(request.query);
    if (query.latitude === null || query.longitude === null)
      return response
        .status(400)
        .json({ error: "A valid map latitude and longitude are required." });
    const key = cacheKey(query);
    const result = await coalesce(key, async () => {
      let database = (dependencies.getDatabase || getDatabase)(),
        entry = memory.get(key);
      if (!usableCache(entry, now(), SHELTER_CACHE_FRESH_MS)) {
        try {
          entry = (await readShelterCache(database, key)) || entry;
        } catch {
          database = null;
        }
      }
      if (usableCache(entry, now(), SHELTER_CACHE_FRESH_MS)) {
        remember(key, entry);
        return { status: 200, body: { ...entry.value, cached: true } };
      }
      if (entry?.retryAt > now()) return fallback(query, entry);
      try {
        if (
          !(await (dependencies.reserve || reserveShelterSearch)(
            database,
            request,
          ))
        )
          return fallback(query, entry, 429);
        if (!(await claimShelterRefresh(database, key, now())))
          return fallback(query, entry);
        const { shelters, radiusMiles } = await (
          dependencies.load || fetchNearbyShelters
        )(query);
        const value = {
          mode: shelters.length ? "live" : "empty",
          shelters,
          count: shelters.length,
          radiusMiles,
          requestedRadiusMiles: query.radiusMiles,
          observedAt: new Date(now()).toISOString(),
          provider: "OpenStreetMap via Overpass API",
          attribution: {
            text: "OpenStreetMap contributors",
            url: "https://www.openstreetmap.org/copyright",
          },
          message: shelters.length
            ? radiusMiles < query.radiusMiles
              ? `Showing mapped shelters within ${radiusMiles} miles to keep this search responsive.`
              : undefined
            : "No mapped animal shelters were found in this area. Check the map or try a wider radius.",
        };
        remember(key, {
          value,
          observedAt: now(),
          retryAt: now() + SHELTER_CACHE_FRESH_MS,
        });
        await writeShelterCache(database, key, value, now()).catch(() => {});
        return { status: 200, body: value };
      } catch (error) {
        const retryMs = error.retryMs || 60000;
        remember(key, { ...entry, retryAt: now() + retryMs });
        await writeShelterCache(database, key, null, now(), retryMs).catch(
          () => {},
        );
        return fallback(query, entry);
      }
    });
    if (result.status === 200) {
      const cap = result.body.partial ? 60 : 900;
      const ageLimit = result.body.stale ? SHELTER_CACHE_STALE_MS : SHELTER_CACHE_FRESH_MS;
      const remaining = result.body.observedAt ? Math.floor((Date.parse(result.body.observedAt) + ageLimit - now()) / 1000) : cap;
      response.setHeader("Cache-Control", `public, s-maxage=${Math.max(0, Math.min(cap, remaining))}`);
    }
    return response.status(result.status).json(result.body);
  };
}
export default createNearbySheltersHandler();
