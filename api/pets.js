import { LOS_ANGELES_CENTERS } from "../config/public-shelters.js";
import { getDatabase } from "./_db.js";
import { PET_SPECIES, canonicalPetSpecies } from "../config/species.js";
import { createPublicFeedCoalescer, readBoundedText, deduplicatePets } from "./_public-feed.js";
import { safeHttpUrl, safeImageUrl } from "./_safe-url.js";
import { buildRescueGroupsUrl } from "./_rescuegroups.js";
import { consumeUsageChain, createUsageFallbackLimiter, requestClientKey } from "./_usage-limit.js";

const API_BASE =
  process.env.RESCUEGROUPS_API_BASE_URL || "https://api.rescuegroups.org/v5";
const MONTGOMERY_API =
  "https://data.montgomerycountymd.gov/resource/e54u-qx42.json";
const KING_COUNTY_API =
  "https://data.kingcounty.gov/resource/yaai-7frk.json";
const LOS_ANGELES_PETS_URL =
  "https://www.laanimalservices.com/search/pets";
const PET_FEED_WINDOW_MS = 60 * 60 * 1000;
const coalescePublicFeed = createPublicFeedCoalescer();

export const createPetFeedFallbackLimiter = (options = {}) => createUsageFallbackLimiter({
  clientLimit: 120,
  globalLimit: 3000,
  windowMs: PET_FEED_WINDOW_MS,
  ...options,
});

const reserveFallbackPetFeedUsage = createPetFeedFallbackLimiter();

async function reservePetFeedUsage(database, request) {
  const limits = [
    { scope: "pet_feed_client", subject: requestClientKey(request), limit: 120, windowMs: PET_FEED_WINDOW_MS },
    { scope: "pet_feed_global", subject: "all", limit: 3000, windowMs: PET_FEED_WINDOW_MS },
  ];
  if (database) {
    try {
      return (await consumeUsageChain(database, limits)).allowed;
    } catch (error) {
      console.error("Durable pet feed rate limit unavailable; using bounded fallback", error);
    }
  }
  return reserveFallbackPetFeedUsage(limits[0].subject);
}

export function normalizePetQuery(query = {}) {
  const requestedSpecies = query.species;
  return {
    species: PET_SPECIES.includes(requestedSpecies)
      ? [requestedSpecies]
      : PET_SPECIES,
    limit: Math.min(Math.max(Math.trunc(Number(query.limit)) || 24, 1), 50),
    page: Math.min(Math.max(Math.trunc(Number(query.page)) || 1, 1), 10000),
  };
}

export function boundMergedPetPage(pets, limit) {
  return pets.slice(0, limit);
}
const MONTGOMERY_ADOPTION_URL =
  "https://www.montgomerycountymd.gov/animalservices/adoption/index.html";


export function cleanText(value) {
  if (!value) return null;
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || null;
}


function decodeHtml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function canonicalSpecies(value) {
  return canonicalPetSpecies(value);
}

function socrataUrl(base, { limit, page, where }) {
  const url = new URL(base);
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String((page - 1) * limit));
  url.searchParams.set("$order", base === MONTGOMERY_API ? "animalid" : "animal_id");
  if (where) url.searchParams.set("$where", where);
  return url;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in miles
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const toRad = (deg) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchSocrata(url, provider) {
  return coalescePublicFeed(url.toString(), async () => {
    const upstream = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      throw new Error(`${provider} returned ${upstream.status}`);
    }
    const payload = JSON.parse(await readBoundedText(upstream));
    if (!Array.isArray(payload)) {
      throw new Error(`${provider} returned an invalid payload`);
    }
    return payload;
  });
}

