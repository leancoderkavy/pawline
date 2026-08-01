const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const BLOCKED_PATTERNS = [
  { code: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { code: "email", pattern: /\b[A-Z0-9._%+-]+\s*(?:\(at\)|\[at\]|\bat\b)\s*[A-Z0-9.-]+\s*(?:\(dot\)|\[dot\]|\bdot\b|\.)\s*[A-Z]{2,}\b/i },
  { code: "phone", pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/ },
  { code: "phone", pattern: /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){9}\b/i },
  { code: "exact_address", pattern: /\b\d{1,6}\s+[A-Za-z0-9.' -]{2,45}\s(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|boulevard|blvd|way)\b/i },
  { code: "exact_address", pattern: /\b(?:one|two|three|four|five|six|seven|eight|nine)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|zero)){0,5}\s+[A-Za-z.' -]{2,45}\s(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|boulevard|blvd|way)\b/i },
  { code: "credential", pattern: /\b(?:password|passcode|verification code|social security|ssn|credit card)\b/i },
  { code: "threat", pattern: /\b(?:kill|hurt|poison|shoot)\s+(?:you|them|him|her|the (?:dog|cat|pet|animal))\b/i },
  { code: "harassment", pattern: /\b(?:racial slur|doxx|doxing|swat you)\b/i },
  { code: "unsafe_meetup", pattern: /\b(?:come to my house|meet at my home|private address)\b/i },
  { code: "sale", pattern: /\b(?:wire money|gift card|crypto payment|deposit before meeting)\b/i },
];

export function moderateMessage(input) {
  const text = String(input || "").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim().slice(0, 2000);
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
  const schema = await database`
    SELECT
      to_regclass('public.community_messages') AS messages,
      to_regclass('public.community_reports') AS reports,
      to_regclass('public.community_leads') AS leads
  `;
  if (!schema[0]?.messages || !schema[0]?.reports || !schema[0]?.leads) {
    throw new Error("Community storage migration is missing.");
  }
}
