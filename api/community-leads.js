import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureCommunityTables } from "./_community.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Community storage is not configured." });
  try { await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  await ensureCommunityTables(database);
  const rows = await database`
    SELECT id, source_url, source_domain, name, species, breed, age, description,
      image_url, city, country, latitude, longitude, verification_state, created_at
    FROM community_leads
    WHERE verification_state != 'rejected'
    ORDER BY created_at DESC
    LIMIT 40
  `;
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ leads: rows.map((row) => ({
    id: row.id,
    sourceUrl: row.source_url,
    sourceDomain: row.source_domain,
    name: row.name,
    species: row.species,
    breed: row.breed,
    age: row.age,
    description: row.description,
    imageUrl: row.image_url,
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    verificationState: row.verification_state,
    createdAt: row.created_at,
  })) });
}

