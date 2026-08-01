import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureDirectMessageTables, findConversation, parseListingId, publicConversation } from "./_direct.js";

async function listConversations(database, userId) {
  return database`
    SELECT c.*, p.name AS pet_name, p.species, p.breed, p.shelter, p.image_url, p.city
    FROM direct_conversations c
    JOIN pets p ON p.id = c.listing_id
    WHERE c.owner_clerk_user_id = ${userId} OR c.inquirer_clerk_user_id = ${userId}
    ORDER BY c.last_message_at DESC
    LIMIT 80
  `;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Private messages are temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  await ensureDirectMessageTables(database);

  if (request.method === "GET") {
    const rows = await listConversations(database, user.id);
    return response.status(200).json({ conversations: rows.map((row) => publicConversation(row, user.id)) });
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const listingId = parseListingId(request.body?.listingId);
  if (!listingId) return response.status(400).json({ error: "Choose a valid Pawline listing." });
  const listings = await database`
    SELECT id, name, shelter, claimed_by_clerk_user_id, claimed_by_display_name
    FROM pets
    WHERE id = ${listingId} AND status = 'available' AND verified_at IS NOT NULL
    LIMIT 1
  `;
  const listing = listings[0];
  if (!listing?.claimed_by_clerk_user_id) {
    return response.status(409).json({ error: "This listing is not accepting Pawline messages yet. Use the official listing to contact the organization." });
  }
  if (listing.claimed_by_clerk_user_id === user.id) {
    return response.status(422).json({ error: "This is your listing. Open Messages to respond to adoption questions." });
  }

  const created = await database`
    INSERT INTO direct_conversations (
      listing_id, owner_clerk_user_id, owner_name, inquirer_clerk_user_id, inquirer_name, inquirer_image_url
    ) VALUES (
      ${listing.id}, ${listing.claimed_by_clerk_user_id}, ${listing.claimed_by_display_name || listing.shelter || "Pawline caretaker"},
      ${user.id}, ${user.displayName}, ${user.imageUrl}
    )
    ON CONFLICT (listing_id, owner_clerk_user_id, inquirer_clerk_user_id)
    DO UPDATE SET last_message_at = direct_conversations.last_message_at
    RETURNING id
  `;
  const conversation = await findConversation(database, created[0].id, user.id);
  return response.status(201).json({ conversation: publicConversation(conversation, user.id) });
}
