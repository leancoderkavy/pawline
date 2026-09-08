import { getDatabase } from "./_db.js";
import { PET_SPECIES } from "../config/species.js";
import { normalizeDatabasePet } from "./pets.js";

export function catalogQuery(query = {}) {
  const validId = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || ""),
    );
  const number = (value, min, max) =>
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
      ? Number(value)
      : null;
  const species =
    query.species && query.species !== "All" ? query.species : null;
  if (species && !PET_SPECIES.includes(species))
    throw new Error("Choose a supported species.");
  let cursor = null;
  if (query.cursor) {
    try {
      cursor = JSON.parse(
        Buffer.from(String(query.cursor), "base64url").toString(),
      );
    } catch {
      throw new Error("Invalid search cursor.");
    }
    if (
      !cursor ||
      !validId(cursor.id) ||
      !Number.isFinite(Date.parse(cursor.at))
    )
      throw new Error("Invalid search cursor.");
  }
  const latitude = number(query.latitude, -90, 90),
    longitude = number(query.longitude, -180, 180);
  if (
    (query.latitude !== undefined && latitude === null) ||
    (query.longitude !== undefined && longitude === null)
  )
    throw new Error("Provide valid location coordinates.");
  if (query.id && !validId(query.id)) throw new Error("Choose a valid pet.");
  if ((latitude === null) !== (longitude === null))
    throw new Error("Provide both location coordinates.");
  return {
    id: query.id || null,
    species,
    latitude,
    longitude,
    radius: number(query.radius, 1, 3000) || 150,
    limit: Math.min(Math.max(Math.trunc(Number(query.limit)) || 24, 1), 100),
    after: cursor?.id || "00000000-0000-0000-0000-000000000000",
    at: cursor?.at || new Date().toISOString(),
    text: String(query.q || "")
      .trim()
      .slice(0, 100),
  };
}

export async function searchCatalog(database, options) {
  const { id, species, latitude, longitude, radius, limit, after, at, text } =
    options;
  const rows = await database`
    SELECT p.*, EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = p.organization_id) AS organization_has_members
    FROM pets p LEFT JOIN sources s ON s.id = p.source_id
    WHERE p.status='available' AND p.verified_at IS NOT NULL AND p.id > ${after}::uuid AND p.created_at <= ${at}::timestamptz
      AND (${id}::uuid IS NULL OR p.id=${id}::uuid)
      AND (p.source_id IS NULL OR (s.enabled AND s.last_success_at > now() - interval '48 hours'))
      AND (${species}::text IS NULL OR p.species=${species})
      AND (${text}='' OR strpos(lower(concat_ws(' ',p.name,p.breed,p.shelter,p.city)),lower(${text})) > 0)
      AND (${latitude}::double precision IS NULL OR (p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180
        AND 3958.8 * 2 * asin(sqrt(least(1.0, greatest(0.0,
          power(sin(radians(p.latitude-${latitude})/2),2) + cos(radians(${latitude})) * cos(radians(p.latitude)) * power(sin(radians(p.longitude-${longitude})/2),2))))) <= ${radius}))
    ORDER BY p.id ASC LIMIT ${limit + 1}
  `;
  const page = rows.slice(0, limit);
  return {
    pets: page.map(normalizeDatabasePet),
    nextCursor:
      rows.length > limit
        ? Buffer.from(JSON.stringify({ id: page.at(-1).id, at })).toString(
            "base64url",
          )
        : null,
    asOf: at,
    coverage: "Pawline stored inventory; live provider search is separate.",
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, s-maxage=30");
  if (request.method !== "GET")
    return response.status(405).json({ error: "Method not allowed" });
  let query;
  try {
    query = catalogQuery(request.query);
  } catch (error) {
    return response.status(422).json({ error: error.message });
  }
  const database = getDatabase();
  if (!database)
    return response
      .status(503)
      .json({ error: "Search storage is unavailable." });
  try {
    return response.status(200).json(await searchCatalog(database, query));
  } catch {
    return response
      .status(503)
      .json({ error: "Pet search is temporarily unavailable." });
  }
}
