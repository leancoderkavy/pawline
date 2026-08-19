import { runNextSeoJob } from "../_ai-seo-pipeline.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.authorization !== `Bearer ${expected}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await runNextSeoJob();
    return response.status(result.state === "error" ? 207 : 200).json({ ok: result.state !== "error", result });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error", msg: "ai_seo_cron_failed", error: error instanceof Error ? error.message : "Unknown error",
    }));
    return response.status(503).json({ ok: false, error: "AI SEO pipeline is unavailable." });
  }
}
