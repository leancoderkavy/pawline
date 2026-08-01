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
  await database`
    ALTER TABLE pets
      ADD COLUMN IF NOT EXISTS claimed_by_clerk_user_id text,
      ADD COLUMN IF NOT EXISTS claimed_by_display_name text,
      ADD COLUMN IF NOT EXISTS claimed_at timestamptz
  `;
  await database`
    CREATE TABLE IF NOT EXISTS direct_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      owner_clerk_user_id text NOT NULL,
      owner_name text NOT NULL,
      owner_image_url text,
      inquirer_clerk_user_id text NOT NULL,
      inquirer_name text NOT NULL,
      inquirer_image_url text,
      last_message_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (owner_clerk_user_id <> inquirer_clerk_user_id),
      UNIQUE (listing_id, owner_clerk_user_id, inquirer_clerk_user_id)
    )
  `;
  await database`CREATE INDEX IF NOT EXISTS direct_conversations_owner_recent ON direct_conversations (owner_clerk_user_id, last_message_at DESC)`;
  await database`CREATE INDEX IF NOT EXISTS direct_conversations_inquirer_recent ON direct_conversations (inquirer_clerk_user_id, last_message_at DESC)`;
  await database`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
      sender_clerk_user_id text NOT NULL,
      author_name text NOT NULL,
      author_image_url text,
      body text NOT NULL,
      moderation_state text NOT NULL DEFAULT 'visible'
        CHECK (moderation_state IN ('visible', 'held', 'removed')),
      report_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await database`CREATE INDEX IF NOT EXISTS direct_messages_conversation_created ON direct_messages (conversation_id, created_at)`;
  await database`
    CREATE TABLE IF NOT EXISTS direct_message_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
      reporter_clerk_user_id text NOT NULL,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (message_id, reporter_clerk_user_id)
    )
  `;
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
