import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureDirectMessageTables } from "./_direct.js";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Private messages are temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  await ensureDirectMessageTables(database);
  const messageId = String(request.body?.messageId || "");
  if (!UUID_PATTERN.test(messageId)) return response.status(400).json({ error: "Choose a valid message." });
  const visible = await database`
    SELECT message.id
    FROM direct_messages message
    JOIN direct_conversations conversation ON conversation.id = message.conversation_id
    WHERE message.id = ${messageId}
      AND (conversation.owner_clerk_user_id = ${user.id} OR conversation.inquirer_clerk_user_id = ${user.id})
    LIMIT 1
  `;
  if (!visible[0]) return response.status(404).json({ error: "That message is not available to this account." });
  const reason = String(request.body?.reason || "safety").trim().slice(0, 240);
  await database`
    INSERT INTO direct_message_reports (message_id, reporter_clerk_user_id, reason)
    VALUES (${messageId}, ${user.id}, ${reason})
    ON CONFLICT (message_id, reporter_clerk_user_id) DO NOTHING
  `;
  await database`
    UPDATE direct_messages
    SET report_count = (SELECT count(*) FROM direct_message_reports WHERE message_id = ${messageId}),
        moderation_state = CASE
          WHEN (SELECT count(*) FROM direct_message_reports WHERE message_id = ${messageId}) >= 3 THEN 'held'
          ELSE moderation_state
        END
    WHERE id = ${messageId}
  `;
  return response.status(202).json({ message: "Report received. Repeatedly reported messages are hidden for review." });
}
