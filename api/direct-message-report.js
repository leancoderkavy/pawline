import { directEndpoint, directError, parseConversationId, requireConversation } from "./_direct.js";
import { consumeUsage } from "./_usage-limit.js";
export function createReportHandler(dependencies) {
  return directEndpoint(["POST"], async ({ request, response, database, user }) => {
    const messageId = parseConversationId(request.body?.messageId);
    if (!messageId) throw directError("Choose a valid message.");
    const [message] = await database`SELECT conversation_id, sender_clerk_user_id FROM direct_messages WHERE id = ${messageId}`;
    if (!message) throw directError("That message is not available to this account.", 404);
    await requireConversation(database, message.conversation_id, user.id);
    if (message.sender_clerk_user_id === user.id) throw directError("You cannot report your own message.", 422);
    const allowed = await consumeUsage(database, { scope: "direct_report_user_day", subject: user.id, limit: 30, windowMs: 86400000 });
    if (!allowed) throw directError("Report limit reached. Contact Pawline support for urgent help.", 429);
    const reason = String(request.body?.reason || "Private-message safety report").trim().slice(0, 240);
    await database`
      INSERT INTO direct_message_reports (message_id, reporter_clerk_user_id, reason) VALUES (${messageId}, ${user.id}, ${reason})
      ON CONFLICT (message_id, reporter_clerk_user_id) DO NOTHING
    `;
    await database`UPDATE direct_messages SET report_count = (SELECT count(*) FROM direct_message_reports WHERE message_id = ${messageId}) WHERE id = ${messageId}`;
    return response.status(202).json({ message: "Report received for moderator review." });
  }, dependencies);
}
export default createReportHandler();
