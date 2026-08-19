import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { consumeUsage } from "./_usage-limit.js";
import { ensureAdoptionPlatformSchema, isUuid } from "./_adoption-platform.js";
import { queueHeldApplicationInvitation } from "./_organization-outreach.js";

const coreKeys = new Set(["household", "carePlan", "schedule", "notes"]);
const cleanText = (value, limit) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit)
  : "";

export function cleanAnswerMap(value, allowedKeys = coreKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => allowedKeys.has(key))
    .map(([key, answer]) => [key, cleanText(answer, 1200)])
    .filter(([, answer]) => Boolean(answer)));
}

export function cleanSharedFields(value, coreAnswers, addOnAnswers) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const selected = entries => Array.isArray(entries)
    ? [...new Set(entries.filter(key => typeof key === "string" && key.length <= 80))]
    : [];
  const shared = { core: selected(value.core), addOn: selected(value.addOn) };
  if (shared.core.some(key => !(key in coreAnswers)) || shared.addOn.some(key => !(key in addOnAnswers))) return null;
  return shared;
}

function intakeEnabled(organization) {
  return Boolean(organization?.organization_id
    && organization?.policies?.applicationIntake === true
    && ["accepting", "limited"].includes(organization.intake_capacity));
}

export async function purgeExpiredHeldApplications(database) {
  const rows = await database`
    WITH expired AS (
      UPDATE adoption_applications
      SET status = 'expired', core_answers = '{}'::jsonb, add_on_answers = '{}'::jsonb,
          shared_fields = '{}'::jsonb, updated_at = now()
      WHERE status = 'awaiting_participation' AND hold_expires_at IS NOT NULL AND hold_expires_at <= now()
      RETURNING id
    ), audited AS (
      INSERT INTO adoption_application_events (application_id, event_type, actor_type, event_data)
      SELECT id, 'expired', 'system', '{"reason":"held_data_purged"}'::jsonb FROM expired
    ) SELECT count(*)::integer AS count FROM expired
  `;
  return Number(rows[0]?.count || 0);
}

function heldInvitationState(row, override = null) {
  if (row.status !== "awaiting_participation") return null;
  if (override) return override;
  return row.claim_outreach_status ? "invite_already_queued" : "manual_contact_required";
}

