import { getDatabase } from "./_db.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).end();
  }
  const database = getDatabase();
  if (!database) return response.status(503).end();
  const id = typeof request.query?.id === "string" ? request.query.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response.status(400).end();

  try {
    const rows = await database`
      SELECT file.media_type, file.content
      FROM pet_submission_files file
      JOIN pets pet ON pet.id = file.pet_id
      WHERE file.pet_id = ${id}
        AND file.is_primary_photo = true
        AND pet.status = 'available'
      ORDER BY file.created_at
      LIMIT 1
    `;
    if (!rows.length) return response.status(404).end();
    response.setHeader("Content-Type", rows[0].media_type);
    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
    return response.status(200).send(rows[0].content);
  } catch (error) {
    console.error("Pet media lookup failed", error);
    return response.status(500).end();
  }
}
