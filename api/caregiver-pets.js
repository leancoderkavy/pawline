import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { adoptionError, isUuid } from "./_adoption-platform.js";

export function createCaregiverPetsHandler(dependencies = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "PATCH") { response.setHeader("Allow", "PATCH"); return response.status(405).json({ error: "Method not allowed" }); }
    try {
      const user = await (dependencies.authenticate || requireUser)(request);
      const database = (dependencies.getDatabase || getDatabase)();
      if (!database) throw adoptionError("Pet management is temporarily unavailable.", 503);
      const { petId, status } = request.body || {};
      if (!isUuid(petId) || !["adopted", "unavailable"].includes(status)) throw adoptionError("Choose a pet and mark it adopted or unavailable.", 422);
      const rows = await database`
        UPDATE pets p SET status = ${status}, updated_at = now()
        WHERE p.id = ${petId} AND p.source_id IS NULL AND p.status IN ('pending', 'available', 'unavailable', 'adopted')
          AND ((p.organization_id IS NULL AND p.claimed_by_clerk_user_id = ${user.id})
            OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = p.organization_id AND m.clerk_user_id = ${user.id} AND m.role = 'administrator'))
        RETURNING id, name, status
      `;
      if (!rows[0]) throw adoptionError("This pet is not available to manage from this account.", 404);
      return response.status(200).json({ pet: rows[0] });
    } catch (error) {
      dependencies.onError?.(error);
      return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "We could not update this pet. Please try again." });
    }
  };
}
export default createCaregiverPetsHandler();
