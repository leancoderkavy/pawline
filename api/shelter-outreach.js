import { timingSafeEqual } from "node:crypto";
import { getDatabase } from "./_db.js";
import {
  apiError,
  approveShelterOutreachDraft,
  enrichShelterCandidate,
  getShelterCandidate,
  isUuid,
  listShelterCandidates,
  queueDiscoveryCandidates,
  requireShelterOutreachSchema,
  sendApprovedShelterEmail,
  suppressShelterCandidate,
} from "./_shelter-outreach.js";

function authorized(request, expected) {
  const supplied = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function candidateId(value) {
  if (!isUuid(value)) throw apiError("A valid candidate id is required.", 422);
  return value;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.SHELTER_OUTREACH_SECRET;
  if (!secret) return response.status(503).json({ error: "Shelter outreach administration is not configured." });
  if (!authorized(request, secret)) return response.status(401).json({ error: "Unauthorized" });
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Shelter outreach storage is not configured." });
  try {
    await requireShelterOutreachSchema(database);
    if (request.method === "GET") {
      const id = request.query?.candidate;
      if (id) {
        const candidate = await getShelterCandidate(database, candidateId(id));
        return candidate ? response.status(200).json({ candidate }) : response.status(404).json({ error: "Shelter outreach candidate not found." });
      }
      return response.status(200).json({ candidates: await listShelterCandidates(database, request.query?.limit) });
    }
    const action = String(request.body?.action || "");
    if (action === "queue-discoveries") {
      return response.status(202).json(await queueDiscoveryCandidates(database, request.body?.limit));
    }
    if (action === "enrich") {
      if (request.body?.consentToAiProcessing !== true) {
        return response.status(422).json({ error: "Confirm that only the stored public discovery evidence may be sent to AI Gateway." });
      }
      const candidate = await enrichShelterCandidate(database, candidateId(request.body?.candidateId));
      return response.status(202).json({
        candidate,
        boundary: "Review every extracted field before preparing a contact draft. This candidate is not a verified source or public listing.",
      });
    }
    if (action === "approve-draft") {
      const candidate = await approveShelterOutreachDraft(database, candidateId(request.body?.candidateId), request.body);
      return response.status(202).json({
        candidate,
        boundary: "This is an unsent review draft. A separate explicit send action is required.",
      });
    }
    if (action === "send-email") {
      if (request.body?.sendConfirmation !== "send-reviewed-email") {
        return response.status(422).json({ error: "Confirm the reviewed recipient and exact draft before sending." });
      }
      const result = await sendApprovedShelterEmail(database, candidateId(request.body?.candidateId));
      return response.status(202).json({ candidate: result.candidate, sent: true });
    }
    if (action === "suppress") {
      const candidate = await suppressShelterCandidate(database, candidateId(request.body?.candidateId), request.body?.reason);
      return response.status(202).json({ candidate });
    }
    return response.status(422).json({ error: "Choose queue-discoveries, enrich, approve-draft, send-email, or suppress." });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error", msg: "shelter_outreach_admin_failed",
      action: request.body?.action || "read",
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return response.status(error?.statusCode || 503).json({
      error: error?.statusCode === 429 ? error.message : "Shelter outreach is temporarily unavailable.",
    });
  }
}
