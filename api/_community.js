const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const BLOCKED_PATTERNS = [
  { code: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { code: "phone", pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/ },
  { code: "exact_address", pattern: /\b\d{1,6}\s+[A-Za-z0-9.' -]{2,45}\s(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|boulevard|blvd|way)\b/i },
  { code: "credential", pattern: /\b(?:password|passcode|verification code|social security|ssn|credit card)\b/i },
  { code: "threat", pattern: /\b(?:kill|hurt|poison|shoot)\s+(?:you|them|him|her|the (?:dog|cat|pet|animal))\b/i },
  { code: "harassment", pattern: /\b(?:racial slur|doxx|doxing|swat you)\b/i },
  { code: "unsafe_meetup", pattern: /\b(?:come to my house|meet at my home|private address)\b/i },
  { code: "sale", pattern: /\b(?:wire money|gift card|crypto payment|deposit before meeting)\b/i },
];

export function moderateMessage(input) {
  const text = String(input || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!text) return { allowed: false, code: "empty", message: "Write a message first." };
  const match = BLOCKED_PATTERNS.find((rule) => rule.pattern.test(text));
  if (match) {
    return {
      allowed: false,
      code: match.code,
      message: "For everyone’s safety, remove private contact details, exact addresses, threats, payment requests, or unsafe meetup details.",
    };
  }
  return { allowed: true, text, urls: [...new Set(text.match(URL_PATTERN) || [])].slice(0, 3) };
}

export function publicMessage(row) {
  return {
    id: row.id,
    body: row.body,
    author: {
      id: row.clerk_user_id,
      name: row.author_name,
      imageUrl: row.author_image_url,
    },
    linkPreview: row.link_preview || null,
    createdAt: row.created_at,
    reportCount: Number(row.report_count || 0),
  };
}

export async function ensureCommunityTables(database) {
  await database`
    CREATE TABLE IF NOT EXISTS community_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room text NOT NULL DEFAULT 'community',
      clerk_user_id text NOT NULL,
      author_name text NOT NULL,
      author_image_url text,
      body text NOT NULL,
      link_preview jsonb,
      moderation_state text NOT NULL DEFAULT 'visible'
        CHECK (moderation_state IN ('visible', 'held', 'removed')),
      report_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await database`CREATE INDEX IF NOT EXISTS community_messages_room_created ON community_messages (room, created_at DESC)`;
  await database`
    CREATE TABLE IF NOT EXISTS community_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
      reporter_clerk_user_id text NOT NULL,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (message_id, reporter_clerk_user_id)
    )
  `;
  await database`
    CREATE TABLE IF NOT EXISTS community_leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submitted_by_clerk_user_id text NOT NULL,
      source_url text NOT NULL UNIQUE,
      source_domain text NOT NULL,
      name text,
      species text CHECK (species IS NULL OR species IN ('Dog', 'Cat')),
      breed text,
      age text,
      description text,
      image_url text,
      city text,
      country text,
      latitude double precision,
      longitude double precision,
      verification_state text NOT NULL DEFAULT 'needs_confirmation'
        CHECK (verification_state IN ('needs_confirmation', 'confirmed', 'rejected')),
      parser_state text NOT NULL DEFAULT 'parsed'
        CHECK (parser_state IN ('parsed', 'failed')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

