import { generateText } from "ai";

const MODEL = process.env.PAWLINE_AI_MODEL || "google/gemini-2.5-flash-lite";
const MAX_PETS = 10;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8;
const buckets = new Map();

const ANSWER_OPTIONS = {
  home: ["Apartment or condo", "House", "Townhome or duplex", "Other"],
  energy: ["Calm", "Balanced", "Active"],
  kids: ["Yes", "No"],
  pets: ["None", "Dogs", "Cats", "Dogs and cats"],
  alone: ["Rarely", "Sometimes", "Often"],
  experience: ["First-time adopter", "Some experience", "Very experienced"],
  species: ["Either", "Dog", "Cat"],
};

function text(value, limit) {
  const result = String(value || "").trim();
  return result ? result.slice(0, limit) : null;
}

function clientKey(request) {
  return String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function rateLimited(request) {
  const now = Date.now();
  const key = clientKey(request);
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

export function validateMatchRequest(body) {
  if (!body || body.consentToAiProcessing !== true) {
    return { error: "Consent is required before AI analysis." };
  }
  const answers = {};
  for (const [key, options] of Object.entries(ANSWER_OPTIONS)) {
    if (!options.includes(body.answers?.[key])) {
      return { error: `Invalid ${key} answer.` };
    }
    answers[key] = body.answers[key];
  }
  if (!Array.isArray(body.pets) || body.pets.length < 1 || body.pets.length > MAX_PETS) {
    return { error: `Provide between 1 and ${MAX_PETS} current pet listings.` };
  }
  const pets = body.pets.map((pet) => ({
    id: text(pet.id, 120),
    name: text(pet.name, 100),
    species: text(pet.species, 20),
    breed: text(pet.breed, 120),
    age: text(pet.age, 80),
    sex: text(pet.sex, 40),
    size: text(pet.size, 40),
    description: text(pet.description, 1200),
    city: text(pet.city, 160),
    shelter: text(pet.shelter, 160),
  }));
  if (pets.some((pet) => !pet.id || !pet.name || !["Dog", "Cat"].includes(pet.species))) {
    return { error: "Each listing needs a valid id, name, and species." };
  }
  return { value: { answers, pets } };
}

export function validateModelResult(payload, petIds) {
  if (!payload || !Array.isArray(payload.matches) || payload.matches.length < 1) {
    throw new Error("AI response did not contain matches.");
  }
  const known = new Set(petIds);
  const seen = new Set();
  const matches = payload.matches.map((match) => {
    const petId = text(match.petId, 120);
    const score = Number(match.score);
    const reasons = Array.isArray(match.reasons)
      ? match.reasons.map((item) => text(item, 240)).filter(Boolean).slice(0, 3)
      : [];
    const considerations = Array.isArray(match.considerations)
      ? match.considerations.map((item) => text(item, 240)).filter(Boolean).slice(0, 2)
      : [];
    const questions = Array.isArray(match.questions)
      ? match.questions.map((item) => text(item, 240)).filter(Boolean).slice(0, 3)
      : [];
    if (!known.has(petId) || seen.has(petId) || !Number.isInteger(score) ||
        score < 1 || score > 95 || !reasons.length || !questions.length) {
      throw new Error("AI response failed validation.");
    }
    seen.add(petId);
    return { petId, score, reasons, considerations, questions };
  });
  return matches;
}

function extractJson(content) {
  const raw = String(content || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  return JSON.parse(raw);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (rateLimited(request)) {
    return response.status(429).json({ error: "AI match limit reached. Try again later." });
  }
  const validated = validateMatchRequest(request.body);
  if (validated.error) return response.status(422).json({ error: validated.error });
  if (!process.env.VERCEL && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return response.status(503).json({ error: "AI matching is not configured." });
  }

  const { answers, pets } = validated.value;
  const system = [
    "You are Pawline's cautious pet-adoption compatibility assistant.",
    "Use only the supplied public listing facts and adopter answers.",
    "Do not infer temperament, health, safety, or child/animal compatibility when absent.",
    "Unknown facts must become questions for the shelter.",
    "Never guarantee a match or make an adoption decision.",
    "Return JSON only: {\"matches\":[{\"petId\":\"id\",\"score\":1-95,\"reasons\":[\"...\"],\"considerations\":[\"...\"],\"questions\":[\"...\"]}]}",
    "Return every supplied pet exactly once, ordered best fit first.",
  ].join(" ");

  try {
    const result = await generateText({
      model: MODEL,
      system,
      prompt: JSON.stringify({ adopterAnswers: answers, currentListings: pets }),
      temperature: 0.1,
      maxOutputTokens: 1800,
      abortSignal: AbortSignal.timeout(20000),
    });
    const matches = validateModelResult(extractJson(result.text), pets.map((pet) => pet.id));
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({
      mode: "ai",
      model: MODEL,
      matches,
      boundary: "AI suggestions are a starting point; confirm compatibility and availability with the shelter.",
    });
  } catch (error) {
    console.error("AI match analysis failed", error.message);
    return response.status(502).json({ error: "AI matching is temporarily unavailable." });
  }
}
