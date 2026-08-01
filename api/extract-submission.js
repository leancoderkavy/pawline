import { generateText, jsonSchema, Output } from "ai";
import { requireUser } from "./_auth.js";
import { getDatabase } from "./_db.js";
import { consumeUsage } from "./_usage-limit.js";

const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const MAX_FILES = 8;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const buckets = new Map();
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

const extractionSchema = jsonSchema({
  type: "object",
  additionalProperties: false,
  required: ["fields"],
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      required: [
        "name", "species", "breed", "age", "sex", "spayedNeutered",
        "rabiesStatus", "vaccinationStatus", "microchipStatus", "microchipId",
        "medicalNotes", "behaviorNotes", "biteHistory", "description",
      ],
      properties: {
        name: { type: "string" },
        species: { type: "string", enum: ["", "Dog", "Cat"] },
        breed: { type: "string" },
        age: { type: "string" },
        sex: { type: "string", enum: ["", "Unknown", "Female", "Male"] },
        spayedNeutered: { type: "string", enum: ["", "Unknown", "Yes", "No"] },
        rabiesStatus: { type: "string", enum: ["", "Unknown", "Yes", "No"] },
        vaccinationStatus: { type: "string", enum: ["", "Unknown", "Yes", "No"] },
        microchipStatus: { type: "string", enum: ["", "Unknown", "Yes", "No"] },
        microchipId: { type: "string" },
        medicalNotes: { type: "string" },
        behaviorNotes: { type: "string" },
        biteHistory: { type: "string", enum: ["", "Unknown", "Yes", "No"] },
        description: { type: "string" },
      },
    },
  },
});

function parseDataUrl(file) {
  if (!file || !ALLOWED_TYPES.has(file.type) || typeof file.data !== "string") {
    throw new Error("Unsupported attachment.");
  }
  const prefix = `data:${file.type};base64,`;
  if (!file.data.startsWith(prefix)) throw new Error("Invalid attachment encoding.");
  const data = Buffer.from(file.data.slice(prefix.length), "base64");
  if (!data.length || data.length !== Number(file.size)) throw new Error("Attachment size mismatch.");
  return data;
}

function rateLimited(request) {
  const key = String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    return response.status(415).json({ error: "Send files as JSON." });
  }

  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }

  const files = Array.isArray(request.body?.files) ? request.body.files : [];
  if (!files.length) return response.status(400).json({ error: "Add at least one file." });
  if (files.length > MAX_FILES) return response.status(413).json({ error: `Add no more than ${MAX_FILES} files.` });
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Document extraction safety checks are unavailable." });
  try {
    const allowed = await consumeUsage(database, {
      scope: "document_extraction_user", subject: user.id, limit: MAX_REQUESTS_PER_WINDOW, windowMs: WINDOW_MS,
    });
    if (!allowed || rateLimited(request)) {
      return response.status(429).json({ error: "Document extraction limit reached. Enter details manually or try again later." });
    }
  } catch {
    return response.status(503).json({ error: "Document extraction safety checks are unavailable." });
  }

  try {
    const parsed = files.map(file => ({ ...file, buffer: parseDataUrl(file) }));
    if (parsed.reduce((sum, file) => sum + file.buffer.length, 0) > MAX_TOTAL_BYTES) {
      return response.status(413).json({ error: "Attachments must total 3 MB or less." });
    }

    const { output, totalUsage, response: modelResponse } = await generateText({
      model: "google/gemini-2.5-flash-lite",
      output: Output.object({
        schema: extractionSchema,
        name: "pet_record_extraction",
        description: "Facts directly supported by uploaded pet records.",
      }),
      system: `Extract only facts explicitly supported by the supplied pet records.
Never guess. Use empty strings when the records do not establish a value.
For Yes/No disclosure fields, use Unknown unless the record directly establishes the answer.
Do not treat a photo as proof of breed, sex, age, sterilization, vaccination, temperament, or health.
Do not include owner addresses, financial data, passwords, or unrelated personal information.
Summarize clinical facts without diagnosing. Keep the public description factual and under 700 characters.`,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Prepare an editable Pawline listing draft from these files." },
          ...parsed.map(file => ({
            type: "file",
            data: file.buffer,
            mediaType: file.type,
            filename: String(file.name || "attachment").slice(0, 160),
          })),
        ],
      }],
      include: { requestBody: false, responseBody: false },
      timeout: { totalMs: 45000 },
    });

    return response.status(200).json({
      fields: output.fields,
      extraction: {
        model: modelResponse?.modelId || "google/gemini-2.5-flash-lite",
        inputTokens: totalUsage?.inputTokens || null,
        outputTokens: totalUsage?.outputTokens || null,
      },
    });
  } catch (error) {
    console.error("Pet record extraction failed", error);
    return response.status(502).json({
      error: "We could not read those records. Remove damaged files or enter the details manually.",
    });
  }
}
