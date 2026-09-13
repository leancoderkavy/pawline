import { createHash } from "node:crypto";
import { getDatabase } from "../_db.js";
import {
  fetchMontgomeryPets,
  fetchKingCountyPets,
  fetchLosAngelesPets,
  normalizeMontgomeryPet,
  normalizeKingCountyPet,
  normalizeLosAngelesPet,
  fetchSpecies,
  normalizeAnimal,
  geocodeRescueGroupsPets,
  isCurrentProviderListing,
} from "../pets.js";
import { PET_SPECIES } from "../../config/species.js";

const MONTGOMERY_SOURCE_ID = "4eec9ba1-1f85-4e6f-a21b-772f84bb0021";
const KING_COUNTY_SOURCE_ID = "d7fbc275-cf13-40c1-976e-31df071b25c8";
const LA_SOURCE_ID = "b8f3c2a1-4d5e-6f7a-8b9c-0d1e2f3a4b5c";
const RESCUEGROUPS_SOURCE_ID = "c9d4e3b2-5f6a-7b8c-9d0e-1f2a3b4c5d6e";

function createFingerprint(sourceId, externalId) {
  return createHash("sha256")
    .update(`${sourceId}:${externalId}`)
    .digest("hex");
}

async function ingestProvider(database, sourceId, pets, providerName) {
  if (!pets.length) {
    console.log(`${providerName}: no pets to ingest`);
    return { upserted: 0, marked_unavailable: 0 };
  }

  const externalIds = pets.map(p => p.externalId);
  const fingerprints = pets.map(p => createFingerprint(sourceId, p.externalId));

  // Mark pets from this source that are no longer in the feed as unavailable
  const missingPets = await database`
    UPDATE pets
    SET 
      missed_syncs = missed_syncs + 1,
      status = CASE 
        WHEN missed_syncs + 1 >= 3 THEN 'unavailable'
        ELSE status
      END,
      updated_at = now()
    WHERE source_id = ${sourceId}
      AND external_id = ANY(${externalIds})
      AND fingerprint != ANY(${fingerprints})
      AND status = 'available'
    RETURNING id
  `;

  // Upsert the current pets
  const upsertStatements = pets.map(pet => {
    const fingerprint = createFingerprint(sourceId, pet.externalId);
    return database`
      INSERT INTO pets (
        fingerprint, source_id, external_id, name, species, breed, age, sex, size,
        description, city, country, postal_code, latitude, longitude, shelter,
        image_url, source_url, status, verified_at, missed_syncs, updated_at
      ) VALUES (
        ${fingerprint}, ${sourceId}, ${pet.externalId}, ${pet.name}, ${pet.species},
        ${pet.breed || null}, ${pet.age || null}, ${pet.sex || null}, ${pet.size || null},
        ${pet.description || null}, ${pet.city || null}, ${pet.country || null},
        ${pet.postalCode || null}, ${pet.latitude || null}, ${pet.longitude || null},
        ${pet.shelter}, ${pet.image || null}, ${pet.sourceUrl || null},
        'available', now(), 0, now()
      )
      ON CONFLICT (fingerprint) DO UPDATE SET
        name = EXCLUDED.name,
        species = EXCLUDED.species,
        breed = EXCLUDED.breed,
        age = EXCLUDED.age,
        sex = EXCLUDED.sex,
        size = EXCLUDED.size,
        description = EXCLUDED.description,
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        postal_code = EXCLUDED.postal_code,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        shelter = EXCLUDED.shelter,
        image_url = EXCLUDED.image_url,
        source_url = EXCLUDED.source_url,
        status = 'available',
        verified_at = now(),
        missed_syncs = 0,
        updated_at = now()
      WHERE pets.source_id = ${sourceId}
    `;
  });

  await database.transaction(upsertStatements);

  console.log(`${providerName}: upserted ${pets.length} pets, marked ${missingPets.length} as unavailable`);
  return { upserted: pets.length, marked_unavailable: missingPets.length };
}

async function fetchAllMontgomeryPets() {
  const allPets = [];
  for (const species of PET_SPECIES) {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 20) {
      try {
        const pets = await fetchMontgomeryPets([species], { limit: 1000, page });
        allPets.push(...pets);
        hasMore = pets.hasMore && pets.length === 1000;
        page++;
      } catch (error) {
        console.error(`Montgomery County ${species} page ${page} failed:`, error);
        break;
      }
    }
  }
  return allPets.map((pet, index) => ({
    externalId: pet.externalId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: pet.age,
    sex: pet.sex,
    size: pet.size,
    city: "Derwood",
    country: "United States",
    postalCode: "20855",
    latitude: null,
    longitude: null,
    shelter: pet.shelter,
    image: pet.image,
    sourceUrl: pet.sourceUrl,
  }));
}

async function fetchAllKingCountyPets() {
  const allPets = [];
  for (const species of PET_SPECIES) {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 20) {
      try {
        const pets = await fetchKingCountyPets([species], { limit: 1000, page });
        allPets.push(...pets);
        hasMore = pets.hasMore && pets.length === 1000;
        page++;
      } catch (error) {
        console.error(`King County ${species} page ${page} failed:`, error);
        break;
      }
    }
  }
  return allPets.map(pet => ({
    externalId: pet.externalId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: pet.age,
    sex: pet.sex,
    size: pet.size,
    description: pet.description,
    city: pet.city?.split(',')[0]?.trim() || null,
    country: "United States",
    latitude: pet.latitude,
    longitude: pet.longitude,
    shelter: pet.shelter,
    image: pet.image,
    sourceUrl: pet.sourceUrl,
  }));
}

