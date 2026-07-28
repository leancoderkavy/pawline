import { runTavilyDiscovery } from "../_tavily-discovery.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.authorization !== `Bearer ${expected}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await runTavilyDiscovery();
    return response.status(result.errors.length ? 207 : 200).json({ ok: true, result });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      msg: "tavily_discovery_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return response.status(500).json({ ok: false, error: "Discovery failed" });
  }
}
