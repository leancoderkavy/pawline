import { getDatabase } from "./_db.js";
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
    species: requestedSpecies === "Dog" || requestedSpecies === "Cat"
      ? [requestedSpecies]
      : ["Dog", "Cat"],
    limit: Math.min(Math.max(Number(query.limit) || 24, 1), 50),
    page: Math.min(Math.max(Number(query.page) || 1, 1), 20),
  };
}

export function boundMergedPetPage(pets, limit) {
  return pets.slice(0, limit);
}
const MONTGOMERY_ADOPTION_URL =
  "https://www.montgomerycountymd.gov/animalservices/adoption/index.html";
const LOS_ANGELES_CENTERS = {
  LACT: {
    name: "East Valley Animal Shelter",
    address: "14409 Vanowen St, Van Nuys, CA 91405",
    city: "Van Nuys, California, United States",
    latitude: 34.193986435685,
    longitude: -118.446771390738,
  },
  LACT2: {
    name: "West Los Angeles Animal Shelter",
    address: "11361 West Pico Blvd, Los Angeles, CA 90064",
    city: "Los Angeles, California, United States",
    latitude: 34.034628815564,
    longitude: -118.439972412714,
  },
  LACT3: {
    name: "Chesterfield Square / South LA Animal Shelter",
    address: "1850 W 60th St, Los Angeles, CA 90047",
    city: "Los Angeles, California, United States",
    latitude: 33.98517085948,
    longitude: -118.310507744437,
  },
  LACT4: {
    name: "North Central Animal Shelter",
    address: "3201 Lacy St, Los Angeles, CA 90031",
    city: "Los Angeles, California, United States",
    latitude: 34.083720752489,
    longitude: -118.218016326391,
  },
  LACT5: {
    name: "West Valley Animal Shelter",
    address: "20655 Plummer St, Chatsworth, CA 91311",
    city: "Chatsworth, California, United States",
    latitude: 34.242784438194,
    longitude: -118.583183249589,
  },
};

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
  const species = String(value || "").toLowerCase();
  if (species === "dog" || species === "canine") return "Dog";
  if (species === "cat" || species === "feline") return "Cat";
  return null;
}

function socrataUrl(base, { limit, page, where }) {
  const url = new URL(base);
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String((page - 1) * limit));
  if (where) url.searchParams.set("$where", where);
  return url;
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

async function fetchMontgomeryPets(species, options) {
  const type = species.length === 1 ? species[0].toUpperCase() : null;
  const where = type ? `upper(animaltype)='${type}'` : null;
  const rows = await fetchSocrata(
    socrataUrl(MONTGOMERY_API, { ...options, where }),
    "Montgomery County",
  );
  return rows.map(normalizeMontgomeryPet).filter(Boolean);
}

async function fetchKingCountyPets(species, options) {
  const clauses = ["upper(record_type)='ADOPTABLE'"];
  if (species.length === 1) {
    clauses.push(`upper(animal_type)='${species[0].toUpperCase()}'`);
  }
  const rows = await fetchSocrata(
    socrataUrl(KING_COUNTY_API, { ...options, where: clauses.join(" AND ") }),
    "King County",
  );
  return rows.map(normalizeKingCountyPet).filter(Boolean);
}

