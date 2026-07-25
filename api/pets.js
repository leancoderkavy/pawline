import { getDatabase } from "./_db.js";

const API_BASE =
  process.env.RESCUEGROUPS_API_BASE_URL || "https://api.rescuegroups.org/v5";
const MONTGOMERY_API =
  "https://data.montgomerycountymd.gov/resource/e54u-qx42.json";
const KING_COUNTY_API =
  "https://data.kingcounty.gov/resource/yaai-7frk.json";
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
  const upstream = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!upstream.ok) {
    throw new Error(`${provider} returned ${upstream.status}`);
  }
  const payload = await upstream.json();
  if (!Array.isArray(payload)) {
    throw new Error(`${provider} returned an invalid payload`);
  }
  return payload;
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
    image: pet.url?.url?.replace(/^http:/, "https:") || null,
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
    sourceUrl: pet.link?.url || null,
    image: pet.image?.url?.replace(/^http:/, "https:") || null,
    description: cleanText(pet.memo),
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

function normalizeDatabasePet(pet, index) {
  return {
    id: `pawline-${pet.id}`,
    externalId: pet.external_id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed || "Mixed breed",
    age: pet.age || "Age unknown",
    sex: pet.sex || "Unknown",
    size: pet.size || "Unknown",
    distance: 0,
    city: [pet.city, pet.country].filter(Boolean).join(", ") || "Location available from rescue",
    shelter: pet.shelter || "Community rescue",
    rating: null,
    reviews: null,
    source: "Pawline community · Verified",
    sourceUrl: pet.source_url,
    image: pet.image_url,
    x: pet.longitude == null ? 18 + ((index * 17) % 70) : 50,
    y: pet.latitude == null ? 20 + ((index * 23) % 62) : 50,
  };
}

async function fetchDatabasePets() {
  const database = getDatabase();
  if (!database) return [];
  const rows = await database`
    SELECT id, external_id, name, species, breed, age, sex, size, city, country,
           shelter, image_url, source_url, latitude, longitude
    FROM pets
    WHERE status = 'available' AND verified_at IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 200
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
    sourceUrl: attributes.url || organization.adoptionUrl || organization.url || null,
    image:
      picture?.large ||
      picture?.original ||
      attributes.pictureThumbnailUrl ||
      null,
    x: 18 + ((index * 17) % 70),
    y: 20 + ((index * 23) % 62),
  };
}

async function fetchSpecies(species, { limit, page }, apiKey) {
  const view = species === "Cat" ? "cats" : "dogs";
  const url = new URL(
    `/public/animals/search/available/${view}/`,
    API_BASE,
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "random");
  url.searchParams.set("include", "pictures,orgs,locations,species,breeds");

  const upstream = await fetch(url, {
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: apiKey,
    },
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

  const requestedSpecies = request.query.species;
  const species =
    requestedSpecies === "Dog" || requestedSpecies === "Cat"
      ? [requestedSpecies]
      : ["Dog", "Cat"];
  const limit = Math.min(Math.max(Number(request.query.limit) || 24, 1), 100);
  const page = Math.max(Number(request.query.page) || 1, 1);

  try {
    const requests = [
      { id: "Pawline", promise: fetchDatabasePets() },
      {
        id: "Montgomery County",
        promise: fetchMontgomeryPets(species, { limit, page }),
      },
      {
        id: "King County",
        promise: fetchKingCountyPets(species, { limit, page }),
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
    const rescueGroupsStart = 3;
    const payloads = results.slice(rescueGroupsStart)
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const providerPets = payloads.flatMap((payload) =>
      (payload.data || []).map((animal, index) =>
        normalizeAnimal(animal, payload.included || [], index),
      ),
    );
    const pets = [
      ...databasePets,
      ...montgomeryPets,
      ...kingCountyPets,
      ...providerPets,
    ].filter(
      (pet, index, all) =>
        all.findIndex((item) => item.id === pet.id) === index,
    );
    const providerCount = payloads.reduce(
      (total, payload) => total + Number(payload.meta?.count || 0),
      0,
    );
    const expectedProviderFeeds = 2 + (apiKey ? species.length : 0);
    const successfulProviderFeeds =
      Number(results[1]?.status === "fulfilled") +
      Number(results[2]?.status === "fulfilled") +
      payloads.length;
    const isPartial = successfulProviderFeeds !== expectedProviderFeeds;
    const providerUnavailable = successfulProviderFeeds === 0 && databasePets.length === 0;
    const providerNames = [
      databasePets.length && "Pawline",
      montgomeryPets.length && "Montgomery County",
      kingCountyPets.length && "King County",
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
