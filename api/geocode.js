const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/search/geocode/v6/forward";

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

  const url = new URL(MAPBOX_GEOCODING_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", process.env.MAPBOX_ACCESS_TOKEN);
  url.searchParams.set("types", "place,postcode,region,country");
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");

  try {
    const upstream = await fetch(url, {
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
