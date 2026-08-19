import { getDatabase } from "../_db.js";
import { ensureAdoptionPlatformSchema } from "../_adoption-platform.js";
import { purgeExpiredHeldApplications } from "../adoption-applications.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Private application retention is unavailable." });
  try {
    await ensureAdoptionPlatformSchema(database);
    const purged = await purgeExpiredHeldApplications(database);
    return response.status(200).json({ ok: true, purged });
  } catch (error) {
    console.error("Held application purge failed", error.message);
    return response.status(500).json({ error: "Held application retention failed." });
  }
}
