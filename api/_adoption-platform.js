import crypto from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(["member", "administrator"]);
const CAPACITIES = new Set(["accepting", "limited", "waitlist", "paused"]);

export function adoptionError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isUuid(value) {
  return UUID.test(String(value || ""));
}

export function cleanText(value, limit = 240) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, limit) : null;
}

export function safeEmail(value) {
  const email = cleanText(value, 254)?.toLowerCase() || null;
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function hashClaimToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function createClaimToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function canonicalOrigin(environment = process.env) {
  const fallback = "https://www.pawlineadopt.com";
  try {
    const origin = new URL(environment.PAWLINE_CANONICAL_ORIGIN || fallback);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/") {
      throw new Error("invalid canonical origin");
    }
    return origin.origin;
  } catch {
    throw adoptionError("The canonical Pawline origin is not safely configured.");
  }
}

export function claimUrl(token, environment = process.env) {
  // Keep the one-time credential out of HTTP request lines, server logs, and referrers.
  return `${canonicalOrigin(environment)}/shelter/claim#token=${encodeURIComponent(token)}`;
}

export async function ensureAdoptionPlatformSchema(database) {
  const rows = await database`
    SELECT
      to_regclass('public.organizations') AS organizations,
      to_regclass('public.organization_locations') AS locations,
      to_regclass('public.organization_memberships') AS memberships,
      to_regclass('public.organization_claim_tokens') AS claims,
      to_regclass('public.organization_hours') AS hours,
      to_regclass('public.organization_verification_events') AS verification_events,
      to_regclass('public.adopter_profiles') AS adopter_profiles,
      to_regclass('public.households') AS households,
      to_regclass('public.household_members') AS household_members,
      to_regclass('public.adoption_applications') AS applications,
      to_regclass('public.adoption_application_events') AS application_events,
      to_regclass('public.adoption_outcome_confirmations') AS outcomes,
      to_regclass('public.adoption_placement_checkins') AS placement_checkins,
      to_regclass('public.organization_outreach_messages') AS outreach,
      to_regclass('public.organization_email_suppressions') AS suppressions,
      to_regclass('public.organization_reviews') AS reviews,
      to_regclass('public.ai_task_consents') AS ai_consents,
      to_regclass('public.ai_task_runs') AS ai_runs
  `;
  if (Object.values(rows[0] || {}).some((value) => !value)) {
    throw adoptionError("Adoption platform migration is missing.");
  }
}

