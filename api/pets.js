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

function normalizeAnimal(animal, included, index) {
  const attributes = animal.attributes || {};
  const pictures = findRelated(included, animal.relationships?.pictures) || [];
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

async function fetchSpecies(species, limit, apiKey) {
  const view = species === "Cat" ? "cats" : "dogs";
  const url = new URL(
    `/public/animals/search/available/${view}/`,
    API_BASE,
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "random");
  url.searchParams.set("include", "pictures,orgs,locations,species");

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
  if (!apiKey) {
    response.setHeader("Cache-Control", "public, s-maxage=60");
    return response.status(200).json({
      mode: "demo",
      provider: null,
      pets: [],
      message: "Live partner feed is ready but not configured.",
    });
  }

  const requestedSpecies = request.query.species;
  const species =
    requestedSpecies === "Dog" || requestedSpecies === "Cat"
      ? [requestedSpecies]
      : ["Dog", "Cat"];

  try {
    const payloads = await Promise.all(
      species.map((item) => fetchSpecies(item, 24, apiKey)),
    );
    const pets = payloads.flatMap((payload) =>
      (payload.data || []).map((animal, index) =>
        normalizeAnimal(animal, payload.included || [], index),
      ),
    );
    response.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=900",
    );
    return response.status(200).json({
      mode: "live",
      provider: "RescueGroups",
      pets,
      count: pets.length,
    });
  } catch (error) {
    console.error("RescueGroups request failed", error);
    return response.status(502).json({
      mode: "error",
      provider: "RescueGroups",
      pets: [],
      message: "The live adoption feed is temporarily unavailable.",
    });
  }
}
