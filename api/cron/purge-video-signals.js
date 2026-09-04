import { getDatabase } from "../_db.js";
import { ensureDirectMessageTables } from "../_direct.js";
import { purgeExpiredVideoSignals } from "../_direct-video.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: "Unauthorized" });
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Video retention is temporarily unavailable." });
  try {
    await ensureDirectMessageTables(database);
    const purged = await purgeExpiredVideoSignals(database);
    return response.status(200).json({ ok: true, purged });
  } catch { return response.status(503).json({ error: "Video retention is temporarily unavailable." }); }
}
