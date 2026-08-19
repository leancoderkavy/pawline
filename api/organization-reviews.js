import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { moderateMessage } from "./_community.js";
import { consumeUsage } from "./_usage-limit.js";
import { adoptionError, ensureAdoptionPlatformSchema, isUuid, organizationMembership, safeEmail } from "./_adoption-platform.js";

function reviewResponse(row, { includeModeration = false, includeAppealReason = false } = {}) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    interactionType: row.interaction_type,
    interactionAt: row.interaction_at || null,
    rating: Number(row.rating),
    narrative: row.narrative || null,
    verifiedAt: row.verified_at || null,
    createdAt: row.created_at,
    reply: row.reply_body ? { body: row.reply_body, createdAt: row.reply_created_at } : null,
    appeal: row.appeal_id ? {
      id: row.appeal_id, status: row.appeal_status, createdAt: row.appeal_created_at,
      ...(includeAppealReason ? { reason: row.appeal_reason || null } : {}),
    } : null,
    organizationName: row.organization_name || null,
    ...(includeModeration ? { moderationState: row.moderation_state } : {}),
  };
}

export function isPawlineModerator(user, environment = process.env) {
  const moderatorEmail = safeEmail(environment.PAWLINE_MODERATION_EMAIL);
  return Boolean(moderatorEmail && user?.email && user.email === moderatorEmail);
}

function requirePawlineModerator(user, environment = process.env) {
  if (!isPawlineModerator(user, environment)) {
    throw adoptionError("Pawline review moderation is not available to this account.", 403);
  }
}

async function ensureReviewSchema(database) {
  await ensureAdoptionPlatformSchema(database);
  const rows = await database`
    SELECT
      to_regclass('public.organization_review_replies') AS replies,
      to_regclass('public.organization_review_appeals') AS appeals,
      to_regclass('public.organization_review_evidence_access_log') AS evidence_access
  `;
  if (!rows[0]?.replies || !rows[0]?.appeals || !rows[0]?.evidence_access) {
    throw adoptionError("Organization review storage migration is missing.");
  }
}

async function reviewedApplication(database, applicationId, userId) {
  if (!isUuid(applicationId)) throw adoptionError("Choose a valid submitted application.", 422);
  const rows = await database`
    SELECT id, organization_id, submitted_at
    FROM adoption_applications
    WHERE id = ${applicationId} AND clerk_user_id = ${userId}
      AND organization_id IS NOT NULL
      AND status NOT IN ('draft', 'awaiting_participation', 'expired')
      AND submitted_at IS NOT NULL
    LIMIT 1
  `;
  if (!rows[0]) throw adoptionError("Only your submitted organization-linked application can verify this review.", 403);
  return rows[0];
}

