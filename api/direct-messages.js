import { directEndpoint, directError, parseConversationId, publicDirectMessage, requireConversation, requireWritable } from "./_direct.js";
import { moderateMessage } from "./_community.js";
import { consumeUsageChain } from "./_usage-limit.js";

export function createMessagesHandler(dependencies) {
  return directEndpoint(["GET", "POST"], async ({ request, response, database, user, notify }) => {
    const conversationId = request.method === "GET" ? request.query?.conversationId : request.body?.conversationId;
    const conversation = await requireConversation(database, conversationId, user.id);
    if (request.method === "GET") {
      const before = request.query?.before;
      let cursor = null;
      if (before) {
        if (!parseConversationId(before)) throw directError("Choose a valid message cursor.");
        [cursor] = await database`SELECT id, created_at::text AS created_at FROM direct_messages WHERE id = ${before} AND conversation_id = ${conversationId}`;
        if (!cursor) throw directError("That message is not in this conversation.", 404);
      }
      const rows = await database`
        SELECT * FROM direct_messages WHERE conversation_id = ${conversationId} AND moderation_state = 'visible'
          AND (${cursor?.id || null}::uuid IS NULL OR (created_at, id) < (${cursor?.created_at || null}::timestamptz, ${cursor?.id || null}::uuid))
        ORDER BY created_at DESC, id DESC LIMIT 61
      `;
      const page = rows.slice(0, 60).reverse();
      return response.status(200).json({ messages: page.map(row => publicDirectMessage(row, user.id)), olderCursor: rows.length > 60 ? page[0].id : null });
    }
    requireWritable(conversation);
    if (typeof request.body?.body !== "string" || request.body.body.length > 2000) throw directError("Messages must contain at most 2,000 characters.", 422);
    const clientId = parseConversationId(request.body?.clientMessageId);
    if (!clientId) throw directError("A valid message request ID is required.");
    const moderated = moderateMessage(request.body.body);
    if (!moderated.allowed) return response.status(422).json({ error: moderated.message, moderationCode: moderated.code });
    const existing = await database`SELECT * FROM direct_messages WHERE conversation_id = ${conversationId} AND sender_clerk_user_id = ${user.id} AND client_message_id = ${clientId}`;
    if (existing[0]) return response.status(200).json({ message: publicDirectMessage(existing[0], user.id) });
    const reservation = await consumeUsageChain(database, [
      { scope: "direct_message_user_minute", subject: user.id, limit: 18, windowMs: 60000 },
      { scope: "direct_message_user_day", subject: user.id, limit: 750, windowMs: 86400000 },
    ]);
    if (!reservation.allowed) throw directError("Message limit reached. Pause before trying again.", 429);
    const rows = await database`
      WITH message AS (
        INSERT INTO direct_messages (conversation_id, sender_clerk_user_id, author_name, author_image_url, body, client_message_id)
        VALUES (${conversationId}, ${user.id}, ${user.displayName}, ${user.imageUrl}, ${moderated.text}, ${clientId})
        ON CONFLICT (conversation_id, sender_clerk_user_id, client_message_id) DO UPDATE SET client_message_id = EXCLUDED.client_message_id
        RETURNING *
      ), touched AS (
        UPDATE direct_conversations SET last_message_at = GREATEST(last_message_at, (SELECT created_at FROM message)) WHERE id = ${conversationId}
      ) SELECT * FROM message
    `;
    await notify(conversation);
    return response.status(201).json({ message: publicDirectMessage(rows[0], user.id) });
  }, dependencies);
}
export default createMessagesHandler();
