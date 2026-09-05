import { randomUUID } from "node:crypto";
import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { adoptionError, cleanText } from "./_adoption-platform.js";
import { consumeUsage } from "./_usage-limit.js";

export function normalizeCaregiver(body = {}) {
  const profile = Object.fromEntries(["name", "kind", "city", "region", "country"].map(key => [key, cleanText(body[key], key === "name" ? 160 : 120)]));
  if (!["shelter", "rescue", "foster"].includes(profile.kind)) throw adoptionError("Choose shelter, rescue, or foster caregiver.", 422);
  if (profile.name.length < 2 || !profile.city || !profile.region || !profile.country) throw adoptionError("Add a public name, city, state or region, and country.", 422);
  if (body.authorityConfirmed !== true) throw adoptionError("Confirm that you are authorized to register this profile and list its pets.", 422);
  return profile;
}

export async function caregiverDashboard(database, userId) {
  const registrations = await database`SELECT organization_id FROM caregiver_registrations WHERE clerk_user_id = ${userId}`;
  const organizations = await database`
    SELECT o.id, o.name, o.kind, o.verification_state AS "verificationState", m.role,
      l.city, l.region, l.country_code AS country
    FROM organizations o JOIN organization_memberships m ON m.organization_id = o.id
    LEFT JOIN organization_locations l ON l.organization_id = o.id AND l.is_primary
    WHERE m.clerk_user_id = ${userId} ORDER BY o.created_at
  `;
  const pets = await database`
    SELECT p.id, p.name, p.species, p.status, p.city, p.organization_id AS "organizationId",
      (p.source_id IS NULL AND ((p.organization_id IS NULL AND p.claimed_by_clerk_user_id = ${userId})
        OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = p.organization_id AND m.clerk_user_id = ${userId} AND m.role = 'administrator'))) AS "canManage"
    FROM pets p WHERE (p.organization_id IS NULL AND p.claimed_by_clerk_user_id = ${userId})
      OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = p.organization_id AND m.clerk_user_id = ${userId})
    ORDER BY p.created_at DESC LIMIT 200
  `;
  return { organizations, pets, registeredOrganizationId: registrations[0]?.organization_id || null, canRegister: registrations.length === 0 };
}

export function createCaregiversHandler(dependencies = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!["GET", "POST"].includes(request.method)) { response.setHeader("Allow", "GET, POST"); return response.status(405).json({ error: "Method not allowed" }); }
    try {
      const user = await (dependencies.authenticate || requireUser)(request);
      const database = (dependencies.getDatabase || getDatabase)();
      if (!database) throw adoptionError("Registration is temporarily unavailable. Please try again.", 503);
      if (request.method === "GET") return response.status(200).json(await caregiverDashboard(database, user.id));
      if (!user.email) throw adoptionError("Verify your account email before registering.", 403);
      const profile = normalizeCaregiver(request.body);
      if (!await consumeUsage(database, { scope: "caregiver_registration", subject: user.id, limit: 5, windowMs: 86400000 })) throw adoptionError("Registration limit reached. Try again tomorrow.", 429);
      const id = randomUUID();
      // One self-registration per account. Lock plus separate statements makes
      // concurrent retries idempotent without matching or claiming an existing team.
      await database.transaction([
        database`SELECT pg_advisory_xact_lock(hashtext(${`caregiver:${user.id}`}))`,
        database`
          WITH created AS (
            INSERT INTO organizations (id, name, kind, verification_state, intake_capacity)
            SELECT ${id}, ${profile.name}, ${profile.kind}, 'unclaimed', 'paused'
            WHERE NOT EXISTS (SELECT 1 FROM caregiver_registrations WHERE clerk_user_id = ${user.id})
            RETURNING id
          ), registration AS (
            INSERT INTO caregiver_registrations (clerk_user_id, organization_id)
            SELECT ${user.id}, id FROM created
          ), membership AS (
            INSERT INTO organization_memberships (organization_id, clerk_user_id, role)
            SELECT id, ${user.id}, 'administrator' FROM created
          )
          INSERT INTO organization_locations (organization_id, city, region, country_code, is_primary)
          SELECT id, ${profile.city}, ${profile.region}, ${profile.country}, true FROM created
        `,
      ]);
      return response.status(201).json(await caregiverDashboard(database, user.id));
    } catch (error) {
      dependencies.onError?.(error);
      return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Caregiver registration is temporarily unavailable. Please try again." });
    }
  };
}
export default createCaregiversHandler();
