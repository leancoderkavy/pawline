import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureCommunityTables } from "./_community.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Community storage is not configured." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  await ensureCommunityTables(database);
  const messageId = String(request.body?.messageId || "");
  const reason = String(request.body?.reason || "safety").trim().slice(0, 240);
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return response.status(400).json({ error: "Choose a valid message." });
  await database`
    INSERT INTO community_reports (message_id, reporter_clerk_user_id, reason)
    VALUES (${messageId}, ${user.id}, ${reason})
    ON CONFLICT (message_id, reporter_clerk_user_id) DO NOTHING
  `;
  await database`
    UPDATE community_messages
    SET report_count=(SELECT count(*) FROM community_reports WHERE message_id=${messageId}),
        moderation_state=CASE
          WHEN (SELECT count(*) FROM community_reports WHERE message_id=${messageId}) >= 3 THEN 'held'
          ELSE moderation_state
        END
    WHERE id=${messageId}
  `;
  return response.status(202).json({ message: "Report received. Repeatedly reported messages are hidden automatically for review." });
}
