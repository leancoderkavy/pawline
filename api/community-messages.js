import Ably from "ably";
import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureCommunityTables, moderateMessage, publicMessage } from "./_community.js";

const buckets = new Map();
function limited(userId) {
  const now = Date.now();
  const entry = buckets.get(userId);
  if (!entry || now - entry.startedAt > 60_000) {
    buckets.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 12;
}

async function publish(message) {
  if (!process.env.ABLY_API_KEY) return;
  const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  await ably.channels.get("pawline:community").publish("message.created", message);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Community storage is not configured." });
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  await ensureCommunityTables(database);

  if (request.method === "GET") {
    const rows = await database`
      SELECT id, clerk_user_id, author_name, author_image_url, body, link_preview, created_at, report_count
      FROM community_messages
      WHERE room='community' AND moderation_state='visible'
      ORDER BY created_at DESC
      LIMIT 80
    `;
    return response.status(200).json({ messages: rows.reverse().map(publicMessage) });
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (limited(user.id)) return response.status(429).json({ error: "You’re sending messages too quickly. Pause for a moment." });
  const moderated = moderateMessage(request.body?.body);
  if (!moderated.allowed) return response.status(422).json({ error: moderated.message, moderationCode: moderated.code });

  const preview = request.body?.linkPreview;
  const safePreview = preview && typeof preview === "object" ? {
    id: String(preview.id || "").slice(0, 100),
    name: String(preview.name || "Pet listing").slice(0, 120),
    species: ["Dog", "Cat"].includes(preview.species) ? preview.species : null,
    city: String(preview.city || "").slice(0, 140),
    sourceUrl: moderated.urls.includes(preview.sourceUrl) ? preview.sourceUrl : moderated.urls[0] || null,
    sourceDomain: String(preview.sourceDomain || "").slice(0, 160),
    imageUrl: /^https:\/\//.test(preview.imageUrl || "") ? preview.imageUrl : null,
    verificationState: preview.verificationState === "provider_verified" ? "provider_verified" : "needs_confirmation",
  } : null;
  const rows = await database`
    INSERT INTO community_messages (clerk_user_id, author_name, author_image_url, body, link_preview)
    VALUES (${user.id}, ${user.displayName}, ${user.imageUrl}, ${moderated.text}, ${safePreview})
    RETURNING id, clerk_user_id, author_name, author_image_url, body, link_preview, created_at, report_count
  `;
  const message = publicMessage(rows[0]);
  await publish(message).catch((error) => console.error("Community realtime publish failed", error.message));
  return response.status(201).json({ message });
}

