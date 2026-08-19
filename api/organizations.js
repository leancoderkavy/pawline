import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import {
  adoptionError, CAPACITIES, cleanText, ensureAdoptionPlatformSchema, isUuid,
  normalizeHours, organizationMembership, publicOrganization,
} from "./_adoption-platform.js";

function limit(value, fallback = 30, maximum = 100) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
}

async function loadOrganization(database, organizationId) {
  const rows = await database`
    SELECT * FROM organizations WHERE id = ${organizationId} LIMIT 1
  `;
  const organization = rows[0];
  if (!organization) return null;
  const locations = await database`
    SELECT * FROM organization_locations
    WHERE organization_id = ${organizationId}
    ORDER BY is_primary DESC, created_at ASC LIMIT 1
  `;
  const location = locations[0] || null;
  const [hours, review] = await Promise.all([
    location ? database`
      SELECT weekday, is_closed, opens_at::text, closes_at::text, confirmed_at, source
      FROM organization_hours WHERE location_id = ${location.id} ORDER BY weekday ASC
    ` : [],
    database`
      SELECT count(*)::integer AS verified_count, avg(rating)::numeric(3,2) AS average_rating
      FROM organization_reviews
      WHERE organization_id = ${organizationId} AND moderation_state = 'published' AND verified_at IS NOT NULL
    `,
  ]);
  return publicOrganization(organization, location, hours, review[0]);
}

export async function updateOrganizationHours(database, organizationId, userId, body) {
  // Hours are a public trust signal. Queue members can review applications,
  // but only an organization administrator may change public profile facts.
  await organizationMembership(database, organizationId, userId, "administrator");
  const locationId = String(body?.locationId || "");
  if (!isUuid(locationId)) throw adoptionError("Choose a valid organization location.", 422);
  const locations = await database`
    SELECT id FROM organization_locations WHERE id = ${locationId} AND organization_id = ${organizationId} LIMIT 1
  `;
  if (!locations[0]) throw adoptionError("That location is not available to this organization.", 404);
  const hours = normalizeHours(body?.hours);
  if (!hours.length) throw adoptionError("Provide at least one confirmed hours entry before updating public hours.", 422);
  await database.transaction([
    ...hours.map((entry) => database`
      INSERT INTO organization_hours (
        location_id, weekday, opens_at, closes_at, is_closed, confirmed_at, source
      ) VALUES (
        ${locationId}, ${entry.weekday}, ${entry.opensAt}, ${entry.closesAt}, ${entry.isClosed}, now(), 'organization'
      ) ON CONFLICT (location_id, weekday) DO UPDATE SET
        opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at, is_closed = EXCLUDED.is_closed,
        confirmed_at = now(), source = 'organization', updated_at = now()
    `),
    database`
      UPDATE organizations SET updated_at = now(), verification_state = CASE
        WHEN verification_state = 'stale' THEN 'partially_verified' ELSE verification_state END
      WHERE id = ${organizationId}
    `,
    database`
      INSERT INTO organization_verification_events (organization_id, dimension, state, actor_type, actor_clerk_user_id)
      VALUES (${organizationId}, 'hours', 'confirmed', 'organization', ${userId})
    `,
  ]);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Organization information is temporarily unavailable." });
  try {
    await ensureAdoptionPlatformSchema(database);
    if (request.method === "GET") {
      if (request.query?.mine === "true") {
        let user;
        try { user = await requireUser(request); } catch (error) {
          return response.status(error.statusCode || 401).json({ error: error.message });
        }
        const memberships = await database`
          SELECT organization_id, role FROM organization_memberships
          WHERE clerk_user_id = ${user.id} ORDER BY created_at ASC
        `;
        const resolved = await Promise.all(memberships.map(async (membership) => {
          const [organization, locations] = await Promise.all([
            loadOrganization(database, membership.organization_id),
            database`SELECT id FROM organization_locations WHERE organization_id = ${membership.organization_id} ORDER BY is_primary DESC, created_at ASC LIMIT 1`,
          ]);
          return organization ? { ...organization, role: membership.role, locationId: locations[0]?.id || null } : null;
        }));
        const organizations = resolved.filter(Boolean);
        return response.status(200).json({ organizations });
      }
      const requested = request.query?.id;
      if (requested) {
        if (!isUuid(requested)) return response.status(422).json({ error: "Choose a valid organization." });
        const organization = await loadOrganization(database, requested);
        return organization
          ? response.status(200).json({ organization })
          : response.status(404).json({ error: "Organization not found." });
      }
      const rows = await database`
        SELECT id FROM organizations ORDER BY updated_at DESC LIMIT ${limit(request.query?.limit)}
      `;
      const organizations = (await Promise.all(rows.map((row) => loadOrganization(database, row.id)))).filter(Boolean);
      return response.status(200).json({ organizations });
    }
    if (request.method !== "PATCH") {
      response.setHeader("Allow", "GET, PATCH");
      return response.status(405).json({ error: "Method not allowed" });
    }
    let user;
    try { user = await requireUser(request); } catch (error) {
      return response.status(error.statusCode || 401).json({ error: error.message });
    }
    const organizationId = String(request.body?.organizationId || "");
    if (!isUuid(organizationId)) return response.status(422).json({ error: "Choose a valid organization." });
    // Intake capacity, visit instructions, and public hours determine what
    // adopters see and whether they can apply. Keep these settings separate
    // from the member-level application queue permissions.
    await organizationMembership(database, organizationId, user.id, "administrator");
    if (request.body?.intakeCapacity !== undefined) {
      const intakeCapacity = String(request.body.intakeCapacity || "");
      if (!CAPACITIES.has(intakeCapacity)) return response.status(422).json({ error: "Choose a valid intake capacity." });
      await database`
        UPDATE organizations SET intake_capacity = ${intakeCapacity}, updated_at = now() WHERE id = ${organizationId}
      `;
    }
    if (request.body?.visitInstructions !== undefined) {
      const locationId = String(request.body?.locationId || "");
      const visitInstructions = cleanText(request.body.visitInstructions, 1000);
      if (!isUuid(locationId)) return response.status(422).json({ error: "Choose a valid organization location." });
      const updated = await database`
        UPDATE organization_locations SET visit_instructions = ${visitInstructions}, updated_at = now()
        WHERE id = ${locationId} AND organization_id = ${organizationId} RETURNING id
      `;
      if (!updated[0]) return response.status(404).json({ error: "That location is not available to this organization." });
    }
    if (request.body?.hours !== undefined) await updateOrganizationHours(database, organizationId, user.id, request.body);
    const organization = await loadOrganization(database, organizationId);
    return response.status(200).json({ organization });
  } catch (error) {
    console.error("Organization API failed", error.message);
    return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Organization information is temporarily unavailable." });
  }
}
