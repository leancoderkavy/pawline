import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureAdoptionPlatformSchema, isUuid } from "./_adoption-platform.js";

const STATES = new Set(["continues", "changed", "prefer_not_to_say"]);

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Placement check-ins are temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  try {
    await ensureAdoptionPlatformSchema(database);
    if (request.method === "GET") {
      const rows = await database`
        SELECT c.application_id, c.due_at, c.requested_at, c.adopter_confirmed_at, c.placement_state
        FROM adoption_placement_checkins c
        JOIN adoption_applications a ON a.id = c.application_id
        WHERE a.clerk_user_id = ${user.id} ORDER BY c.due_at DESC LIMIT 20
      `;
      return response.status(200).json({ checkins: rows.map((row) => ({
        applicationId: row.application_id, dueAt: row.due_at, requestedAt: row.requested_at,
        confirmedAt: row.adopter_confirmed_at || null, placementState: row.placement_state || null,
      })) });
    }
    const applicationId = String(request.body?.applicationId || "");
    const placementState = String(request.body?.placementState || "");
    if (!isUuid(applicationId) || !STATES.has(placementState)) {
      return response.status(422).json({ error: "Choose a valid adoption and placement update." });
    }
    const rows = await database`
      WITH due AS (
        SELECT c.application_id FROM adoption_placement_checkins c
        JOIN adoption_applications a ON a.id = c.application_id
        WHERE c.application_id = ${applicationId} AND a.clerk_user_id = ${user.id}
          AND a.status = 'adopted' AND c.adopter_confirmed_at IS NULL AND c.due_at <= now()
      ), updated AS (
        UPDATE adoption_placement_checkins c SET adopter_confirmed_at = now(), placement_state = ${placementState}, updated_at = now()
        WHERE c.application_id IN (SELECT application_id FROM due) RETURNING c.application_id
      ), event AS (
        INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
        SELECT application_id, 'outcome_confirmed', 'adopter', ${user.id}, ${JSON.stringify({ placementCheckin: placementState })} FROM updated
      ) SELECT application_id FROM updated
    `;
    if (!rows[0]) return response.status(409).json({ error: "This placement check-in is not due or was already completed." });
    return response.status(200).json({ applicationId, placementState, message: "Thank you for sharing a placement update." });
  } catch (error) {
    console.error("Placement check-in failed", error.message);
    return response.status(error.statusCode || 503).json({ error: "Placement check-ins are temporarily unavailable." });
  }
}
