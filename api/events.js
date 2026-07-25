import { getDatabase } from "./_db.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const database = getDatabase();
  if (!database) {
    return response.status(200).json({
      mode: "unconfigured",
      events: [],
      message: "Verified adoption events are not configured yet.",
    });
  }

  try {
    const rows = await database`
      SELECT id, title, venue, city, country, starts_at, ends_at, source_url
      FROM adoption_events
      WHERE status = 'published' AND starts_at >= now()
      ORDER BY starts_at ASC
      LIMIT 20
    `;
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return response.status(200).json({
      mode: rows.length ? "live" : "empty",
      events: rows,
      count: rows.length,
      message: rows.length ? undefined : "No verified upcoming events are available.",
    });
  } catch (error) {
    console.error("Event feed request failed", error);
    return response.status(502).json({
      mode: "error",
      events: [],
      message: "Verified events are temporarily unavailable.",
    });
  }
}
