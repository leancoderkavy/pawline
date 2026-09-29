import { createHash } from "node:crypto";
import { getDatabase } from "../_db.js";
import {
  fetchLosAngelesPets,
  fetchSpecies,
  normalizeAnimal,
  geocodeRescueGroupsPets,
  isCurrentProviderListing,
} from "../pets.js";
import { PET_SPECIES } from "../../config/species.js";
import { importImageUrl } from "../_import-image.js";

const LA_SOURCE_ID = "b8f3c2a1-4d5e-6f7a-8b9c-0d1e2f3a4b5c";
const RESCUEGROUPS_SOURCE_ID = "c9d4e3b2-5f6a-7b8c-9d0e-1f2a3b4c5d6e";
const RESCUEGROUPS_MAX_PAGES = 20; // Bound pagination to avoid timeout
// Nationwide Dog/Cat searches exceed the bounded snapshot. Other pet types
// can complete independently, so keep those listings current for the map.
export const RESCUEGROUPS_SYNC_SPECIES = PET_SPECIES.filter(species => species !== "Dog" && species !== "Cat");
const RESCUEGROUPS_OFF_SCOPE_SPECIES = ["Dog", "Cat"];

function createFingerprint(sourceId, externalId) {
  return createHash("sha256")
    .update(`${sourceId}:${externalId}`)
    .digest("hex");
}

export async function recordProviderRun(database, sourceId, { error = null, fetched = 0, upserted = 0 } = {}) {
  const message = error ? String(error.message || error).slice(0, 1000) : null;
  await database.transaction([
    database`INSERT INTO ingestion_runs (source_id, status, error, fetched_count, upserted_count, finished_at)
      VALUES (${sourceId}, ${message ? "error" : "success"}, ${message}, ${fetched}, ${upserted}, now())`,
    database`UPDATE sources SET last_run_at=now(),
      last_success_at=CASE WHEN ${message}::text IS NULL THEN now() ELSE last_success_at END,
      last_error=${message}, updated_at=now() WHERE id=${sourceId}`,
  ]);
}

export async function ingestProvider(database, sourceId, pets, providerName) {
  const fetched = pets.length;
  pets = pets.map(pet => ({ ...pet, image: importImageUrl(pet.image) }))
    .filter(pet => pet.image);
  const skipped_without_image = fetched - pets.length;
  if (!pets.length) {
    console.log(`${providerName}: no pets to ingest`);
    return { upserted: 0, marked_unavailable: 0, skipped_without_image };
  }

  const syncStartedAt = new Date();
  const fingerprints = pets.map(p => createFingerprint(sourceId, p.externalId));

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

  // Mark pets from this source that were NOT in this snapshot as missed
  // (pets that ARE in the snapshot were just updated above with verified_at=now())
  const missingPets = await database`
    UPDATE pets
    SET 
      missed_syncs = missed_syncs + 1,
      status = CASE 
        WHEN missed_syncs + 1 >= 2 THEN 'unavailable'
        ELSE status
      END,
      updated_at = now()
    WHERE source_id = ${sourceId}
      AND status = 'available'
      AND verified_at < ${syncStartedAt.toISOString()}
    RETURNING id
  `;

  console.log(`${providerName}: upserted ${pets.length} pets, marked ${missingPets.length} as unavailable`);
  return { upserted: pets.length, marked_unavailable: missingPets.length, skipped_without_image };
}

export async function retireProviderSpecies(database, sourceId, species) {
  const retired = await database`
    UPDATE pets SET status='unavailable', missed_syncs=GREATEST(missed_syncs, 2), updated_at=now()
    WHERE source_id=${sourceId} AND species = ANY(${species}) AND status='available'
    RETURNING id
  `;
  return retired.length;
}

export async function fetchAllLosAngelesPets(fetchPage = fetchLosAngelesPets) {
  const allPets = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 20) {
    const pets = await fetchPage(PET_SPECIES, { limit: 48, page });
    allPets.push(...pets);
    hasMore = Boolean(pets.hasMore);
    page++;
  }
  if (hasMore) throw new Error("LA Animal Services pagination limit reached; snapshot is incomplete");
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

