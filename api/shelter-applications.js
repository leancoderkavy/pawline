import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { adoptionError, cleanText, ensureAdoptionPlatformSchema, isUuid, organizationMembership } from "./_adoption-platform.js";
import { SHELTER_NEXT_STATUSES, validShelterTransition as isValidShelterTransition } from "../src/shelterWorkflow.js";

const SHELTER_STATUSES = new Set(Object.values(SHELTER_NEXT_STATUSES).flat());
const OUTCOMES = new Set(["adopted", "not_adopted", "placement_changed"]);
export function validShelterTransition(from, to) {
  return isValidShelterTransition(from, to);
}

async function applicationForOrganization(database, applicationId, organizationId) {
  if (!isUuid(applicationId)) throw adoptionError("Choose a valid application.", 422);
  const rows = await database`
    SELECT a.*, (
      SELECT c.id FROM ai_task_consents c
      WHERE c.clerk_user_id = a.clerk_user_id AND c.application_id = a.id AND c.task = 'intake_summarizer'
      ORDER BY c.created_at DESC LIMIT 1
    ) AS ai_intake_consent_id
    FROM adoption_applications a
    WHERE id = ${applicationId} AND organization_id = ${organizationId}
      AND status NOT IN ('draft', 'awaiting_participation', 'expired')
      AND submitted_at IS NOT NULL AND shared_fields <> '{}'::jsonb
    LIMIT 1
  `;
  if (!rows[0]) throw adoptionError("That application is not available to this organization.", 404);
  return rows[0];
}

function answerProjection(answers, allowed) {
  const keys = Array.isArray(allowed) ? allowed : [];
  return Object.fromEntries(keys.filter((key) => typeof key === "string" && Object.hasOwn(answers || {}, key))
    .map((key) => [key, answers[key]]));
}

export function publicApplication(row) {
  const shared = row.shared_fields || {};
  return {
    id: row.id,
    petId: row.pet_id,
    status: row.status,
    sharedAnswers: {
      ...answerProjection(row.core_answers, shared.core),
      ...answerProjection(row.add_on_answers, shared.addOn),
    },
    aiIntakeConsentId: row.ai_intake_consent_id || null,
    submittedAt: row.submitted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Shelter applications are temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  try {
    await ensureAdoptionPlatformSchema(database);
    const organizationId = String(request.method === "GET" ? request.query?.organizationId : request.body?.organizationId || "");
    await organizationMembership(database, organizationId, user.id);
    if (request.method === "GET") {
      const rows = await database`
        SELECT a.*, (
          SELECT c.id FROM ai_task_consents c
          WHERE c.clerk_user_id = a.clerk_user_id AND c.application_id = a.id AND c.task = 'intake_summarizer'
          ORDER BY c.created_at DESC LIMIT 1
        ) AS ai_intake_consent_id
        FROM adoption_applications a
        WHERE organization_id = ${organizationId}
          AND status NOT IN ('draft', 'awaiting_participation', 'expired')
          AND submitted_at IS NOT NULL AND shared_fields <> '{}'::jsonb
        ORDER BY updated_at DESC LIMIT 100
      `;
      return response.status(200).json({ applications: rows.map(publicApplication) });
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed" });
    }
    const action = String(request.body?.action || "");
    const application = await applicationForOrganization(database, request.body?.applicationId, organizationId);
    if (action === "status") {
      const status = String(request.body?.status || "");
      if (!SHELTER_STATUSES.has(status)) return response.status(422).json({ error: "Choose a valid application status." });
      if (!validShelterTransition(application.status, status)) {
        return response.status(409).json({ error: "That application cannot move to this status." });
      }
      await database.transaction([
        database`
          UPDATE adoption_applications
          SET status = ${status}, closed_at = CASE WHEN ${["declined", "adopted"].includes(status)} THEN now() ELSE closed_at END,
              updated_at = now()
          WHERE id = ${application.id} AND organization_id = ${organizationId}
        `,
        database`
          INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
          VALUES (${application.id}, 'status_changed', 'organization', ${user.id}, ${JSON.stringify({ status })})
        `,
      ]);
    } else if (action === "message") {
      const body = cleanText(request.body?.body, 4000);
      if (!body) return response.status(422).json({ error: "Write a message before sending it." });
      await database.transaction([
        database`
          INSERT INTO adoption_application_messages (application_id, sender_clerk_user_id, sender_role, body)
          VALUES (${application.id}, ${user.id}, 'organization', ${body})
        `,
        database`
          INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id)
          VALUES (${application.id}, 'message_sent', 'organization', ${user.id})
        `,
      ]);
    } else if (action === "outcome") {
      const outcome = String(request.body?.outcome || "");
      if (!OUTCOMES.has(outcome)) return response.status(422).json({ error: "Choose a valid outcome." });
      if (application.status !== "adoption_pending") {
        return response.status(409).json({ error: "Outcomes are immutable once this application is finalized." });
      }
      await database`
        WITH confirmed AS (
          INSERT INTO adoption_outcome_confirmations (application_id, confirmed_by_clerk_user_id, confirmer_role, outcome)
          SELECT id, ${user.id}, 'organization', ${outcome}
          FROM adoption_applications WHERE id = ${application.id} AND status = 'adoption_pending'
          ON CONFLICT (application_id, confirmer_role) DO UPDATE SET
            outcome = EXCLUDED.outcome, confirmed_by_clerk_user_id = EXCLUDED.confirmed_by_clerk_user_id, confirmed_at = now()
          RETURNING application_id
        ), reconciled AS (
          UPDATE adoption_applications a
          SET status = CASE
                WHEN EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'adopter' AND o.outcome = 'adopted')
                  AND ${outcome} = 'adopted' THEN 'adopted'
                WHEN EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'adopter' AND o.outcome = 'not_adopted')
                  AND ${outcome} = 'not_adopted' THEN 'withdrawn'
                WHEN EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'adopter' AND o.outcome = 'placement_changed')
                  AND ${outcome} = 'placement_changed' THEN 'withdrawn'
                ELSE a.status END,
              closed_at = CASE WHEN (
                (EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'adopter' AND o.outcome = 'adopted') AND ${outcome} = 'adopted') OR
                (EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'adopter' AND o.outcome = 'not_adopted') AND ${outcome} = 'not_adopted') OR
                (EXISTS (SELECT 1 FROM adoption_outcome_confirmations o WHERE o.application_id = a.id AND o.confirmer_role = 'adopter' AND o.outcome = 'placement_changed') AND ${outcome} = 'placement_changed')
              ) THEN now() ELSE a.closed_at END,
              updated_at = now()
          WHERE a.id IN (SELECT application_id FROM confirmed) AND a.status = 'adoption_pending'
          RETURNING id, status
        ), checkin AS (
          INSERT INTO adoption_placement_checkins (application_id, due_at)
          SELECT id, now() + interval '30 days' FROM reconciled WHERE status = 'adopted'
          ON CONFLICT (application_id) DO NOTHING
        ), event AS (
          INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
          SELECT application_id, 'outcome_confirmed', 'organization', ${user.id}, ${JSON.stringify({ outcome })} FROM confirmed
        ) SELECT application_id FROM confirmed
      `;
    } else {
      return response.status(422).json({ error: "Choose a valid shelter application action." });
    }
    const updated = await applicationForOrganization(database, application.id, organizationId);
    return response.status(200).json({ application: publicApplication(updated) });
  } catch (error) {
    console.error("Shelter applications API failed", error.message);
    return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Shelter applications are temporarily unavailable." });
  }
}
