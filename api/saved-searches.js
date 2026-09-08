import {
  privateHandler,
  requiredText,
  networkError,
  uuid,
} from "./_network.js";
import { catalogQuery, searchCatalog } from "./catalog.js";
export async function savedSearchAction(database, user, request) {
  if (request.method === "GET") {
    const searches =
      await database`SELECT id,name,filters,last_checked_at FROM saved_pet_searches WHERE clerk_user_id=${user.id} ORDER BY created_at DESC LIMIT 20`;
    return { searches };
  }
  const body = request.body || {};
  if (request.method === "DELETE") {
    if (!uuid(body.id)) throw networkError("Choose a saved search.");
    await database`DELETE FROM saved_pet_searches WHERE id=${body.id} AND clerk_user_id=${user.id}`;
    return { removed: true };
  }
  if (body.action === "check") {
    if (!uuid(body.id)) throw networkError("Choose a saved search.");
    const [search] =
      await database`SELECT filters,last_checked_at FROM saved_pet_searches WHERE id=${body.id} AND clerk_user_id=${user.id}`;
    if (!search) throw networkError("Saved search not found.", 404);
    const result = await searchCatalog(database, catalogQuery(search.filters));
    // Never mark unseen later pages read; notifications refer to the current page.
    return {
      ...result,
      newPets: result.pets.filter(
        (p) =>
          p.listedAt && new Date(p.listedAt) > new Date(search.last_checked_at),
      ),
      lastCheckedAt: search.last_checked_at,
    };
  }
  const name = requiredText(body.name, 1, 100, "a search name");
  let normalized;
  try {
    normalized = catalogQuery(body.filters);
  } catch (error) {
    throw networkError(error.message);
  }
  const filters = {
    species: normalized.species || "All",
    q: normalized.text,
    ...(normalized.latitude !== null
      ? {
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          radius: normalized.radius,
        }
      : {}),
  };
  const rows = await database`
    INSERT INTO saved_pet_searches (clerk_user_id,name,filters)
    SELECT ${user.id},${name},${JSON.stringify(filters)}::jsonb
    WHERE (SELECT count(*) FROM saved_pet_searches WHERE clerk_user_id=${user.id}) < 20
    ON CONFLICT (clerk_user_id,name) DO UPDATE SET filters=EXCLUDED.filters
    RETURNING id,name,filters`;
  if (!rows[0])
    throw networkError(
      "Remove a saved search before adding another (maximum 20).",
      409,
    );
  return { search: rows[0] };
}
export default privateHandler(["GET", "POST", "DELETE"], savedSearchAction);