async function fetchAllLosAngelesPets() {
  const allPets = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 20) {
    try {
      const pets = await fetchLosAngelesPets(PET_SPECIES, { limit: 48, page });
      allPets.push(...pets);
      hasMore = pets.hasMore && pets.length === 48;
      page++;
    } catch (error) {
      console.error(`LA Animal Services page ${page} failed:`, error);
      break;
    }
  }
  return allPets.map(pet => ({
    externalId: pet.externalId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: pet.age,
    sex: pet.sex,
    size: pet.size,
    city: pet.city?.split(',')[0]?.trim() || null,
    country: "United States",
    latitude: pet.latitude,
    longitude: pet.longitude,
    shelter: pet.shelter,
    image: pet.image,
    sourceUrl: pet.sourceUrl,
    description: "Details available from LA Animal Services",
  }));
}

async function fetchAllRescueGroupsPets(apiKey) {
  if (!apiKey) {
    console.log("RescueGroups: API key not configured");
    return [];
  }

  const allPets = [];
  for (const species of PET_SPECIES) {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 100) {
      try {
        const payload = await fetchSpecies([species], { limit: 250, page, query: {} }, apiKey);
        const pets = (payload.data || [])
          .map((animal, index) => normalizeAnimal(animal, payload.included || [], index))
          .filter(isCurrentProviderListing);
        
        allPets.push(...pets);
        hasMore = pets.length === 250;
        page++;
      } catch (error) {
        console.error(`RescueGroups ${species} page ${page} failed:`, error);
        break;
      }
    }
  }

  // Geocode RescueGroups pets that don't have coordinates
  try {
    const geocoded = await geocodeRescueGroupsPets(
      allPets,
      process.env.MAPBOX_ACCESS_TOKEN
    );
    return geocoded.map(pet => ({
      externalId: pet.externalId,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      sex: pet.sex,
      size: pet.size,
      city: pet.city?.split(',')[0]?.trim() || null,
      country: pet.city?.includes('United States') ? 'United States' : null,
      latitude: pet.latitude,
      longitude: pet.longitude,
      shelter: pet.shelter,
      image: pet.image,
      sourceUrl: pet.sourceUrl,
    }));
  } catch (error) {
    console.error("RescueGroups geocoding failed:", error);
    return allPets.map(pet => ({
      externalId: pet.externalId,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      sex: pet.sex,
      size: pet.size,
      city: pet.city?.split(',')[0]?.trim() || null,
      country: pet.city?.includes('United States') ? 'United States' : null,
      latitude: pet.latitude,
      longitude: pet.longitude,
      shelter: pet.shelter,
      image: pet.image,
      sourceUrl: pet.sourceUrl,
    }));
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  const database = getDatabase();
  if (!database) {
    return response.status(500).json({ error: "Database unavailable" });
  }

  const startedAt = new Date();
  const results = {};

  try {
    // Fetch from Montgomery County
    console.log("Fetching Montgomery County pets...");
    const montgomeryPets = await fetchAllMontgomeryPets();
    results.montgomery = await ingestProvider(
      database,
      MONTGOMERY_SOURCE_ID,
      montgomeryPets,
      "Montgomery County"
    );
  } catch (error) {
    console.error("Montgomery County ingestion failed:", error);
    results.montgomery = { error: error.message };
  }

  try {
    // Fetch from King County
    console.log("Fetching King County pets...");
    const kingCountyPets = await fetchAllKingCountyPets();
    results.kingCounty = await ingestProvider(
      database,
      KING_COUNTY_SOURCE_ID,
      kingCountyPets,
      "King County"
    );
  } catch (error) {
    console.error("King County ingestion failed:", error);
    results.kingCounty = { error: error.message };
  }

  try {
    // Fetch from LA Animal Services
    console.log("Fetching LA Animal Services pets...");
    const laPets = await fetchAllLosAngelesPets();
    results.losAngeles = await ingestProvider(
      database,
      LA_SOURCE_ID,
      laPets,
      "LA Animal Services"
    );
  } catch (error) {
    console.error("LA Animal Services ingestion failed:", error);
    results.losAngeles = { error: error.message };
  }

  try {
    // Fetch from RescueGroups
    console.log("Fetching RescueGroups pets...");
    const rescueGroupsPets = await fetchAllRescueGroupsPets(process.env.RESCUEGROUPS_API_KEY);
    results.rescueGroups = await ingestProvider(
      database,
      RESCUEGROUPS_SOURCE_ID,
      rescueGroupsPets,
      "RescueGroups"
    );
  } catch (error) {
    console.error("RescueGroups ingestion failed:", error);
    results.rescueGroups = { error: error.message };
  }

  const finishedAt = new Date();
  const elapsedMs = finishedAt - startedAt;

  return response.status(200).json({
    status: "completed",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs,
    results,
  });
}
