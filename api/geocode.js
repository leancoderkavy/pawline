import { getDatabase } from "./_db.js";
import { consumeUsageChain, requestClientKey } from "./_usage-limit.js";

const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/search/geocode/v6/forward";
const MAPBOX_LOCATION_TYPES = "address,street,place,locality,neighborhood,postcode,region,country";

function sessionToken(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
  if (query.length < 2 || query.length > 160) {
    return response.status(400).json({ error: "Enter a city, state, or postal code." });
  }
  if (!process.env.MAPBOX_ACCESS_TOKEN) {
    return response.status(503).json({ error: "Location search is not configured." });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Location search safety checks are unavailable." });
  try {
    const reservation = await consumeUsageChain(database, [
      { scope: "geocode_client", subject: requestClientKey(request), limit: 60, windowMs: 60 * 60 * 1000 },
      { scope: "geocode_global", subject: "all", limit: 2000, windowMs: 60 * 60 * 1000 },
    ]);
    if (!reservation.allowed) return response.status(429).json({ error: "Location search limit reached. Try again later." });
  } catch {
    return response.status(503).json({ error: "Location search safety checks are unavailable." });
  }

  const url = new URL(MAPBOX_GEOCODING_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", process.env.MAPBOX_ACCESS_TOKEN);
  url.searchParams.set("types", MAPBOX_LOCATION_TYPES);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");
  const searchSession = sessionToken(request.query.session_token);
  if (searchSession) url.searchParams.set("session_token", searchSession);

  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!upstream.ok) {
      throw new Error(`Mapbox returned ${upstream.status}`);
    }
    const payload = await upstream.json();
    const results = (payload.features || []).map((feature) => ({
      id: feature.id,
      name:
        feature.properties?.full_address ||
        feature.properties?.name_preferred ||
        feature.properties?.name ||
        query,
      longitude: feature.geometry?.coordinates?.[0],
      latitude: feature.geometry?.coordinates?.[1],
      countryCode: feature.properties?.context?.country?.country_code || null,
      postcode: feature.properties?.context?.postcode?.name || null,
    }));
    response.setHeader("Cache-Control", "public, s-maxage=86400");
    return response.status(200).json({ results });
  } catch (error) {
    console.error("Geocoding request failed", error);
    return response.status(502).json({ error: "Location search is temporarily unavailable." });
  }
}