export function normalizeMontgomeryPet(pet, index) {
  const species = canonicalSpecies(pet.animaltype);
  if (!species || !pet.animalid || !pet.petname) return null;
  const sex = {
    M: "Male",
    F: "Female",
    N: "Neutered Male",
    S: "Spayed Female",
    U: "Unknown",
  }[pet.sex] || pet.sex || "Unknown";
  return {
    id: `montgomery-${pet.animalid}`,
    identityNamespace: "source:4eec9ba1-1f85-4e6f-a21b-772f84bb0021",
    externalId: pet.animalid,
    name: cleanText(pet.petname)?.replace(/^\*+/, "") || "New friend",
    species,
    breed: cleanText(pet.breed) || "Mixed breed",
    age: cleanText(pet.petage) || "Age unknown",
    sex,
    size: cleanText(pet.petsize) || "Unknown",
    distance: 0,
    city: "Derwood, Maryland, United States",
    shelter: "Montgomery County Animal Services and Adoption Center",
    rating: null,
    reviews: null,
    source: "Montgomery County Open Data · Live",
    sourceUrl: MONTGOMERY_ADOPTION_URL,
    image: safeImageUrl(pet.url?.url),
    latitude: null,
    longitude: null,
    x: 18 + ((index * 17) % 70),
    y: 20 + ((index * 23) % 62),
  };
}

export function normalizeKingCountyPet(pet, index) {
  const species = canonicalSpecies(pet.animal_type);
  if (!species || !pet.animal_id || !pet.animal_name) return null;
  return {
    id: `king-${pet.animal_id}`,
    identityNamespace: "source:d7fbc275-cf13-40c1-976e-31df071b25c8",
    externalId: pet.animal_id,
    name: cleanText(pet.animal_name) || "New friend",
    species,
    breed: cleanText(pet.animal_breed) || "Mixed breed",
    age: cleanText(pet.age) || "Age unknown",
    sex: cleanText(pet.animal_gender) || "Unknown",
    size: "Unknown",
    distance: 0,
    city: [pet.city, pet.state, "United States"].filter(Boolean).join(", "),
    shelter: "Regional Animal Services of King County",
    rating: null,
    reviews: null,
    source: "King County Open Data · Live",
    sourceUrl: safeHttpUrl(pet.link?.url),
    image: safeImageUrl(pet.image?.url),
    description: cleanText(pet.memo),
    latitude: Number.isFinite(Number(pet.obfuscated_latitude))
      ? Number(pet.obfuscated_latitude) : null,
    longitude: Number.isFinite(Number(pet.obfuscated_longitude))
      ? Number(pet.obfuscated_longitude) : null,
    x: 18 + ((index * 17) % 70),
    y: 20 + ((index * 23) % 62),
  };
}

export async function fetchMontgomeryPets(species, options) {
  const type = species.length === 1 ? species[0].toUpperCase() : null;
  const where = type ? `upper(animaltype)='${type}'` : null;
  const rows = await fetchSocrata(
    socrataUrl(MONTGOMERY_API, { ...options, where }),
    "Montgomery County",
  );
  return Object.assign(rows.map(normalizeMontgomeryPet).filter(Boolean), { hasMore: rows.length >= options.limit });
}

export async function fetchKingCountyPets(species, options) {
  const clauses = ["upper(record_type)='ADOPTABLE'"];
  if (species.length === 1) {
    clauses.push(`upper(animal_type)='${species[0].toUpperCase()}'`);
  }
  const rows = await fetchSocrata(
    socrataUrl(KING_COUNTY_API, { ...options, where: clauses.join(" AND ") }),
    "King County",
  );
  return Object.assign(rows.map(normalizeKingCountyPet).filter(Boolean), { hasMore: rows.length >= options.limit });
}