export async function fetchAllRescueGroupsPets(apiKey, fetchPage = fetchSpecies) {
  if (!apiKey) {
    throw new Error("RescueGroups API key is not configured");
  }

  const imageShape = value => {
    if (typeof value !== "string") return typeof value;
    if (/^https:\/\//i.test(value)) return "https-absolute";
    if (/^http:\/\//i.test(value)) return "http-absolute";
    if (/^\/\//.test(value)) return "protocol-relative";
    if (/^\//.test(value)) return "root-relative";
    return "other-string";
  };
  const countShape = (counts, value) => {
    const shape = imageShape(value);
    counts[shape] = (counts[shape] || 0) + 1;
  };
  const allPets = [];
  const photoDiagnostics = {
    animals: 0,
    pictureRelationships: 0,
    includedPictures: 0,
    includedPictureUrls: 0,
    thumbnailUrls: 0,
    normalizedImages: 0,
    animalAttributeKeys: [],
    pictureAttributeKeys: [],
    relationshipTypes: {},
    includedTypes: {},
    matchedPictureReferences: 0,
    largeUrlShapes: {},
    thumbnailUrlShapes: {},
  };
  for (const species of RESCUEGROUPS_SYNC_SPECIES) {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= RESCUEGROUPS_MAX_PAGES) {
      const payload = await fetchPage([species], { limit: 250, page, query: {} }, apiKey);
      if (!Array.isArray(payload?.data)) throw new Error(`RescueGroups ${species} page ${page} returned an invalid animal page`);
      const includedPictures = (payload.included || []).filter(item => item.type === "pictures");
      photoDiagnostics.animals += payload.data.length;
      photoDiagnostics.pictureRelationships += payload.data.filter(item => item.relationships?.pictures?.data?.length).length;
      photoDiagnostics.includedPictures += includedPictures.length;
      photoDiagnostics.includedPictureUrls += includedPictures.filter(item => item.attributes?.large || item.attributes?.original || item.attributes?.small).length;
      photoDiagnostics.thumbnailUrls += payload.data.filter(item => item.attributes?.pictureThumbnailUrl).length;
      for (const item of includedPictures) {
        photoDiagnostics.includedTypes[item.type] = (photoDiagnostics.includedTypes[item.type] || 0) + 1;
        countShape(photoDiagnostics.largeUrlShapes, item.attributes?.large);
      }
      for (const item of payload.data) {
        const refs = item.relationships?.pictures?.data || [];
        for (const ref of Array.isArray(refs) ? refs : [refs]) {
          photoDiagnostics.relationshipTypes[ref.type] = (photoDiagnostics.relationshipTypes[ref.type] || 0) + 1;
          if (includedPictures.some(pic => pic.type === ref.type && String(pic.id) === String(ref.id))) photoDiagnostics.matchedPictureReferences++;
        }
        countShape(photoDiagnostics.thumbnailUrlShapes, item.attributes?.pictureThumbnailUrl);
      }
      if (!photoDiagnostics.animalAttributeKeys.length && payload.data.length) photoDiagnostics.animalAttributeKeys = Object.keys(payload.data[0].attributes || {});
      if (!photoDiagnostics.pictureAttributeKeys.length && includedPictures.length) photoDiagnostics.pictureAttributeKeys = Object.keys(includedPictures[0].attributes || {});
      const pets = payload.data
        .map((animal, index) => normalizeAnimal(animal, payload.included || [], index))
        .filter(isCurrentProviderListing);
      photoDiagnostics.normalizedImages += pets.filter(pet => pet.image).length;

      allPets.push(...pets);
      hasMore = payload.data.length === 250;
      page++;

      if (page % 5 === 0) {
        console.log(`RescueGroups ${species}: fetched ${page} pages, ${allPets.length} pets so far`);
      }
    }
    if (hasMore) throw new Error(`RescueGroups ${species} pagination limit reached; snapshot is incomplete`);
  }

  // Geocode RescueGroups pets that don't have coordinates
  try {
    const geocoded = await geocodeRescueGroupsPets(
      allPets,
      process.env.MAPBOX_ACCESS_TOKEN
    );
    const mapped = geocoded.map(pet => ({
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
    mapped.photoDiagnostics = photoDiagnostics;
    return mapped;
  } catch (error) {
    console.error("RescueGroups geocoding failed:", error);
    const mapped = allPets.map(pet => ({
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
    mapped.photoDiagnostics = photoDiagnostics;
    return mapped;
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
    // Fetch from LA Animal Services
    console.log("Fetching LA Animal Services pets...");
    const laPets = await fetchAllLosAngelesPets();
    if (!laPets.length) throw new Error("LA Animal Services returned an empty snapshot");
    results.losAngeles = await ingestProvider(
      database,
      LA_SOURCE_ID,
      laPets,
      "LA Animal Services"
    );
    if (!results.losAngeles.upserted) throw new Error("LA Animal Services snapshot has no usable pet photos");
    await recordProviderRun(database, LA_SOURCE_ID, { fetched: laPets.length, upserted: results.losAngeles.upserted });
  } catch (error) {
    console.error("LA Animal Services ingestion failed:", error);
    results.losAngeles = { error: error.message };
    await recordProviderRun(database, LA_SOURCE_ID, { error });
  }

  try {
    // Fetch from RescueGroups
    console.log("Fetching RescueGroups pets...");
    const rescueGroupsPets = await fetchAllRescueGroupsPets(process.env.RESCUEGROUPS_API_KEY);
    if (!rescueGroupsPets.length) throw new Error("RescueGroups returned an empty snapshot");
    results.rescueGroups = await ingestProvider(
      database,
      RESCUEGROUPS_SOURCE_ID,
      rescueGroupsPets,
      "RescueGroups"
    );
    if (!results.rescueGroups.upserted) throw new Error(`RescueGroups snapshot has no usable pet photos: ${JSON.stringify(rescueGroupsPets.photoDiagnostics || {})}`);
    results.rescueGroups.retired_off_scope = await retireProviderSpecies(
      database, RESCUEGROUPS_SOURCE_ID, RESCUEGROUPS_OFF_SCOPE_SPECIES
    );
    await recordProviderRun(database, RESCUEGROUPS_SOURCE_ID, { fetched: rescueGroupsPets.length, upserted: results.rescueGroups.upserted });
  } catch (error) {
    console.error("RescueGroups ingestion failed:", error);
    results.rescueGroups = { error: error.message };
    await recordProviderRun(database, RESCUEGROUPS_SOURCE_ID, { error });
  }

  const finishedAt = new Date();
  const elapsedMs = finishedAt - startedAt;

  console.log(`Ingestion completed in ${elapsedMs}ms`);

  return response.status(results.losAngeles?.error || results.rescueGroups?.error ? 502 : 200).json({
    status: results.losAngeles?.error || results.rescueGroups?.error ? "partial" : "completed",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs,
    results,
    note: "Montgomery County and King County are ingested via Python scripts/ingest.py",
  });
}
