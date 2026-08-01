import crypto from "node:crypto";
import { getDatabase } from "./_db.js";
import { notifySubmission } from "./_email.js";
import { requireUser } from "./_auth.js";

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
const allowedFileTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"]);
const parseFile = (file) => {
  if (!file || !allowedFileTypes.has(file.type) || typeof file.data !== "string") throw new Error("Unsupported attachment.");
  const prefix = `data:${file.type};base64,`;
  if (!file.data.startsWith(prefix)) throw new Error("Invalid attachment encoding.");
  const bytes = Buffer.from(file.data.slice(prefix.length), "base64");
  if (!bytes.length || bytes.length !== Number(file.size)) throw new Error("Attachment size mismatch.");
  return {
    name: clean(file.name, 160) || "attachment",
    mediaType: file.type,
    size: bytes.length,
    bytes,
    isPhoto: file.type.startsWith("image/"),
  };
};

export function submissionStorageReady(row) {
  return Boolean(row?.submission_files && row?.submission_log);
}

export async function ensureListingOwnership(database) {
  await database`
    ALTER TABLE pets
      ADD COLUMN IF NOT EXISTS claimed_by_clerk_user_id text,
      ADD COLUMN IF NOT EXISTS claimed_by_display_name text,
      ADD COLUMN IF NOT EXISTS claimed_at timestamptz
  `;
}

