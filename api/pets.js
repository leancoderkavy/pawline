import { getDatabase } from "./_db.js";

const API_BASE =
  process.env.RESCUEGROUPS_API_BASE_URL || "https://api.rescuegroups.org/v5";

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
    const requests = [fetchDatabasePets()];
    if (apiKey) {
      requests.push(...species.map((item) => fetchSpecies(item, { limit, page }, apiKey)));
    }
    const results = await Promise.allSettled(requests);
    const databasePets =
      results[0]?.status === "fulfilled"
        ? results[0].value.filter((pet) => species.includes(pet.species))
        : [];
    const payloads = results
      .slice(1)
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const providerPets = payloads.flatMap((payload) =>
      (payload.data || []).map((animal, index) =>
        normalizeAnimal(animal, payload.included || [], index),
      ),
    );
    const pets = [...databasePets, ...providerPets].filter(
      (pet, index, all) =>
        all.findIndex((item) => item.sourceUrl && item.sourceUrl === pet.sourceUrl) === index ||
        !pet.sourceUrl,
    );
    const providerCount = payloads.reduce(
      (total, payload) => total + Number(payload.meta?.count || 0),
      0,
    );
    const isPartial = Boolean(apiKey) && payloads.length !== species.length;
    response.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    return response.status(200).json({
      mode: pets.length ? "live" : "demo",
      provider: [databasePets.length && "Pawline", payloads.length && "RescueGroups"]
        .filter(Boolean)
        .join(" + ") || null,
      pets,
      count: pets.length,
      providerCount,
      page,
      partial: isPartial,
      fetchedAt: new Date().toISOString(),
      message: isPartial
        ? "One live species feed is temporarily unavailable."
        : pets.length ? undefined : "No verified live listings are available yet.",
    });
  } catch (error) {
    console.error("Pet feed request failed", error);
    return response.status(200).json({
      mode: "demo",
      provider: null,
      pets: [],
      message: "Live adoption feeds are temporarily unavailable.",
    });
  }
}
