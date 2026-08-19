import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { ensureAdoptionPlatformSchema, isUuid } from "./_adoption-platform.js";

const CATEGORIES = {
  application_coach: ["single_answer", "question_context"],
  intake_summarizer: ["household", "carePlan", "schedule"],
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "AI consent storage is temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  const task = String(request.body?.task || "");
  if (!CATEGORIES[task] || request.body?.consentToAiProcessing !== true) {
    return response.status(422).json({ error: "Explicit consent is required for this AI task." });
  }
  try {
    await ensureAdoptionPlatformSchema(database);
    const applicationId = task === "intake_summarizer" ? String(request.body?.applicationId || "") : null;
    if (task === "intake_summarizer") {
      if (!isUuid(applicationId)) return response.status(422).json({ error: "Choose a valid application before consenting to its AI summary." });
      const application = await database`
        SELECT id FROM adoption_applications WHERE id = ${applicationId} AND clerk_user_id = ${user.id} LIMIT 1
      `;
      if (!application[0]) return response.status(404).json({ error: "That application is not available to your account." });
    }
    const rows = await database`
      INSERT INTO ai_task_consents (clerk_user_id, application_id, task, field_categories, version)
      VALUES (${user.id}, ${applicationId}, ${task}, ${JSON.stringify(CATEGORIES[task])}, ${`${task}-v1`})
      ON CONFLICT (application_id, task) WHERE application_id IS NOT NULL DO UPDATE SET
        field_categories = EXCLUDED.field_categories, version = EXCLUDED.version, created_at = now()
      RETURNING id, task, application_id, field_categories, version, created_at
    `;
    return response.status(201).json({ consent: rows[0] });
  } catch (error) {
    console.error("AI consent storage failed", error.message);
    return response.status(503).json({ error: "AI consent storage is temporarily unavailable." });
  }
}

export { CATEGORIES };