async function ensureSubmissionStorage(database) {
  const storageRows = await database`
    SELECT
      to_regclass('public.pet_submission_files') AS submission_files,
      to_regclass('public.pet_submission_log') AS submission_log
  `;
  if (submissionStorageReady(storageRows[0])) return;

  await database`
    CREATE TABLE IF NOT EXISTS pet_submission_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      file_name text NOT NULL,
      media_type text NOT NULL,
      byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 3145728),
      content bytea NOT NULL,
      is_primary_photo boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await database`
    CREATE INDEX IF NOT EXISTS pet_submission_files_pet_id
      ON pet_submission_files (pet_id, created_at)
  `;
  await database`
    CREATE TABLE IF NOT EXISTS pet_submission_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      event_type text NOT NULL
        CHECK (event_type IN ('submitted', 'ai_extracted', 'reviewed', 'published', 'rejected')),
      event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await database`
    CREATE INDEX IF NOT EXISTS pet_submission_log_pet_id
      ON pet_submission_log (pet_id, created_at DESC)
  `;

  const verificationRows = await database`
    SELECT
      to_regclass('public.pet_submission_files') AS submission_files,
      to_regclass('public.pet_submission_log') AS submission_log
  `;
  if (!submissionStorageReady(verificationRows[0])) {
    throw new Error("Submission storage migration did not complete.");
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
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

  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
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
    sex: clean(body.sex, 20),
    size: clean(body.size, 40),
    city: clean(body.city, 120),
    region: clean(body.region, 120),
    postalCode: clean(body.postalCode, 24),
    country: clean(body.country, 120),
    shelter: clean(body.shelter, 160),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 50),
    description: clean(body.description, 2000),
    imageUrl: clean(body.imageUrl, 1000),
    sourceUrl: clean(body.sourceUrl, 1000),
    spayedNeutered: clean(body.spayedNeutered, 20),
    rabiesStatus: clean(body.rabiesStatus, 20),
    vaccinationStatus: clean(body.vaccinationStatus, 20),
    microchipStatus: clean(body.microchipStatus, 20),
    microchipId: clean(body.microchipId, 120),
    medicalNotes: clean(body.medicalNotes, 2000),
    behaviorNotes: clean(body.behaviorNotes, 2000),
    biteHistory: clean(body.biteHistory, 20),
    goodWithChildren: clean(body.goodWithChildren, 20),
    goodWithDogs: clean(body.goodWithDogs, 20),
    goodWithCats: clean(body.goodWithCats, 20),
    houseTrained: clean(body.houseTrained, 20),
    rehomingReason: clean(body.rehomingReason, 1000),
    rehomingFee: clean(body.rehomingFee, 80),
  };

  const missing = ["name", "breed", "city", "region", "postalCode", "country", "shelter", "email"].filter(
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
  if (!body.authorityConfirmed || !body.disclosureConfirmed || !body.localLawConfirmed) {
    return response.status(400).json({ error: "Confirm all required attestations." });
  }
  let files;
  try {
    files = (Array.isArray(body.files) ? body.files : []).map(parseFile);
    if (files.reduce((sum, file) => sum + file.size, 0) > 3 * 1024 * 1024) {
      return response.status(413).json({ error: "Attachments must total 3 MB or less." });
    }
  } catch (error) {
    return response.status(400).json({ error: error.message });
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
    await ensureSubmissionStorage(database);
    await ensureListingOwnership(database);
    const rows = await database`
      INSERT INTO pets (
        fingerprint, name, species, breed, age, sex, size, description, city, country,
        postal_code, shelter, contact_email, contact_phone, image_url, source_url,
        submitted_by_email, claimed_by_clerk_user_id, claimed_by_display_name, claimed_at, status, raw_payload
      ) VALUES (
        ${fingerprint}, ${pet.name}, ${pet.species}, ${pet.breed}, ${pet.age || null},
        ${pet.sex || null}, ${pet.size || null}, ${pet.description || null}, ${pet.city}, ${pet.country},
        ${pet.postalCode}, ${pet.shelter},
        ${pet.email}, ${pet.phone || null}, ${pet.imageUrl || null},
        ${pet.sourceUrl || null}, ${pet.email}, ${user.id}, ${user.displayName}, now(), 'pending', ${JSON.stringify({
          region: pet.region,
          disclosures: {
            spayedNeutered: pet.spayedNeutered, rabiesStatus: pet.rabiesStatus,
            vaccinationStatus: pet.vaccinationStatus, microchipStatus: pet.microchipStatus,
            microchipId: pet.microchipId, medicalNotes: pet.medicalNotes,
            behaviorNotes: pet.behaviorNotes, biteHistory: pet.biteHistory,
            goodWithChildren: pet.goodWithChildren, goodWithDogs: pet.goodWithDogs,
            goodWithCats: pet.goodWithCats, houseTrained: pet.houseTrained,
          },
          placement: { rehomingReason: pet.rehomingReason, rehomingFee: pet.rehomingFee },
          attestations: { authority: true, disclosure: true, localLaw: true },
          extraction: body.extractionMeta || null,
        })}
      )
      ON CONFLICT (fingerprint) DO UPDATE SET
        breed = EXCLUDED.breed,
        age = EXCLUDED.age,
        description = EXCLUDED.description,
        shelter = EXCLUDED.shelter,
        contact_phone = EXCLUDED.contact_phone,
        image_url = EXCLUDED.image_url,
        source_url = EXCLUDED.source_url,
        claimed_by_clerk_user_id = EXCLUDED.claimed_by_clerk_user_id,
        claimed_by_display_name = EXCLUDED.claimed_by_display_name,
        claimed_at = EXCLUDED.claimed_at,
        updated_at = now()
      WHERE pets.claimed_by_clerk_user_id IS NULL
        OR pets.claimed_by_clerk_user_id = EXCLUDED.claimed_by_clerk_user_id
      RETURNING id
    `;
    if (!rows[0]) {
      return response.status(409).json({ error: "This pet submission is already linked to another Pawline account." });
    }
    if (files.length) {
      await database.transaction(files.map((file, index) => database`
        INSERT INTO pet_submission_files (
          pet_id, file_name, media_type, byte_size, content, is_primary_photo
        ) VALUES (
          ${rows[0].id}, ${file.name}, ${file.mediaType}, ${file.size}, ${file.bytes},
          ${file.isPhoto && index === files.findIndex(candidate => candidate.isPhoto)}
        )
      `));
      const primaryPhoto = files.find(file => file.isPhoto);
      if (primaryPhoto) {
        await database`
          UPDATE pets SET image_url = ${`/api/pet-media?id=${rows[0].id}`} WHERE id = ${rows[0].id}
        `;
      }
    }
    await database`
      INSERT INTO pet_submission_log (pet_id, event_type, event_data)
      VALUES (${rows[0].id}, 'submitted', ${JSON.stringify({ attachmentCount: files.length, status: "pending" })})
    `;
    if (body.extractionMeta) {
      await database`
        INSERT INTO pet_submission_log (pet_id, event_type, event_data)
        VALUES (${rows[0].id}, 'ai_extracted', ${JSON.stringify(body.extractionMeta)})
      `;
    }
    const isProductionQa =
      pet.email === "qa-listpet@pawline.invalid" &&
      pet.shelter === "Pawline Production QA - delete";
    if (isProductionQa) {
      await database`DELETE FROM pets WHERE id = ${rows[0].id}`;
      response.setHeader("Cache-Control", "no-store");
      return response.status(202).json({
        id: rows[0].id,
        message: "Production submission verification passed and the synthetic record was removed.",
        notification: "skipped_for_qa",
        qaCleanup: true,
      });
    }
    const notification = await notifySubmission({ id: rows[0].id, pet });
    return response.status(202).json({
      id: rows[0].id,
      message: "Thank you — your pet was submitted for review. After approval, you can answer adoption questions in Messages.",
      notification: notification.configured ? "queued" : "not_configured",
    });
  } catch (error) {
    console.error("Pet submission failed", error);
    return response.status(500).json({ error: "We could not save the submission. Please try again." });
  }
}