export function normalizeLosAngelesPet(record) {
  const center = LOS_ANGELES_CENTERS[record.locationCode];
  const species = canonicalSpecies(record.species);
  if (!center || !species || !record.id || !record.name) return null;
  return {
    id: `laas-${record.id.toUpperCase()}`,
    identityNamespace: "provider:laas",
    externalId: record.id.toUpperCase(),
    name: cleanText(decodeHtml(record.name)) || "New friend",
    species,
    breed: "Details available from LA Animal Services",
    age: "Age available from LA Animal Services",
    sex: "See official listing",
    size: "See official listing",
    distance: 0,
    city: center.city,
    address: center.address,
    shelter: center.name,
    rating: null,
    reviews: null,
    source: "LA Animal Services · Live",
    sourceUrl: `https://www.laanimalservices.com/pet/${record.id.toLowerCase()}`,
    image: safeImageUrl(record.image ? decodeHtml(record.image) : null),
    latitude: center.latitude,
    longitude: center.longitude,
    locationAccuracy: "shelter",
  };
}

export function parseLosAngelesPets(html) {
  const rows = String(html || "").match(/<div class="views-row">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];
  return rows.map(row => {
    const link = row.match(/class="pet-result__link" href="\/pet\/([^"]+)">([\s\S]*?)<\/a>/);
    const image = row.match(/class="pet-result__image[^"]*" src="([^"]+)"/);
    const alt = row.match(/alt="([^"]+)"/);
    const locationCode = image?.[1]?.match(/[?&](?:amp;)?LOCATION=([^&"]+)/i)?.[1];
    const species = decodeHtml(alt?.[1] || "").match(/^(Dog|Cat)\b/i)?.[1];
    return normalizeLosAngelesPet({
      id: link?.[1],
      name: link?.[2],
      species,
      image: image?.[1],
      locationCode,
    });
  }).filter(Boolean);
}

export async function fetchLosAngelesPets(species, { limit, page }) {
  if (!species.some(item => ["Dog", "Cat"].includes(item))) return [];
  const url = new URL(LOS_ANGELES_PETS_URL);
  url.searchParams.set("items_per_page", String(Math.min(limit, 48)));
  url.searchParams.set("page", String(page - 1));
  if (species.includes("Cat")) url.searchParams.set("species[28]", "28");
  if (species.includes("Dog")) url.searchParams.set("species[29]", "29");
  return coalescePublicFeed(url.toString(), async () => {
    const upstream = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        "User-Agent": "Pawline adoption search (pawlineadopt.com)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      throw new Error(`LA Animal Services returned ${upstream.status}`);
    }
    const parsed = parseLosAngelesPets(await readBoundedText(upstream));
    return Object.assign(parsed.filter(pet => species.includes(pet.species)), { hasMore: parsed.length >= Math.min(limit, 48) });
  });
}

function findRelated(included, relationship) {
  const ref = relationship?.data;
  if (!ref) return null;
  const refs = Array.isArray(ref) ? ref : [ref];
  return refs
    .map((item) =>
      included.find(
        (entry) => entry.type === item.type && String(entry.id) === String(item.id),
      ),
    )
    .filter(Boolean);
}

function finiteCoordinate(...values) {
  const value = values.find((candidate) =>
    candidate !== null && candidate !== undefined && candidate !== "" &&
    Number.isFinite(Number(candidate))
  );
  return value === undefined ? null : Number(value);
}

export function publicLocationCoordinates(location = {}) {
  const coordinates = location.coordinates || location.coordinate || {};
  const geometryCoordinates = Array.isArray(location.geometry?.coordinates)
    ? location.geometry.coordinates
    : [];
  return {
    latitude: finiteCoordinate(
      location.latitude,
      location.lat,
      coordinates.latitude,
      coordinates.lat,
      geometryCoordinates[1],
    ),
    longitude: finiteCoordinate(
      location.longitude,
      location.lng,
      location.lon,
      coordinates.longitude,
      coordinates.lng,
      coordinates.lon,
      geometryCoordinates[0],
    ),
  };
}

const hasCoordinates = (item) =>
  Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude);