export function normalizeLosAngelesPet(record) {
  const center = LOS_ANGELES_CENTERS[record.locationCode];
  const species = canonicalSpecies(record.species);
  if (!center || !species || !record.id || !record.name) return null;
  return {
    id: `laas-${record.id.toUpperCase()}`,
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

async function fetchLosAngelesPets(species, { limit, page }) {
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
    return parseLosAngelesPets(await readBoundedText(upstream));
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
    source: "Pawline community · Verified",
    sourceUrl: safeHttpUrl(pet.source_url),
    messageAvailable: pet.organization_id ? Boolean(pet.organization_has_members) : Boolean(pet.claimed_by_clerk_user_id),
    image: safeImageUrl(pet.image_url),
    latitude: pet.latitude == null ? null : Number(pet.latitude),
    longitude: pet.longitude == null ? null : Number(pet.longitude),
    x: pet.longitude == null ? 18 + ((index * 17) % 70) : 50,
    y: pet.latitude == null ? 20 + ((index * 23) % 62) : 50,
  };
}

async function fetchDatabasePets({ limit, page }) {
  const database = getDatabase();
  if (!database) return [];
  const offset = (page - 1) * limit;
  const rows = await database`
    SELECT id, external_id, name, species, breed, age, sex, size, city, country,
           shelter, image_url, source_url, latitude, longitude, claimed_by_clerk_user_id, organization_id,
           EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = pets.organization_id) AS organization_has_members
    FROM pets
    WHERE status = 'available' AND verified_at IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  return rows.map(normalizeDatabasePet);
}

function normalizeAnimal(animal, included, index) {
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
    externalId: String(animal.id),
    name: attributes.name || "New friend",
    species: speciesName,
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

async function fetchSpecies(species, { limit, page }, apiKey) {
  const view = species === "Cat" ? "cats" : "dogs";
  const url = buildRescueGroupsUrl(
    API_BASE,
    `public/animals/search/available/${view}/`,
    {
      limit,
      page,
      sort: "random",
      include: "pictures,orgs,locations,species,breeds",
    },
  );

  const upstream = await fetch(url.toString(), {
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

  const apiKey = process.env.RESCUEGROUPS_API_KEY;

  const { species, limit, page } = normalizePetQuery(request.query);
  const database = getDatabase();
  if (!await reservePetFeedUsage(database, request)) {
    return response.status(429).json({ mode: "error", pets: [], message: "Live adoption feed request limit reached. Try again later." });
  }

  try {
    const requests = [
      { id: "Pawline", promise: fetchDatabasePets({ limit, page }) },
      {
        id: "Montgomery County",
        promise: fetchMontgomeryPets(species, { limit, page }),
      },
      {
        id: "King County",
        promise: fetchKingCountyPets(species, { limit, page }),
      },
      {
        id: "LA Animal Services",
        promise: fetchLosAngelesPets(species, { limit, page }),
      },
    ];
    if (apiKey) {
      requests.push(
        ...species.map((item) => ({
          id: `RescueGroups ${item}`,
          promise: fetchSpecies(item, { limit, page }, apiKey),
        })),
      );
    }
    const results = await Promise.allSettled(requests.map((item) => item.promise));
    const databasePets = results[0]?.status === "fulfilled"
      ? results[0].value.filter((pet) => species.includes(pet.species))
      : [];
    const montgomeryPets = results[1]?.status === "fulfilled" ? results[1].value : [];
    const kingCountyPets = results[2]?.status === "fulfilled" ? results[2].value : [];
    const losAngelesPets = results[3]?.status === "fulfilled" ? results[3].value : [];
    const rescueGroupsStart = 4;
    const payloads = results.slice(rescueGroupsStart)
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const normalizedProviderPets = payloads.flatMap((payload) =>
      (payload.data || []).map((animal, index) =>
        normalizeAnimal(animal, payload.included || [], index),
      ),
    ).filter(isCurrentProviderListing);
    let providerPets = normalizedProviderPets;
    try {
      providerPets = await geocodeRescueGroupsPets(
        normalizedProviderPets,
        process.env.MAPBOX_ACCESS_TOKEN,
      );
    } catch (error) {
      console.error("RescueGroups shelter geocoding unavailable", error);
    }
    const mergedPets = deduplicatePets([
      ...montgomeryPets,
      ...kingCountyPets,
      ...losAngelesPets,
      ...providerPets,
      ...databasePets,
    ]);
    const pets = boundMergedPetPage(mergedPets, limit);
    const providerCount = payloads.reduce(
      (total, payload) => total + Number(payload.meta?.count || 0),
      0,
    );
    const expectedProviderFeeds = 3 + (apiKey ? species.length : 0);
    const successfulProviderFeeds =
      Number(results[1]?.status === "fulfilled") +
      Number(results[2]?.status === "fulfilled") +
      Number(results[3]?.status === "fulfilled") +
      payloads.length;
    const isPartial = successfulProviderFeeds !== expectedProviderFeeds;
    const providerUnavailable = successfulProviderFeeds === 0 && databasePets.length === 0;
    const providerNames = [
      databasePets.length && "Pawline",
      montgomeryPets.length && "Montgomery County",
      kingCountyPets.length && "King County",
      losAngelesPets.length && "LA Animal Services",
      payloads.length && "RescueGroups",
    ].filter(Boolean);
    response.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    return response.status(200).json({
      mode: providerUnavailable ? "error" : pets.length ? "live" : "empty",
      provider: providerNames.join(" + ") || null,
      pets,
      count: pets.length,
      providerCount,
      page,
      limit,
      hasMore: page < 20 && pets.length === limit,
      partial: isPartial,
      fetchedAt: new Date().toISOString(),
      message: providerUnavailable
        ? "Live adoption feeds are temporarily unavailable."
        : isPartial
        ? "One or more live provider feeds are temporarily unavailable."
        : pets.length ? undefined : "No verified live listings are available yet.",
    });
  } catch (error) {
    console.error("Pet feed request failed", error);
    return response.status(200).json({
      mode: "error",
      provider: null,
      pets: [],
      message: "Live adoption feeds are temporarily unavailable.",
    });
  }
}

export { safeHttpUrl, safeImageUrl };
