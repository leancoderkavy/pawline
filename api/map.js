const FALLBACK_CENTER = [-118.1445, 34.1478];

const inRange = (value, min, max) =>
  Number.isFinite(value) && value >= min && value <= max;

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).end();
  }
  if (!process.env.MAPBOX_ACCESS_TOKEN) {
    return response.status(404).end();
  }

  const longitude = Number(request.query.longitude);
  const latitude = Number(request.query.latitude);
  const center = [
    inRange(longitude, -180, 180) ? longitude : FALLBACK_CENTER[0],
    inRange(latitude, -90, 90) ? latitude : FALLBACK_CENTER[1],
  ];
  const points = String(request.query.points || "")
    .split("|")
    .slice(0, 40)
    .map((point) => {
      const [rawLongitude, rawLatitude, type] = point.split(",");
      const pointLongitude = Number(rawLongitude);
      const pointLatitude = Number(rawLatitude);
      if (!inRange(pointLongitude, -180, 180) || !inRange(pointLatitude, -90, 90)) {
        return null;
      }
      return {
        longitude: pointLongitude,
        latitude: pointLatitude,
        type: type === "e" ? "e" : "p",
      };
    })
    .filter(Boolean);
  const overlays = [
    `pin-s+244b3a(${center[0]},${center[1]})`,
    ...points.map((point) =>
      `pin-s+${point.type === "e" ? "ad5d35" : "2f7458"}(${point.longitude},${point.latitude})`,
    ),
  ];
  const camera = points.length ? "auto" : `${center[0]},${center[1]},10,0`;
  const imageSize = request.query.variant === "mobile" ? "450x760" : "900x620";
  const url = new URL(
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(",")}/${camera}/${imageSize}`,
  );
  url.searchParams.set("access_token", process.env.MAPBOX_ACCESS_TOKEN);
  url.searchParams.set("logo", "true");
  url.searchParams.set("attribution", "true");
  if (points.length) url.searchParams.set("padding", "60");

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) return response.status(502).end();
    const image = Buffer.from(await upstream.arrayBuffer());
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
    response.setHeader("Cache-Control", "public, s-maxage=86400");
    return response.status(200).send(image);
  } catch (error) {
    console.error("Static map request failed", error);
    return response.status(502).end();
  }
}
