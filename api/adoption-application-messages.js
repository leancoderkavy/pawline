import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { consumeUsage } from "./_usage-limit.js";
import { ensureAdoptionPlatformSchema, isUuid, organizationMembership } from "./_adoption-platform.js";

const cleanText = (value, limit) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit)
  : "";

async function authorizedApplication(database, applicationId, user) {
  if (!isUuid(applicationId)) return null;
  const rows = await database`
    SELECT id, clerk_user_id, organization_id, status
    FROM adoption_applications WHERE id = ${applicationId} LIMIT 1
  `;
  const application = rows[0];
  if (!application) return null;
  if (application.clerk_user_id === user.id) return { application, role: "adopter" };
  if (application.organization_id) {
    try {
      await organizationMembership(database, application.organization_id, user.id);
      return { application, role: "organization" };
    } catch { /* The application remains invisible to non-members. */ }
  }
  return null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Application messages are temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  try { await ensureAdoptionPlatformSchema(database); } catch (error) {
    return response.status(error.statusCode || 503).json({ error: error.message });
  }
  const applicationId = request.method === "GET" ? request.query?.applicationId : request.body?.applicationId;
  const authorized = await authorizedApplication(database, applicationId, user);
  if (!authorized) return response.status(404).json({ error: "That application is not available to your account." });
  if (request.method === "GET") {
    const rows = await database`
      SELECT id, sender_role, body, created_at
      FROM adoption_application_messages
      WHERE application_id = ${authorized.application.id}
      ORDER BY created_at ASC LIMIT 200
    `;
    return response.status(200).json({ messages: rows.map(row => ({
      id: row.id, senderRole: row.sender_role, body: row.body, createdAt: row.created_at,
    })) });
  }
  if (!['submitted', 'reviewing', 'follow_up_needed', 'meet_and_greet', 'approved', 'adoption_pending'].includes(authorized.application.status)) {
    return response.status(409).json({ error: "Messages open after Pawline confirms this application was submitted." });
  }
  const body = cleanText(request.body?.body, 4000);
  if (!body) return response.status(422).json({ error: "Write a message before sending." });
  try {
    const allowed = await consumeUsage(database, {
      scope: "adoption_application_message_user_hour", subject: user.id, limit: 80, windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return response.status(429).json({ error: "Message limit reached. Try again later." });
  } catch {
    return response.status(503).json({ error: "Message safety checks are temporarily unavailable." });
  }
  const rows = await database`
    WITH created AS (
      INSERT INTO adoption_application_messages (application_id, sender_clerk_user_id, sender_role, body)
      VALUES (${authorized.application.id}, ${user.id}, ${authorized.role}, ${body})
      RETURNING id, sender_role, body, created_at
    ), audited AS (
      INSERT INTO adoption_application_events (application_id, event_type, actor_type, actor_clerk_user_id, event_data)
      SELECT ${authorized.application.id}, 'message_sent', ${authorized.role}, ${user.id}, '{}'::jsonb FROM created
    ) SELECT * FROM created
  `;
  const message = rows[0];
  return response.status(201).json({ message: {
    id: message.id, senderRole: message.sender_role, body: message.body, createdAt: message.created_at,
  } });
}
