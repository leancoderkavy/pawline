import { listConversations } from "./_direct.js";
import { privateHandler, networkError, uuid } from "./_network.js";
export function meetingTime(body, now = Date.now()) {
  const startsAt = new Date(body.startsAt);
  if (
    !Number.isFinite(startsAt.getTime()) ||
    startsAt.getTime() < now + 60000 ||
    startsAt.getTime() > now + 90 * 86400000
  )
    throw networkError(
      "Choose a meeting between one minute and 90 days from now.",
    );
  try {
    new Intl.DateTimeFormat("en", { timeZone: body.timezone }).format();
  } catch {
    throw networkError("Choose a valid timezone.");
  }
  if (typeof body.timezone !== "string" || body.timezone.length > 80)
    throw networkError("Choose a timezone.");
  return { startsAt: startsAt.toISOString(), timezone: body.timezone };
}
export async function meetingAction(database, user, request) {
  const body = request.body || {},
    conversationId = body.conversationId || request.query?.conversationId;
  if (!uuid(conversationId)) throw networkError("Choose a conversation.");
  const [conversation] = await listConversations(
    database,
    user.id,
    conversationId,
  );
  if (!conversation) throw networkError("Conversation not found.", 404);
  if (request.method === "GET")
    return {
      meetings:
        await database`SELECT id,starts_at,timezone,state,proposed_by=${user.id} AS mine FROM direct_meetings WHERE conversation_id=${conversationId} AND starts_at > now()-interval '1 day' ORDER BY starts_at LIMIT 20`,
    };
  if (conversation.blocked || conversation.status === "resolved")
    throw networkError("This conversation is resolved or blocked.", 409);
  if (request.method === "PATCH") {
    if (!uuid(body.id) || !["confirmed", "cancelled"].includes(body.state))
      throw networkError("Choose a meeting and response.");
    const rows =
      await database`UPDATE direct_meetings SET state=${body.state} WHERE id=${body.id} AND conversation_id=${conversationId} AND state <> 'cancelled' AND starts_at > now() AND (${body.state}='cancelled' OR (proposed_by=${conversation.inquirer_clerk_user_id}) <> (${user.id}=${conversation.inquirer_clerk_user_id})) RETURNING id`;
    if (!rows[0])
      throw networkError(
        "The other participant must confirm an upcoming proposal.",
        409,
      );
    return { updated: true };
  }
  const slot = meetingTime(body);
  const rows =
    await database`INSERT INTO direct_meetings (conversation_id,proposed_by,starts_at,timezone) SELECT ${conversationId},${user.id},${slot.startsAt},${slot.timezone} WHERE (SELECT count(*) FROM direct_meetings WHERE conversation_id=${conversationId} AND state<>'cancelled' AND starts_at>now())<5 ON CONFLICT DO NOTHING RETURNING id`;
  if (!rows[0])
    throw networkError(
      "That time is already proposed, or five upcoming meetings already exist.",
      409,
    );
  return { meeting: rows[0] };
}
export default privateHandler(["GET", "POST", "PATCH"], meetingAction);
