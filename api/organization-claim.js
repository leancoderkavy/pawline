import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureAdoptionPlatformSchema, redeemOrganizationClaim } from "./_adoption-platform.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Organization claiming is temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  try {
    await ensureAdoptionPlatformSchema(database);
    const organizationId = await redeemOrganizationClaim(database, request.body?.token, user);
    return response.status(200).json({ organizationId, role: "administrator" });
  } catch (error) {
    console.error("Organization claim failed", error.message);
    return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Organization claiming is temporarily unavailable." });
  }
}