export async function organizationMembership(database, organizationId, clerkUserId, minimumRole = "member") {
  if (!isUuid(organizationId)) throw adoptionError("Choose a valid organization.", 422);
  const rows = await database`
    SELECT role FROM organization_memberships
    WHERE organization_id = ${organizationId} AND clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;
  const role = rows[0]?.role;
  if (!ROLES.has(role) || (minimumRole === "administrator" && role !== "administrator")) {
    throw adoptionError("This organization is not available to your account.", 403);
  }
  return role;
}

export function normalizeHours(value) {
  if (!Array.isArray(value) || value.length > 7) throw adoptionError("Provide up to seven weekly hour entries.", 422);
  const result = [];
  const weekdays = new Set();
  for (const item of value) {
    const weekday = Number(item?.weekday);
    const isClosed = item?.isClosed === true;
    const opensAt = cleanText(item?.opensAt, 5);
    const closesAt = cleanText(item?.closesAt, 5);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || weekdays.has(weekday)) {
      throw adoptionError("Each weekday may have one valid hours entry.", 422);
    }
    if (!isClosed && (!/^\d{2}:\d{2}$/.test(opensAt || "") || !/^\d{2}:\d{2}$/.test(closesAt || "") || opensAt >= closesAt)) {
      throw adoptionError("Open hours need a valid opening and closing time.", 422);
    }
    weekdays.add(weekday);
    result.push({ weekday, isClosed, opensAt: isClosed ? null : opensAt, closesAt: isClosed ? null : closesAt });
  }
  return result;
}

export function publicOrganization(row, location, hours = [], review = null) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    verificationState: row.verification_state,
    intakeCapacity: row.intake_capacity,
    officialUrl: row.official_url || null,
    publicContactPhone: row.public_contact_phone || null,
    policies: row.policies || {},
    sourceProvenance: row.source_provenance || [],
    claimedAt: row.claimed_at || null,
    updatedAt: row.updated_at,
    location: location ? {
      label: location.label || null,
      timezone: location.timezone,
      city: location.city || null,
      region: location.region || null,
      postalCode: location.postal_code || null,
      countryCode: location.country_code || null,
      visitInstructions: location.visit_instructions || null,
    } : null,
    hours: hours.map((entry) => ({
      weekday: Number(entry.weekday), isClosed: entry.is_closed,
      opensAt: entry.opens_at || null, closesAt: entry.closes_at || null,
      confirmedAt: entry.confirmed_at || null, source: entry.source,
    })),
    reviewSummary: Number(review?.verified_count || 0) >= 5 ? {
      verifiedCount: Number(review.verified_count), averageRating: Number(review.average_rating),
    } : null,
  };
}

export async function redeemOrganizationClaim(database, token, user) {
  const hash = hashClaimToken(token);
  if (!token || String(token).length < 40) throw adoptionError("This claim link is invalid or expired.", 422);
  const email = safeEmail(user?.email);
  if (!email) throw adoptionError("Use an account with a verified email address to claim this organization.", 403);
  // A single CTE is a single database statement: token consumption, membership,
  // organization state, and verification event either all commit or all roll back.
  const claimed = await database`
    WITH claimed AS (
      UPDATE organization_claim_tokens
      SET redeemed_at = now(), redeemed_by_clerk_user_id = ${user.id}
      WHERE token_hash = ${hash}
        AND recipient_email = ${email}
        AND redeemed_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING organization_id
    ), membership AS (
      INSERT INTO organization_memberships (organization_id, clerk_user_id, role)
      SELECT organization_id, ${user.id}, 'administrator' FROM claimed
      ON CONFLICT (organization_id, clerk_user_id)
      DO UPDATE SET role = 'administrator', updated_at = now()
      RETURNING organization_id
    ), organization_update AS (
      UPDATE organizations o
      SET verification_state = CASE WHEN o.verification_state = 'unclaimed' THEN 'claimed' ELSE o.verification_state END,
          claimed_at = COALESCE(o.claimed_at, now()), updated_at = now()
      FROM claimed c WHERE o.id = c.organization_id
      RETURNING o.id
    ), verification AS (
      INSERT INTO organization_verification_events (organization_id, dimension, state, actor_type, actor_clerk_user_id)
      SELECT organization_id, 'identity', 'confirmed', 'organization', ${user.id} FROM claimed
    ) SELECT organization_id FROM claimed
  `;
  const organizationId = claimed[0]?.organization_id;
  if (!organizationId) throw adoptionError("This claim link is invalid or expired.", 410);
  return organizationId;
}

export async function canSendToRecipient(database, email) {
  const address = safeEmail(email);
  if (!address) throw adoptionError("A valid official recipient is required.", 422);
  const suppressed = await database`
    SELECT 1 FROM organization_email_suppressions WHERE email = ${address} LIMIT 1
  `;
  if (suppressed[0]) throw adoptionError("This recipient has opted out of Pawline outreach.", 409);
  return address;
}

export async function recordAiRun(database, metadata, { clerkUserId = null, organizationId = null, status = "blocked" } = {}) {
  if (!database || !metadata?.task || !metadata?.requestId) return;
  await database`
    INSERT INTO ai_task_runs (
      task, request_id, clerk_user_id, organization_id, prompt_version, schema_version,
      model, provider, status, input_tokens, output_tokens, latency_ms
    ) VALUES (
      ${metadata.task}, ${metadata.requestId}, ${clerkUserId}, ${organizationId},
      ${metadata.promptVersion || "unknown"}, ${metadata.schemaVersion || "unknown"},
      ${metadata.model || null}, ${metadata.provider || null}, ${status},
      ${metadata.inputTokens || null}, ${metadata.outputTokens || null}, ${metadata.latencyMs || null}
    ) ON CONFLICT (task, request_id) DO NOTHING
  `;
}

export { CAPACITIES };
