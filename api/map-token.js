export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const accessToken = process.env.MAPBOX_ACCESS_TOKEN || "";
  if (!accessToken.startsWith("pk.")) {
    return response.status(503).json({ error: "Interactive maps are not configured." });
  }

  response.setHeader("Cache-Control", "private, no-store");
  return response.status(200).json({ accessToken });
}
