import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { adoptionError, ensureAdoptionPlatformSchema, isUuid } from "./_adoption-platform.js";

const OUTCOMES = new Set(["adopted", "not_adopted", "placement_changed"]);

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Adoption outcome confirmation is temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  const applicationId = String(request.body?.applicationId || "");
  const outcome = String(request.body?.outcome || "");
  if (!isUuid(applicationId) || !OUTCOMES.has(outcome)) return response.status(422).json({ error: "Choose a valid application and outcome." });
  try {
    await ensureAdoptionPlatformSchema(database);
    const result = await database`
      WITH owned AS (
        SELECT id FROM adoption_applications
        WHERE id = ${applicationId} AND clerk_user_id = ${user.id}
          AND status = 'adoption_pending'
      ), confirmed AS (
        INSERT INTO adoption_outcome_confirmations (application_id, confirmed_by_clerk_user_id, confirmer_role, outcome)
        SELECT id, ${user.id}, 'adopter', ${outcome} FROM owned
        ON CONFLICT (application_id, confirmer_role) DO UPDATE SET
          outcome = EXCLUDED.outcome, confirmed_by_clerk_user_id = EXCLUDED.confirmed_by_clerk_user_id, confirmed_at = now()
        RETURNING application_id
      ), reconciled AS (
        UPDATE adoption_applications a SET
          status = CASE
            WHEN EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'organization' AND o.outcome = 'adopted')
              AND ${outcome} = 'adopted' THEN 'adopted'
            WHEN EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'organization' AND o.outcome = 'not_adopted')
              AND ${outcome} = 'not_adopted' THEN 'withdrawn'
            WHEN EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'organization' AND o.outcome = 'placement_changed')
              AND ${outcome} = 'placement_changed' THEN 'withdrawn'
            ELSE a.status END,
          closed_at = CASE WHEN (
            (EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'organization' AND o.outcome = 'adopted') AND ${outcome} = 'adopted') OR
            (EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'organization' AND o.outcome = 'not_adopted') AND ${outcome} = 'not_adopted') OR
            (EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'organization' AND o.outcome = 'placement_changed') AND ${outcome} = 'placement_changed')
          ) THEN now() ELSE a.closed_at END,
          updated_at = now()
        WHERE a.id IN (SELECT application_id FROM confirmed)
          AND a.status = 'adoption_pending'
        RETURNING a.id, a.status
      ), checkin AS (
        INSERT INTO adoption_placement_checkins (application_id, due_at)
        SELECT id, now() + interval '30 days' FROM reconciled WHERE status = 'adopted'
        ON CONFLICT (application_id) DO NOTHING
      ), event AS (
        INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
        SELECT application_id, 'outcome_confirmed', 'adopter', ${user.id}, ${JSON.stringify({ outcome })} FROM confirmed
      ) SELECT application_id FROM confirmed
    `;
    if (!result[0]) throw adoptionError("That application is not ready for outcome confirmation.", 409);
    return response.status(200).json({ applicationId, outcome, confirmation: "recorded" });
  } catch (error) {
    console.error("Adoption outcome confirmation failed", error.message);
    return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Adoption outcome confirmation is temporarily unavailable." });
  }
}
