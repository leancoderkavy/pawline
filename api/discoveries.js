import { getDatabase } from "./_db.js";
import { requireDiscoverySchema } from "./_tavily-discovery.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) {
    return response.status(200).json({
      mode: "unavailable",
      discoveries: [],
      message: "Web discovery storage is not configured.",
    });
  }
  try {
    await requireDiscoverySchema(database);
    const rows = await database`
      SELECT id, title, snippet, source_url, source_domain, city,
             latitude, longitude, species, first_seen_at, last_seen_at
      FROM web_discoveries
      WHERE status='current'
        AND last_seen_at >= now() - interval '14 days'
      ORDER BY last_seen_at DESC, title ASC
      LIMIT 30
    `;
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return response.status(200).json({
      mode: rows.length ? "live" : "empty",
      discoveries: rows,
      count: rows.length,
      provider: "Tavily web search",
      message: rows.length
        ? undefined
        : "Scheduled web discovery has not produced any current adoption leads yet.",
    });
  } catch (error) {
    console.error("Web discoveries request failed", error);
    return response.status(200).json({
      mode: "error",
      discoveries: [],
      message: "Web discovery leads are temporarily unavailable.",
    });
  }
}