export async function geocodeRescueGroupsPets(
  pets,
  mapboxToken,
  fetchImpl = fetch,
) {
  if (!mapboxToken) return pets;
  const candidates = pets.filter((pet) =>
    !hasCoordinates(pet) &&
    pet.city &&
    pet.city !== "Location available from rescue"
  );
  const queries = [...new Set(candidates.map((pet) => pet.city))];
  if (!queries.length) return pets;

  const url = new URL("https://api.mapbox.com/search/geocode/v6/batch");
  url.searchParams.set("access_token", mapboxToken);
  url.searchParams.set("permanent", "false");
  const upstream = await fetchImpl(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(queries.map((q) => ({
      q,
      types: ["place", "postcode", "address"],
      autocomplete: false,
      limit: 1,
    }))),
    signal: AbortSignal.timeout(10000),
  });
  if (!upstream.ok) throw new Error(`Mapbox batch geocoding returned ${upstream.status}`);
  const payload = await upstream.json();
  const resolved = new Map(queries.map((query, index) => {
    const coordinates = payload.batch?.[index]?.features?.[0]?.geometry?.coordinates;
    return [query, Array.isArray(coordinates) && coordinates.length >= 2
      ? { longitude: Number(coordinates[0]), latitude: Number(coordinates[1]) }
      : null];
  }));
  return pets.map((pet) => {
    const coordinates = resolved.get(pet.city);
    return coordinates && hasCoordinates(coordinates)
      ? { ...pet, ...coordinates, locationAccuracy: "shelter" }
      : pet;
  });
}

