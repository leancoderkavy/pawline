import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureCommunityTables } from "./_community.js";
import { consumeUsage } from "./_usage-limit.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (!UUID_PATTERN.test(messageId)) return response.status(400).json({ error: "Choose a valid message." });
  try {
    const allowed = await consumeUsage(database, {
      scope: "community_report_user_day", subject: user.id, limit: 30, windowMs: 24 * 60 * 60 * 1000,
    });
    if (!allowed) return response.status(429).json({ error: "Report limit reached. Contact Pawline support for urgent help." });
  } catch {
    return response.status(503).json({ error: "Reporting safety checks are temporarily unavailable." });
  }
  const visible = await database`
    SELECT id FROM community_messages
    WHERE id=${messageId} AND room='community' AND moderation_state='visible'
    LIMIT 1
  `;
  if (!visible[0]) return response.status(404).json({ error: "That message is not available." });
  await database`
    INSERT INTO community_reports (message_id, reporter_clerk_user_id, reason)
    VALUES (${messageId}, ${user.id}, ${reason})
    ON CONFLICT (message_id, reporter_clerk_user_id) DO NOTHING
  `;
  await database`
    UPDATE community_messages
    SET report_count=(SELECT count(*) FROM community_reports WHERE message_id=${messageId})
    WHERE id=${messageId}
  `;
  return response.status(202).json({ message: "Report received for moderator review." });
}
