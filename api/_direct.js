const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseListingId(value) {
  const raw = String(value || "");
  const id = raw.startsWith("pawline-") ? raw.slice("pawline-".length) : raw;
  return UUID_PATTERN.test(id) ? id : null;
}

export function parseConversationId(value) {
  const id = String(value || "");
  return UUID_PATTERN.test(id) ? id : null;
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function publicConversation(row, userId) {
  const isOwner = row.owner_clerk_user_id === userId;
  return {
    id: row.id,
    role: isOwner ? "listing_contact" : "inquirer",
    other: {
      name: isOwner ? row.inquirer_name : row.owner_name,
      imageUrl: isOwner ? row.inquirer_image_url : row.owner_image_url,
    },
    listing: {
      id: `pawline-${row.listing_id}`,
      name: row.pet_name,
      shelter: row.shelter,
      species: row.species,
      breed: row.breed,
      image: safeHttpUrl(row.image_url),
      city: row.city,
    },
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  };
}

export function publicDirectMessage(row, userId) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.body,
    mine: row.sender_clerk_user_id === userId,
    author: {
      id: row.sender_clerk_user_id,
      name: row.author_name,
      imageUrl: row.author_image_url,
    },
    createdAt: row.created_at,
    reportCount: Number(row.report_count || 0),
  };
}

export async function ensureDirectMessageTables(database) {
  const schema = await database`
    SELECT
      to_regclass('public.direct_conversations') AS conversations,
      to_regclass('public.direct_messages') AS messages,
      to_regclass('public.direct_message_reports') AS reports
  `;
  if (!schema[0]?.conversations || !schema[0]?.messages || !schema[0]?.reports) {
    throw new Error("Direct messaging migration is missing.");
  }
}

export async function findConversation(database, conversationId, userId) {
  const rows = await database`
    SELECT c.*, p.name AS pet_name, p.species, p.breed, p.shelter, p.image_url, p.city
    FROM direct_conversations c
    JOIN pets p ON p.id = c.listing_id
    WHERE c.id = ${conversationId}
      AND (c.owner_clerk_user_id = ${userId} OR c.inquirer_clerk_user_id = ${userId})
    LIMIT 1
  `;
  return rows[0] || null;
}