function safeDatabaseText(value, fallback, maxLength = 240) {
  if (typeof value !== "string") return fallback;
  const text = cleanText(value);
  if (!text || text.length > maxLength || /^[\[{]/.test(text)) return fallback;
  return text;
}

export function normalizeDatabasePet(pet, index) {
  const city = safeDatabaseText(pet.city, null, 120);
  const country = safeDatabaseText(pet.country, null, 80);
  return {
    id: `pawline-${pet.id}`,
    identityNamespace: pet.source_id ? `source:${pet.source_id}` : `pet:${pet.id}`,
    organizationId: pet.organization_id || null,
    lastObservedAt: pet.verified_at || null,
    listedAt: pet.created_at || null,
    externalId: pet.external_id,
    name: safeDatabaseText(pet.name, "New friend", 120),
    species: canonicalSpecies(pet.species),
    breed: safeDatabaseText(pet.breed, "Mixed breed", 160),
    age: safeDatabaseText(pet.age, "Age unknown", 80),
    sex: safeDatabaseText(pet.sex, "Unknown", 80),
    size: safeDatabaseText(pet.size, "Unknown", 80),
    distance: 0,
    city: [city, country].filter(Boolean).join(", ") || "Location available from rescue",
    shelter: safeDatabaseText(pet.shelter, "Community rescue", 180),
    rating: null,
    reviews: null,
    source: pet.source_id ? "Official feed · Imported" : "Pawline community · Reviewed",
    sourceUrl: safeHttpUrl(pet.source_url),
    messageAvailable: pet.organization_id ? Boolean(pet.organization_has_members) : Boolean(pet.claimed_by_clerk_user_id),
    image: safeImageUrl(pet.image_url),
    latitude: pet.latitude == null ? null : Number(pet.latitude),
    longitude: pet.longitude == null ? null : Number(pet.longitude),
    x: pet.longitude == null ? 18 + ((index * 17) % 70) : 50,
    y: pet.latitude == null ? 20 + ((index * 23) % 62) : 50,
  };
}

async function fetchDatabasePets({ limit, page, species }) {
  const database = getDatabase();
  if (!database) return [];
  const offset = (page - 1) * limit;
  const rows = await database`
    SELECT id, source_id, verified_at, external_id, name, species, breed, age, sex, size, city, country,
           shelter, image_url, source_url, latitude, longitude, claimed_by_clerk_user_id, organization_id,
           EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = pets.organization_id) AS organization_has_members
    FROM pets
    WHERE status = 'available' AND verified_at IS NOT NULL
      AND species = ANY(${species})
    ORDER BY id ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  return rows.map(normalizeDatabasePet);
}

export function normalizeAnimal(animal, included, index) {
  const attributes = animal.attributes || {};
  const pictures = findRelated(included, animal.relationships?.pictures) || [];
  const breeds = findRelated(included, animal.relationships?.breeds) || [];
  const organizations =
    findRelated(included, animal.relationships?.orgs) ||
    findRelated(included, animal.relationships?.organizations) ||
    [];
  const locations = findRelated(included, animal.relationships?.locations) || [];
  const species = findRelated(included, animal.relationships?.species) || [];
  const picture = pictures
    .map((item) => item.attributes || {})
    .sort((a, b) => (a.order || 99) - (b.order || 99))[0];
  const organization = organizations[0]?.attributes || {};
  const location = locations[0]?.attributes || organization;
  const coordinates = publicLocationCoordinates(location);
  const speciesName =
    species[0]?.attributes?.singular ||
    attributes.species ||
    "Pet";

  return {
    id: `rg-${animal.id}`,
    identityNamespace: "provider:rescuegroups",
    externalId: String(animal.id),
    name: attributes.name || "New friend",
    species: canonicalSpecies(speciesName) || speciesName,
    breed:
      attributes.breedString ||
      attributes.breedPrimary ||
      breeds.map((item) => item.attributes?.name).filter(Boolean).join(" / ") ||
      "Mixed breed",
    age: attributes.ageString || attributes.ageGroup || "Age unknown",
    sex: attributes.sex || "Unknown",
    size: attributes.sizeGroup || attributes.sizeCurrent || "Unknown",
    distance: Number(attributes.distance || organization.distance || 0),
    city:
      location.citystate ||
      [location.city, location.state, location.country].filter(Boolean).join(", ") ||
      "Location available from rescue",
    shelter: organization.name || "RescueGroups partner",
    rating: null,
    reviews: null,
    source: "RescueGroups · Live",
    sourceUrl: safeHttpUrl(attributes.url || organization.adoptionUrl || organization.url),
    image:
      safeImageUrl(picture?.large || picture?.original || attributes.pictureThumbnailUrl),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    locationAccuracy: hasCoordinates(coordinates) ? "shelter" : undefined,
    x: 18 + ((index * 17) % 70),
    y: 20 + ((index * 23) % 62),
  };
}

export function isCurrentProviderListing(pet) {
  const name = cleanText(pet?.name) || "";
  return !/\b(?:adopted|no longer available|not available|withdrawn|euthanized|deceased)\b/i.test(name);
}

export function rescueSearchBody(species, query = {}) {
  const groups = { "Small animal": ["Guinea Pig", "Hamster", "Gerbil", "Rat", "Mouse", "Ferret", "Chinchilla"], Reptile: ["Snake", "Turtle", "Tortoise", "Lizard", "Gecko", "Iguana"], Barnyard: ["Goat", "Pig", "Sheep", "Cow"] };
  const body = { data: { filters: [
    { fieldName: "statuses.name", operation: "equal", criteria: "Available" },
    { fieldName: "species.singular", operation: "equal", criteria: species.flatMap(item => groups[item] || [item]) },
  ] } };
  const lat = Number(query.latitude), lon = Number(query.longitude), radius = Number(query.radius);
  if (query.latitude != null && query.longitude != null && Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180 && Number.isFinite(radius) && radius >= 1 && radius <= 3000) body.data.filterRadius = { lat, lon, miles: radius };
  return body;
}
export async function fetchSpecies(species, { limit, page, query }, apiKey) {
  const url = buildRescueGroupsUrl(
    API_BASE,
    "public/animals/search/",
    {
      limit,
      page,
      sort: "animals.id",
      include: "pictures,orgs,locations,species,breeds",
    },
  );

  const upstream = await fetch(url.toString(), {
    method: "POST",
    body: JSON.stringify(rescueSearchBody(species, query)),
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: apiKey,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    throw new Error(`RescueGroups returned ${upstream.status}: ${detail.slice(0, 240)}`);
  }

  return upstream.json();
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const { species, limit, page } = normalizePetQuery(request.query);
  const database = getDatabase();
  
  if (!database) {
    return response.status(500).json({
      mode: "error",
      pets: [],
      count: 0,
      message: "Database unavailable",
    });
  }

  if (!await reservePetFeedUsage(database, request)) {
    return response.status(429).json({ 
      mode: "error", 
      pets: [], 
      count: 0,
      message: "Adoption feed request limit reached. Try again later." 
    });
  }

  try {
    const offset = (page - 1) * limit;
    
    // Parse geo filters if provided
    const latitude = request.query.latitude ? Number(request.query.latitude) : null;
    const longitude = request.query.longitude ? Number(request.query.longitude) : null;
    const radius = request.query.radius ? Number(request.query.radius) : null;
    
    let rows;
    let geoSearchAttempted = false;
    let suggestedCenter = null;
    let geoSearchFailed = false; // Track if both PostGIS AND haversine failed
    
    // Try geo filtering if params provided
    if (latitude != null && longitude != null && radius != null && 
        Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radius) &&
        Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && radius >= 1 && radius <= 3000) {
      try {
        geoSearchAttempted = true;
        const radiusMeters = radius * 1609.34;
        
        // Geo search: ONLY pets with coordinates within radius
        rows = await database`
          SELECT id, source_id, verified_at, external_id, name, species, breed, age, sex, size, city, country,
                 shelter, image_url, source_url, latitude, longitude, claimed_by_clerk_user_id, organization_id,
                 EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = pets.organization_id) AS organization_has_members,
                 ST_Distance(
                   ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                   ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                 ) / 1609.34 AS distance_miles
          FROM pets
          WHERE status = 'available' 
            AND verified_at IS NOT NULL
            AND species = ANY(${species})
            AND latitude IS NOT NULL 
            AND longitude IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
              ${radiusMeters}
            )
          ORDER BY distance_miles ASC, id ASC
          LIMIT ${limit + 1}
          OFFSET ${offset}
        `;
        
        // If geo search returned 0 results, find nearest located pet cluster for recenter suggestion
        if (rows.length === 0 && offset === 0) {
          const nearest = await database`
            SELECT latitude, longitude, city, COUNT(*) as count
            FROM pets
            WHERE status = 'available'
              AND verified_at IS NOT NULL
              AND species = ANY(${species})
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
            GROUP BY latitude, longitude, city
            ORDER BY ST_Distance(
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
            ) ASC
            LIMIT 1
          `;
          
          if (nearest.length > 0) {
            suggestedCenter = {
              latitude: Number(nearest[0].latitude),
              longitude: Number(nearest[0].longitude),
              city: nearest[0].city,
              count: Number(nearest[0].count),
            };
          }
        }
      } catch (geoError) {
        // PostGIS not available or query failed
        // Fall back to non-PostGIS distance calculation (haversine)
        console.warn("PostGIS unavailable, using haversine fallback:", geoError.message);
        
        try {
          // Fetch ALL located pets (can't filter by radius in SQL without PostGIS)
          const allLocated = await database`
            SELECT id, source_id, verified_at, external_id, name, species, breed, age, sex, size, city, country,
                   shelter, image_url, source_url, latitude, longitude, claimed_by_clerk_user_id, organization_id,
                   EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = pets.organization_id) AS organization_has_members
            FROM pets
            WHERE status = 'available' 
              AND verified_at IS NOT NULL
              AND species = ANY(${species})
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
            ORDER BY verified_at DESC, id ASC
          `;
          
          // Calculate distance for each pet using haversine
          const petsWithDistance = allLocated.map(pet => ({
            ...pet,
            distance_miles: haversineDistance(
              latitude,
              longitude,
              Number(pet.latitude),
              Number(pet.longitude)
            ),
          }));
          
          // Filter by radius and sort by distance
          const inRadius = petsWithDistance
            .filter(pet => pet.distance_miles <= radius)
            .sort((a, b) => a.distance_miles - b.distance_miles || a.id - b.id);
          
          // Apply pagination
          rows = inRadius.slice(offset, offset + limit + 1);
          
          // If empty results on first page, find nearest cluster using haversine
          if (rows.length === 0 && offset === 0) {
            // Group pets by location and calculate distance to each cluster
            const clusters = new Map();
            for (const pet of petsWithDistance) {
              const key = `${pet.latitude},${pet.longitude}`;
              if (!clusters.has(key)) {
                clusters.set(key, {
                  latitude: Number(pet.latitude),
                  longitude: Number(pet.longitude),
                  city: pet.city,
                  count: 0,
                  distance: pet.distance_miles,
                });
              }
              clusters.get(key).count++;
            }
            
            // Find nearest cluster
            const nearestCluster = Array.from(clusters.values())
              .sort((a, b) => a.distance - b.distance)
              [0];
            
            if (nearestCluster) {
              suggestedCenter = {
                latitude: nearestCluster.latitude,
                longitude: nearestCluster.longitude,
                city: nearestCluster.city,
                count: nearestCluster.count,
              };
            }
          }
        } catch (fallbackError) {
          console.error("Haversine fallback also failed:", fallbackError.message);
          rows = []; // Fail closed: empty results
          geoSearchFailed = true; // Both PostGIS and haversine failed
        }
      }
    }
    
    // Fall back to non-geo query ONLY if geo search wasn't attempted
    // If geo was attempted (even if it failed), rows is already set
    if (rows === null) {
      rows = await database`
        SELECT id, source_id, verified_at, external_id, name, species, breed, age, sex, size, city, country,
               shelter, image_url, source_url, latitude, longitude, claimed_by_clerk_user_id, organization_id,
               EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = pets.organization_id) AS organization_has_members
        FROM pets
        WHERE status = 'available' 
          AND verified_at IS NOT NULL
          AND species = ANY(${species})
        ORDER BY verified_at DESC, id ASC
        LIMIT ${limit + 1}
        OFFSET ${offset}
      `;
    }
    const hasMore = rows.length > limit;
    const pets = rows.slice(0, limit).map(normalizeDatabasePet);
    
    // Get total unique current pets count for inventory
    const [{ count: uniqueCurrentPets }] = await database`
      SELECT COUNT(*) as count
      FROM pets
      WHERE status = 'available' 
        AND verified_at IS NOT NULL
        AND species = ANY(${species})
    `;
    
    response.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    
    const responseBody = {
      mode: pets.length ? "live" : "empty",
      pets,
      count: pets.length,
      uniqueCurrentPets: Number(uniqueCurrentPets),
      page,
      limit,
      hasMore,
      pagination: "limit-offset",
      fetchedAt: new Date().toISOString(),
      message: pets.length ? undefined : "No verified listings are available yet.",
    };
    
    // Add recenter suggestion when geo search returned 0 results but inventory exists elsewhere
    if (suggestedCenter && pets.length === 0) {
      responseBody.suggestedCenter = suggestedCenter;
      // Use honest empty copy (haversine worked, just found nothing nearby)
      responseBody.message = `No pets found within ${radius} miles. Try searching near ${suggestedCenter.city || "a different location"}.`;
    } else if (geoSearchAttempted && pets.length === 0 && geoSearchFailed) {
      // Both PostGIS and haversine failed completely
      responseBody.message = "Geographic search temporarily unavailable. Please try again or search without location filters.";
    }
    
    return response.status(200).json(responseBody);
  } catch (error) {
    console.error("Pet feed request failed", error);
    return response.status(500).json({
      mode: "error",
      pets: [],
      count: 0,
      message: "Pet feed temporarily unavailable.",
    });
  }
}

export { safeHttpUrl, safeImageUrl };
