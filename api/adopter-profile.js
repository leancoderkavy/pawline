import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { consumeUsage } from "./_usage-limit.js";
import { ensureAdoptionPlatformSchema } from "./_adoption-platform.js";

const OPTIONS = {
  species: ["Either", "Dog", "Cat"],
  home: ["", "Apartment or condo", "House", "Townhome or duplex", "Other"],
  energy: ["", "Calm", "Balanced", "Active"],
  kids: ["", "Yes", "No"],
  pets: ["", "None", "Dogs", "Cats", "Dogs and cats"],
  alone: ["", "Rarely", "Sometimes", "Often"],
  experience: ["", "First-time adopter", "Some experience", "Very experienced"],
  distance: ["25", "50", "100"],
};

const cleanText = (value, limit) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit)
  : "";

export function normalizeAdopterProfileInput(input = {}) {
  const preferences = Object.fromEntries(Object.entries(OPTIONS).map(([key, values]) => {
    const value = typeof input.preferences?.[key] === "string" ? input.preferences[key].trim() : "";
    return [key, values.includes(value) ? value : values[0]];
  }));
  const collaboratorNames = Array.isArray(input.household?.collaborators)
    ? input.household.collaborators.map(item => cleanText(item, 80)).filter(Boolean).slice(0, 4)
    : [];
  return {
    preferences,
    household: {
      name: cleanText(input.household?.name, 80),
      collaborators: [...new Set(collaboratorNames)],
      accessibility: cleanText(input.household?.accessibility, 160),
    },
    consent: { profileVersion: "adopter-profile-v1" },
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "PUT"].includes(request.method)) {
    response.setHeader("Allow", "GET, PUT");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Adopter profiles are temporarily unavailable." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  try { await ensureAdoptionPlatformSchema(database); } catch (error) {
    return response.status(error.statusCode || 503).json({ error: error.message });
  }
  if (request.method === "GET") {
    const rows = await database`
      SELECT preferences, household, consent, updated_at
      FROM adopter_profiles WHERE clerk_user_id = ${user.id} LIMIT 1
    `;
    return response.status(200).json({ profile: rows[0] || null });
  }
  const profile = normalizeAdopterProfileInput(request.body || {});
  try {
    const allowed = await consumeUsage(database, {
      scope: "adopter_profile_user_hour", subject: user.id, limit: 30, windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return response.status(429).json({ error: "Profile update limit reached. Try again later." });
  } catch {
    return response.status(503).json({ error: "Profile safety checks are temporarily unavailable." });
  }
  const rows = await database`
    INSERT INTO adopter_profiles (clerk_user_id, preferences, household, consent)
    VALUES (${user.id}, ${JSON.stringify(profile.preferences)}, ${JSON.stringify(profile.household)}, ${JSON.stringify(profile.consent)})
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      preferences = EXCLUDED.preferences, household = EXCLUDED.household,
      consent = EXCLUDED.consent, updated_at = now()
    RETURNING preferences, household, consent, updated_at
  `;
  return response.status(200).json({ profile: rows[0] });
}
