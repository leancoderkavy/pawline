import Ably from "ably";
import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureDirectMessageTables, findConversation, parseConversationId, publicDirectMessage } from "./_direct.js";
import { moderateMessage } from "./_community.js";

const buckets = new Map();
function limited(userId) {
  const now = Date.now();
  const entry = buckets.get(userId);
  if (!entry || now - entry.startedAt > 60_000) {
    buckets.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 18;
}

async function publish(message, conversation) {
  if (!process.env.ABLY_API_KEY) return;
  const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  await Promise.all([
    conversation.owner_clerk_user_id,
    conversation.inquirer_clerk_user_id,
  ].map((userId) => ably.channels.get(`pawline:direct:${userId}`).publish("message.created", message)));
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
  const conversationId = parseConversationId(request.method === "GET" ? request.query?.conversationId : request.body?.conversationId);
  if (!conversationId) return response.status(400).json({ error: "Choose a valid conversation." });
  const conversation = await findConversation(database, conversationId, user.id);
  if (!conversation) return response.status(404).json({ error: "That conversation is not available to this account." });

  if (request.method === "GET") {
    const rows = await database`
      SELECT id, conversation_id, sender_clerk_user_id, author_name, author_image_url, body, created_at, report_count
      FROM direct_messages
      WHERE conversation_id = ${conversationId} AND moderation_state = 'visible'
      ORDER BY created_at ASC
      LIMIT 160
    `;
    return response.status(200).json({ messages: rows.map((row) => publicDirectMessage(row, user.id)) });
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (limited(user.id)) return response.status(429).json({ error: "You’re sending messages too quickly. Pause for a moment." });
  const moderated = moderateMessage(request.body?.body);
  if (!moderated.allowed) return response.status(422).json({ error: moderated.message, moderationCode: moderated.code });
  const rows = await database`
    INSERT INTO direct_messages (conversation_id, sender_clerk_user_id, author_name, author_image_url, body)
    VALUES (${conversationId}, ${user.id}, ${user.displayName}, ${user.imageUrl}, ${moderated.text})
    RETURNING id, conversation_id, sender_clerk_user_id, author_name, author_image_url, body, created_at, report_count
  `;
  await database`UPDATE direct_conversations SET last_message_at = now() WHERE id = ${conversationId}`;
  const message = publicDirectMessage(rows[0], user.id);
  await publish(message, conversation).catch((error) => console.error("Direct realtime publish failed", error.message));
  return response.status(201).json({ message });
}
