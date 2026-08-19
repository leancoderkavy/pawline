import crypto from "node:crypto";
import { requireUser } from "./_auth.js";
import { getDatabase } from "./_db.js";
import { ensureAdoptionPlatformSchema, recordAiRun } from "./_adoption-platform.js";
import { generateOpenRouterObject, reserveOpenRouterTask } from "./_openrouter.js";
import {
  buildApplicationCoachRequest,
  containsDirectContactDetails,
  validateApplicationCoachSuggestion,
} from "../src/adopterJourney.js";

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestion", "explanation", "missingDetails"],
  properties: {
    suggestion: { type: "string", minLength: 1, maxLength: 1600 },
    explanation: { type: "string", minLength: 1, maxLength: 600 },
    missingDetails: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 180 },
    },
  },
};

function includesUserIdentity(value, user) {
  const text = String(value || "").toLocaleLowerCase();
  const fullName = String(user?.displayName || "").trim().toLocaleLowerCase();
  const email = String(user?.email || "").trim().toLocaleLowerCase();
  if (email && text.includes(email)) return true;
  if (fullName.length >= 5 && text.includes(fullName)) return true;
  const nameParts = fullName.split(/\s+/).filter(part => part.length >= 4);
  return nameParts.some(part => text.includes(part));
}

export function validateApplicationCoachServerRequest(body, user) {
  const prepared = buildApplicationCoachRequest(body);
  if (prepared.error) return prepared;
  if (containsDirectContactDetails(prepared.value.answer) || includesUserIdentity(prepared.value.answer, user)) {
    return { error: "Remove contact details or identifying names before using the AI helper." };
  }
  return prepared;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  const prepared = validateApplicationCoachServerRequest(request.body, user);
  if (prepared.error) return response.status(422).json({ error: prepared.error });

  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "The application helper is unavailable while private safety controls are offline." });
  try {
    await ensureAdoptionPlatformSchema(database);
    const reservation = await reserveOpenRouterTask(database, { task: "application_coach", subject: user.id });
    if (!reservation.allowed) return response.status(429).json({ error: "Application helper limit reached. You can keep editing your answer manually." });
  } catch {
    return response.status(503).json({ error: "The application helper safety controls are temporarily unavailable." });
  }

  const requestId = crypto.randomUUID();
  try {
    await database`
      INSERT INTO ai_task_consents (clerk_user_id, task, field_categories, version)
      VALUES (${user.id}, 'application_coach', ${JSON.stringify(["single_answer", "question_context"])}, 'application-coach-v1')
    `;
  } catch {
    return response.status(503).json({ error: "The application helper cannot record your consent right now. You can keep editing manually." });
  }

  try {
    const result = await generateOpenRouterObject({
      task: "application_coach",
      system: [
        "You are Pawline's careful application-writing assistant.",
        "Use only the single answer supplied by the adopter; do not invent experience, qualifications, or facts.",
        "Do not estimate approval, rank applicants, encourage bypassing requirements, or make an adoption decision.",
        "Return a clearer factual revision, a brief explanation, and missing details as questions—not assumptions.",
      ].join(" "),
      prompt: JSON.stringify({ question: prepared.value.question, answer: prepared.value.answer }),
      schema: outputSchema,
      validate: validateApplicationCoachSuggestion,
      maxOutputTokens: 700,
      requestId,
    });
    const suggestion = validateApplicationCoachSuggestion(result?.output || result);
    if (!suggestion) throw new Error("Invalid structured application-coach response.");
    await recordAiRun(database, result.metadata, { clerkUserId: user.id, status: "succeeded" });
    return response.status(200).json({
      suggestion,
      disclosure: "AI-assisted suggestion. Review and edit it before using it; Pawline has not submitted anything.",
      sourceFields: ["question", "answer"],
    });
  } catch (error) {
    await recordAiRun(database, {
      task: "application_coach", requestId, promptVersion: "application-coach-v1", schemaVersion: "application-coach-output-v1",
    }, { clerkUserId: user.id, status: "failed" }).catch(() => {});
    console.error("Application coach failed", error.message);
    return response.status(503).json({ error: "The application helper is unavailable. You can keep editing your answer manually." });
  }
}
