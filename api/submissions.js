import crypto from "node:crypto";
import { getDatabase } from "./_db.js";

const clean = (value, max = 240) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const validEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const validHttpUrl = (value) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (!request.headers["content-type"]?.includes("application/json")) {
    return response.status(415).json({ error: "Send the submission as JSON." });
  }

  const database = getDatabase();
  if (!database) {
    return response.status(503).json({
      error: "Submissions are temporarily unavailable while the community database is being connected.",
    });
  }

  const body = request.body || {};
  if (body.website) {
    return response.status(202).json({ message: "Submission received for review." });
  }

  const pet = {
    name: clean(body.name, 100),
    species: clean(body.species, 10),
    breed: clean(body.breed, 120),
    age: clean(body.age, 60),
    city: clean(body.city, 120),
    country: clean(body.country, 120),
    shelter: clean(body.shelter, 160),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 50),
    description: clean(body.description, 2000),
    imageUrl: clean(body.imageUrl, 1000),
    sourceUrl: clean(body.sourceUrl, 1000),
  };

  const missing = ["name", "breed", "city", "country", "shelter", "email"].filter(
    (field) => !pet[field],
  );
  if (missing.length) {
    return response.status(400).json({ error: `Missing: ${missing.join(", ")}.` });
  }
  if (!["Dog", "Cat"].includes(pet.species)) {
    return response.status(400).json({ error: "Species must be Dog or Cat." });
  }
  if (!validEmail(pet.email)) {
    return response.status(400).json({ error: "Enter a valid contact email." });
  }
  if (!validHttpUrl(pet.imageUrl) || !validHttpUrl(pet.sourceUrl)) {
    return response.status(400).json({ error: "Links must use http or https." });
  }

  const fingerprint = crypto
    .createHash("sha256")
    .update(
      ["community", pet.email, pet.name, pet.species, pet.city, pet.country]
        .map((value) => value.toLowerCase())
        .join("|"),
    )
    .digest("hex");

  try {
    const rows = await database`
      INSERT INTO pets (
        fingerprint, name, species, breed, age, description, city, country,
        shelter, contact_email, contact_phone, image_url, source_url,
        submitted_by_email, status
      ) VALUES (
        ${fingerprint}, ${pet.name}, ${pet.species}, ${pet.breed}, ${pet.age || null},
        ${pet.description || null}, ${pet.city}, ${pet.country}, ${pet.shelter},
        ${pet.email}, ${pet.phone || null}, ${pet.imageUrl || null},
        ${pet.sourceUrl || null}, ${pet.email}, 'pending'
      )
      ON CONFLICT (fingerprint) DO UPDATE SET
        breed = EXCLUDED.breed,
        age = EXCLUDED.age,
        description = EXCLUDED.description,
        shelter = EXCLUDED.shelter,
        contact_phone = EXCLUDED.contact_phone,
        image_url = EXCLUDED.image_url,
        source_url = EXCLUDED.source_url,
        updated_at = now()
      RETURNING id
    `;
    response.setHeader("Cache-Control", "no-store");
    return response.status(202).json({
      id: rows[0].id,
      message: "Thank you — your pet was submitted for review.",
    });
  } catch (error) {
    console.error("Pet submission failed", error);
    return response.status(500).json({ error: "We could not save the submission. Please try again." });
  }
}