async function reviewForOrganization(database, reviewId, organizationId) {
  if (!isUuid(reviewId)) throw adoptionError("Choose a valid review.", 422);
  const rows = await database`
    SELECT id, moderation_state FROM organization_reviews
    WHERE id = ${reviewId} AND organization_id = ${organizationId} LIMIT 1
  `;
  if (!rows[0]) throw adoptionError("That review is not available to this organization.", 404);
  return rows[0];
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Organization reviews are temporarily unavailable." });
  try {
    await ensureReviewSchema(database);
    const workspace = request.query?.workspace === "true";
    const moderation = request.query?.moderation === "true";
    const mine = request.query?.mine === "true";
    if (request.method === "GET" && !workspace && !moderation && !mine) {
      const organizationId = String(request.query?.organizationId || "");
      if (!isUuid(organizationId)) return response.status(422).json({ error: "Choose a valid organization." });
      const rows = await database`
        SELECT r.*, reply.body AS reply_body, reply.created_at AS reply_created_at
        FROM organization_reviews r
        LEFT JOIN organization_review_replies reply ON reply.review_id = r.id
        WHERE r.organization_id = ${organizationId}
          AND r.moderation_state = 'published' AND r.verified_at IS NOT NULL
        ORDER BY r.created_at DESC LIMIT 30
      `;
      return response.status(200).json({ reviews: rows.map((row) => reviewResponse(row)) });
    }

    let user;
    try { user = await requireUser(request); } catch (error) {
      return response.status(error.statusCode || 401).json({ error: error.message });
    }
    if (request.method === "GET" && mine) {
      const rows = await database`
        SELECT r.*, reply.body AS reply_body, reply.created_at AS reply_created_at
        FROM organization_reviews r
        LEFT JOIN organization_review_replies reply ON reply.review_id = r.id
        WHERE r.reviewer_clerk_user_id = ${user.id}
        ORDER BY r.created_at DESC LIMIT 30
      `;
      return response.status(200).json({ reviews: rows.map((row) => reviewResponse(row, { includeModeration: true })) });
    }

    if (request.method === "GET" && workspace) {
      const organizationId = String(request.query?.organizationId || "");
      await organizationMembership(database, organizationId, user.id, "administrator");
      const rows = await database`
        SELECT r.*, reply.body AS reply_body, reply.created_at AS reply_created_at,
          appeal.id AS appeal_id, appeal.status AS appeal_status, appeal.reason AS appeal_reason, appeal.created_at AS appeal_created_at
        FROM organization_reviews r
        LEFT JOIN organization_review_replies reply ON reply.review_id = r.id
        LEFT JOIN LATERAL (
          SELECT id, status, reason, created_at FROM organization_review_appeals
          WHERE review_id = r.id ORDER BY created_at DESC LIMIT 1
        ) appeal ON TRUE
        WHERE r.organization_id = ${organizationId}
          AND r.moderation_state IN ('published', 'appealed')
        ORDER BY r.created_at DESC LIMIT 50
      `;
      return response.status(200).json({ reviews: rows.map((row) => reviewResponse(row, { includeModeration: true, includeAppealReason: true })) });
    }

    if (request.method === "GET" && moderation) {
      requirePawlineModerator(user);
      const rows = await database`
        SELECT r.*, o.name AS organization_name,
          appeal.id AS appeal_id, appeal.status AS appeal_status, appeal.reason AS appeal_reason, appeal.created_at AS appeal_created_at
        FROM organization_reviews r
        JOIN organizations o ON o.id = r.organization_id
        LEFT JOIN LATERAL (
          SELECT id, status, reason, created_at FROM organization_review_appeals
          WHERE review_id = r.id AND status = 'open' ORDER BY created_at DESC LIMIT 1
        ) appeal ON TRUE
        WHERE r.moderation_state IN ('pending', 'appealed') AND r.verified_at IS NOT NULL
        ORDER BY r.created_at ASC LIMIT 100
      `;
      return response.status(200).json({ reviews: rows.map((row) => reviewResponse(row, { includeModeration: true, includeAppealReason: true })) });
    }

    const allowed = await consumeUsage(database, {
      scope: "organization_review_user_hour", subject: user.id, limit: 12, windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return response.status(429).json({ error: "Review action limit reached. Try again later." });
    const action = String(request.body?.action || "create");
    if (action === "create") {
      const rating = Number(request.body?.rating);
      const narrative = moderateMessage(request.body?.narrative);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return response.status(422).json({ error: "Choose a rating from one to five." });
      if (!narrative.allowed) return response.status(422).json({ error: narrative.message });
      const application = await reviewedApplication(database, request.body?.applicationId, user.id);
      const created = await database`
        INSERT INTO organization_reviews (
          organization_id, application_id, reviewer_clerk_user_id, interaction_type, interaction_at,
          rating, narrative, moderation_state, verified_at
        ) VALUES (
          ${application.organization_id}, ${application.id}, ${user.id}, 'application', ${application.submitted_at}::date,
          ${rating}, ${narrative.text}, 'pending', now()
        ) ON CONFLICT (application_id) WHERE application_id IS NOT NULL DO NOTHING
        RETURNING *
      `;
      if (!created[0]) return response.status(409).json({ error: "A review already exists for this verified application." });
      return response.status(201).json({ review: reviewResponse(created[0], { includeModeration: true }), message: "Your verified review is awaiting Pawline moderation." });
    }

    if (action === "moderate") {
      requirePawlineModerator(user);
      const reviewId = String(request.body?.reviewId || "");
      const decision = String(request.body?.decision || "");
      if (!isUuid(reviewId) || !["publish", "reject"].includes(decision)) {
        return response.status(422).json({ error: "Choose a pending review and a valid moderation decision." });
      }
      const nextState = decision === "publish" ? "published" : "rejected";
      const rows = await database`
        WITH moderated AS (
          UPDATE organization_reviews
          SET moderation_state = ${nextState}, updated_at = now()
          WHERE id = ${reviewId} AND moderation_state IN ('pending', 'appealed') AND verified_at IS NOT NULL
          RETURNING id, moderation_state
        ), resolved_appeals AS (
          UPDATE organization_review_appeals
          SET status = ${decision === "publish" ? "denied" : "upheld"}, resolved_at = now()
          WHERE review_id IN (SELECT id FROM moderated) AND status = 'open'
        ) SELECT id, moderation_state FROM moderated
      `;
      if (!rows[0]) return response.status(409).json({ error: "This review is no longer awaiting moderation." });
      return response.status(200).json({ review: { id: rows[0].id, moderationState: rows[0].moderation_state } });
    }

    const organizationId = String(request.body?.organizationId || "");
    await organizationMembership(database, organizationId, user.id, "administrator");
    const review = await reviewForOrganization(database, request.body?.reviewId, organizationId);
    if (action === "reply") {
      if (review.moderation_state !== "published") return response.status(409).json({ error: "Replies are available after Pawline publishes a verified review." });
      const body = moderateMessage(request.body?.body);
      if (!body.allowed) return response.status(422).json({ error: body.message });
      const rows = await database`
        INSERT INTO organization_review_replies (review_id, author_clerk_user_id, body)
        VALUES (${review.id}, ${user.id}, ${body.text})
        ON CONFLICT (review_id) DO NOTHING
        RETURNING id, body, created_at
      `;
      if (!rows[0]) return response.status(409).json({ error: "This review already has an organization reply." });
      return response.status(201).json({ reply: { id: rows[0].id, body: rows[0].body, createdAt: rows[0].created_at } });
    }
    if (action === "appeal") {
      const reason = moderateMessage(request.body?.reason);
      if (!reason.allowed) return response.status(422).json({ error: reason.message });
      const appeal = await database`
        WITH created AS (
          INSERT INTO organization_review_appeals (review_id, submitted_by_clerk_user_id, reason)
          SELECT ${review.id}, ${user.id}, ${reason.text}
          FROM organization_reviews current_review
          WHERE current_review.id = ${review.id} AND current_review.moderation_state = 'published'
            AND NOT EXISTS (
            SELECT 1 FROM organization_review_appeals WHERE review_id = ${review.id} AND status = 'open'
          )
          RETURNING id, status, created_at
        ), held AS (
          UPDATE organization_reviews SET moderation_state = 'appealed', updated_at = now()
          WHERE id = ${review.id} AND moderation_state = 'published'
            AND EXISTS (SELECT 1 FROM created)
          RETURNING id
        ) SELECT created.id, created.status, created.created_at FROM created JOIN held ON TRUE
      `;
      if (!appeal[0]) {
        return response.status(409).json({ error: "Only a published review without an open appeal can be appealed." });
      }
      return response.status(201).json({ appeal: { id: appeal[0].id, status: appeal[0].status, createdAt: appeal[0].created_at }, message: "The appeal is held for Pawline moderation." });
    }
    return response.status(422).json({ error: "Choose a valid review action." });
  } catch (error) {
    console.error("Organization reviews API failed", error.message);
    return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Organization reviews are temporarily unavailable." });
  }
}
