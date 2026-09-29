import { timingSafeEqual } from "node:crypto";
import { getDatabase } from "./_db.js";
import { getSeoJob, requireSeoPipelineSchema } from "./_ai-seo-pipeline.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorized(request, expected) {
  const supplied = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.SEO_PIPELINE_SECRET;
  if (!secret) return response.status(503).json({ error: "AI SEO pipeline administration is not configured." });
  if (!authorized(request, secret)) return response.status(401).json({ error: "Unauthorized" });
  if (request.method === "POST") {
    return response.status(410).json({ error: "SEO research and new jobs are disabled." });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "AI SEO pipeline storage is not configured." });
  try {
    await requireSeoPipelineSchema(database);
    const jobId = String(request.query?.job || "");
    if (!UUID.test(jobId)) return response.status(422).json({ error: "A valid job id is required." });
    const job = await getSeoJob(database, jobId);
    return job ? response.status(200).json({ job }) : response.status(404).json({ error: "SEO job not found." });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "ai_seo_admin_failed", error: error instanceof Error ? error.message : "Unknown error" }));
    return response.status(503).json({ error: "AI SEO pipeline is temporarily unavailable." });
  }
}
