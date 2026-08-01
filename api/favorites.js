import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { consumeUsage } from "./_usage-limit.js";

const validListingId = value => {
  const id = String(value || "").trim();
  return id && id.length <= 240 ? id : null;
};

async function ensureFavoritesTable(database) {
  const rows = await database`SELECT to_regclass('public.user_favorites') AS user_favorites`;
  if (!rows[0]?.user_favorites) throw new Error("Favorite storage migration is missing.");
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "PUT"].includes(request.method)) {
    response.setHeader("Allow", "GET, PUT");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Favorite storage is not configured." });

  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }

  await ensureFavoritesTable(database);
  if (request.method === "GET") {
    const rows = await database`
      SELECT listing_id
      FROM user_favorites
      WHERE clerk_user_id=${user.id}
      ORDER BY created_at DESC
      LIMIT 500
    `;
    return response.status(200).json({ favorites: rows.map(row => row.listing_id) });
  }

  const listingId = validListingId(request.body?.listingId);
  if (!listingId || typeof request.body?.favorite !== "boolean") {
    return response.status(400).json({ error: "Provide a valid listing and favorite state." });
  }
  try {
    const allowed = await consumeUsage(database, {
      scope: "favorite_write_user_hour", subject: user.id, limit: 300, windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return response.status(429).json({ error: "Favorite update limit reached. Try again later." });
  } catch {
    return response.status(503).json({ error: "Favorite safety checks are temporarily unavailable." });
  }
  if (request.body.favorite) {
    await database`
      INSERT INTO user_favorites (clerk_user_id, listing_id)
      VALUES (${user.id}, ${listingId})
      ON CONFLICT (clerk_user_id, listing_id) DO NOTHING
    `;
  } else {
    await database`
      DELETE FROM user_favorites
      WHERE clerk_user_id=${user.id} AND listing_id=${listingId}
    `;
  }
  return response.status(200).json({ listingId, favorite: request.body.favorite });
}

