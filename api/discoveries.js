export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({
    mode: "disabled",
    discoveries: [],
    count: 0,
    message: "Web discovery is disabled.",
  });
}
