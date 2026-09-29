import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { consumeUsage, requestClientKey } from "./_usage-limit.js";
import { sendShelterConfirmationEmail } from "./_email.js";

const TYPES = new Set(["access", "correction", "deletion", "other"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = new Set(["received", "verifying", "in_progress", "completed", "denied"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePrivacyRequest(body) {
  const type = String(body?.type || "");
  const email = String(body?.email || "").trim().toLowerCase();
  const details = String(body?.details || "").trim();
  if (!TYPES.has(type)) return { error: "Choose a request type." };
  if (email.length > 254 || !EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (details.length > 2000) return { error: "Keep details under 2,000 characters." };
  return { type, email, details };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, PATCH");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Privacy requests are temporarily unavailable." });
  const operatorEmail = String(process.env.PAWLINE_PRIVACY_OPERATOR_EMAIL || process.env.PAWLINE_MODERATION_EMAIL || "").trim().toLowerCase();
  if (!operatorEmail) return response.status(503).json({ error: "Privacy requests are temporarily unavailable." });
  if (request.method === "GET" || request.method === "PATCH") {
    let user;
    try { user = await requireUser(request); } catch { return response.status(401).json({ error: "Sign in to review requests." }); }
    if (user.email !== operatorEmail) return response.status(403).json({ error: "Access denied." });
    try {
      if (request.method === "PATCH") {
        const id = String(request.body?.id || "");
        const status = String(request.body?.status || "");
        if (!UUID.test(id) || !STATUSES.has(status)) return response.status(422).json({ error: "Choose a valid request and status." });
        const updated = await database`UPDATE privacy_requests SET status=${status}, updated_at=now(), updated_by=${user.id} WHERE id=${id} RETURNING id, status`;
        if (!updated[0]) return response.status(404).json({ error: "Request not found." });
        return response.status(200).json({ request: updated[0] });
      }
      const rows = await database`
        SELECT id, request_type, contact_email, details, status, created_at
        FROM privacy_requests
        ORDER BY
          CASE WHEN status IN ('received', 'verifying', 'in_progress') THEN 0 ELSE 1 END,
          CASE WHEN status IN ('received', 'verifying', 'in_progress') THEN created_at END ASC,
          created_at DESC
        LIMIT 100
      `;
      return response.status(200).json({ requests: rows });
    } catch {
      return response.status(503).json({ error: "Privacy requests are temporarily unavailable." });
    }
  }
  const data = validatePrivacyRequest(request.body);
  if (data.error) return response.status(422).json(data);
  try {
    const allowed = await consumeUsage(database, { scope: "privacy_request_client_day", subject: requestClientKey(request), limit: 5, windowMs: 86400000 });
    if (!allowed) return response.status(429).json({ error: "Request limit reached. Try again tomorrow." });
    const rows = await database`
      INSERT INTO privacy_requests (request_type, contact_email, details)
      VALUES (${data.type}, ${data.email}, ${data.details}) RETURNING id
    `;
    if (process.env.RESEND_API_KEY && process.env.PAWLINE_FROM_EMAIL) {
      try {
        await sendShelterConfirmationEmail({
          to: operatorEmail,
          subject: "Pawline privacy request received",
          text: `A privacy request was received. Reference: ${rows[0].id}. Review the private operator queue. No requester details are included in this email.`,
          idempotencyKey: `privacy-request-${rows[0].id}`,
        });
      } catch (error) { console.error("Privacy request notification failed", error.message); }
    }
    return response.status(201).json({ id: rows[0].id, message: "Request received. Pawline will verify your identity before acting on account data." });
  } catch {
    return response.status(503).json({ error: "Privacy requests are temporarily unavailable." });
  }
}