function applicationResponse(row, { invitationState = null } = {}) {
  return {
    id: row.id,
    petId: row.pet_id,
    organizationId: row.organization_id || null,
    applicationEnabled: intakeEnabled(row),
    petName: row.pet_name,
    shelter: row.organization_name || row.shelter || "Listed organization",
    status: row.status,
    coreAnswers: row.core_answers || {},
    addOnAnswers: row.add_on_answers || {},
    sharedFields: row.shared_fields || {},
    holdExpiresAt: row.hold_expires_at || null,
    heldInvitationState: heldInvitationState(row, invitationState),
    submittedAt: row.submitted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ownApplication(database, id, userId) {
  if (!isUuid(id)) return null;
  const rows = await database`
    SELECT a.*, p.name AS pet_name, p.shelter, o.name AS organization_name,
      o.intake_capacity, o.policies,
      claim_outbox.status AS claim_outreach_status
    FROM adoption_applications a
    JOIN pets p ON p.id = a.pet_id
    LEFT JOIN organizations o ON o.id = a.organization_id
    LEFT JOIN LATERAL (
      SELECT status FROM organization_outreach_messages
      WHERE organization_id = a.organization_id AND kind = 'claim_invitation'
      ORDER BY created_at DESC LIMIT 1
    ) claim_outbox ON TRUE
    WHERE a.id = ${id} AND a.clerk_user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, PATCH");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Applications are temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  try { await ensureAdoptionPlatformSchema(database); } catch (error) {
    return response.status(error.statusCode || 503).json({ error: error.message });
  }
  if (request.method === "GET") {
    const rows = await database`
      SELECT a.*, p.name AS pet_name, p.shelter, o.name AS organization_name,
        o.intake_capacity, o.policies,
        claim_outbox.status AS claim_outreach_status
      FROM adoption_applications a
      JOIN pets p ON p.id = a.pet_id
      LEFT JOIN organizations o ON o.id = a.organization_id
      LEFT JOIN LATERAL (
        SELECT status FROM organization_outreach_messages
        WHERE organization_id = a.organization_id AND kind = 'claim_invitation'
        ORDER BY created_at DESC LIMIT 1
      ) claim_outbox ON TRUE
      WHERE a.clerk_user_id = ${user.id}
      ORDER BY a.updated_at DESC LIMIT 80
    `;
    return response.status(200).json({ applications: rows.map(applicationResponse) });
  }
  try {
    const allowed = await consumeUsage(database, {
      scope: "adoption_application_user_hour", subject: user.id, limit: 40, windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return response.status(429).json({ error: "Application update limit reached. Try again later." });
  } catch {
    return response.status(503).json({ error: "Application safety checks are temporarily unavailable." });
  }

  const body = request.body || {};
  if (request.method === "POST") {
    if (!isUuid(body.petId)) return response.status(422).json({ error: "Choose a valid Pawline pet listing." });
    const pets = await database`
      SELECT p.id, p.organization_id, p.shelter, o.id AS canonical_organization_id,
        o.verification_state, o.intake_capacity, o.policies, o.official_domain,
        o.official_url, o.public_contact_email
      FROM pets p LEFT JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = ${body.petId} AND p.status = 'available'
      LIMIT 1
    `;
    const pet = pets[0];
    if (!pet) return response.status(404).json({ error: "That pet is no longer available for a Pawline application." });
    const coreAnswers = cleanAnswerMap(body.coreAnswers);
    const addOnAnswers = cleanAnswerMap(body.addOnAnswers, new Set());
    const participating = intakeEnabled(pet);
    const requestedSubmit = body.submit === true;
    if (requestedSubmit && !participating) {
      return response.status(409).json({ error: "This organization has not enabled Pawline applications. Your answers have not been shared; use the official route." });
    }
    const sharedFields = requestedSubmit ? cleanSharedFields(body.sharedFields, coreAnswers, addOnAnswers) : {};
    if (requestedSubmit && (!sharedFields || (!sharedFields.core.length && !sharedFields.addOn.length))) {
      return response.status(422).json({ error: "Choose the exact fields you want to share before submitting." });
    }
    if (!participating && body.heldDataConsent !== true) {
      return response.status(422).json({ error: "Consent is required to hold a private application while this organization is not participating." });
    }
    const status = requestedSubmit ? "submitted" : participating ? "draft" : "awaiting_participation";
    const holdExpiresAt = participating ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await database`
      WITH created AS (
        INSERT INTO adoption_applications (
          clerk_user_id, pet_id, organization_id, status, core_answers, add_on_answers,
          shared_fields, hold_expires_at, submitted_at
        ) VALUES (
          ${user.id}, ${pet.id}, ${pet.organization_id || null}, ${status}, ${JSON.stringify(coreAnswers)},
          ${JSON.stringify(addOnAnswers)}, ${JSON.stringify(sharedFields)}, ${holdExpiresAt},
          ${requestedSubmit ? new Date().toISOString() : null}
        ) RETURNING id
      ), audited AS (
        INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
        SELECT id, ${requestedSubmit ? "submitted" : "created"}, 'adopter', ${user.id},
          ${JSON.stringify({ status, sharedFieldCategories: Object.keys(sharedFields), heldDataConsent: !participating })}
        FROM created
      ), consented AS (
        INSERT INTO adoption_application_consents (
          application_id, clerk_user_id, field_categories, recipient_organization_id, version
        ) SELECT id, ${user.id},
          ${JSON.stringify(requestedSubmit
            ? sharedFields
            : { heldPrivateApplication: ["core_answers", "add_on_answers"] })}::jsonb,
          ${requestedSubmit ? pet.organization_id : null},
          ${requestedSubmit ? "application-share-v1" : "held-application-v1"}
        FROM created
      ) SELECT id FROM created
    `;
    const applicationId = rows[0].id;
    let invitationState = null;
    if (status === "awaiting_participation") {
      try {
        const invitation = await queueHeldApplicationInvitation(database, {
          id: pet.canonical_organization_id,
          verification_state: pet.verification_state,
          official_domain: pet.official_domain,
          official_url: pet.official_url,
          public_contact_email: pet.public_contact_email,
        });
        invitationState = invitation.state;
      } catch (error) {
        // The held application is already private and durable. An outbox
        // failure must not turn it into a false claim that outreach occurred.
        console.error("Held application invitation queue failed", error.message);
        invitationState = "manual_contact_required";
      }
    }
    return response.status(201).json({ application: applicationResponse(
      await ownApplication(database, applicationId, user.id), { invitationState },
    ) });
  }

  const application = await ownApplication(database, body.id, user.id);
  if (!application) return response.status(404).json({ error: "That application is not available to your account." });
  if (!["draft", "awaiting_participation"].includes(application.status)) {
    return response.status(409).json({ error: "Only unsubmitted drafts can be changed here." });
  }
  if (body.submit === true) {
    if (!intakeEnabled(application)) {
      return response.status(409).json({ error: "This organization has not enabled Pawline applications. Use the official route instead." });
    }
    const sharedFields = cleanSharedFields(body.sharedFields, application.core_answers || {}, application.add_on_answers || {});
    if (!sharedFields || (!sharedFields.core.length && !sharedFields.addOn.length)) {
      return response.status(422).json({ error: "Choose the exact fields you want to share before submitting." });
    }
    const rows = await database`
      WITH submitted AS (
        UPDATE adoption_applications
        SET status = 'submitted', shared_fields = ${JSON.stringify(sharedFields)}, submitted_at = now(), updated_at = now()
        WHERE id = ${application.id} AND clerk_user_id = ${user.id}
        RETURNING id
      ), consented AS (
        INSERT INTO adoption_application_consents (
          application_id, clerk_user_id, field_categories, recipient_organization_id, version
        ) SELECT id, ${user.id}, ${JSON.stringify(sharedFields)}::jsonb,
          ${application.organization_id}, 'application-share-v1' FROM submitted
      ), audited AS (
        INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
        SELECT id, 'submitted', 'adopter', ${user.id}, ${JSON.stringify({ sharedFields })} FROM submitted
      ) SELECT id FROM submitted
    `;
    return response.status(200).json({ application: applicationResponse(await ownApplication(database, rows[0].id, user.id)) });
  }
  const coreAnswers = cleanAnswerMap(body.coreAnswers);
  const rows = await database`
    WITH updated AS (
      UPDATE adoption_applications SET core_answers = ${JSON.stringify(coreAnswers)}, updated_at = now()
      WHERE id = ${application.id} AND clerk_user_id = ${user.id}
      RETURNING id
    ), audited AS (
      INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
      SELECT id, 'updated', 'adopter', ${user.id}, ${JSON.stringify({ fields: Object.keys(coreAnswers) })} FROM updated
    ) SELECT id FROM updated
  `;
  return response.status(200).json({ application: applicationResponse(await ownApplication(database, rows[0].id, user.id)) });
}
