import crypto from "node:crypto";
import { getDatabase } from "./_db.js";
import { notificationStatus, notifySubmission } from "./_email.js";
import { requireUser } from "./_auth.js";
import { consumeUsageChain } from "./_usage-limit.js";
import { isUuid, organizationMembership } from "./_adoption-platform.js";

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
const MAX_FILES = 8;
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
  const rows = await database`
    SELECT count(*)::integer AS column_count
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pets'
      AND column_name IN ('claimed_by_clerk_user_id', 'claimed_by_display_name', 'claimed_at')
  `;
  if (Number(rows[0]?.column_count) !== 3) throw new Error("Listing ownership migration is missing.");
}

export function normalizeExtractionMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const boundedInteger = (input) => Number.isInteger(Number(input))
    ? Math.min(Math.max(Number(input), 0), 10_000_000)
    : null;
  const model = typeof value.model === "string" ? value.model.trim().slice(0, 160) : "";
  return model ? {
    model,
    inputTokens: boundedInteger(value.inputTokens),
    outputTokens: boundedInteger(value.outputTokens),
  } : null;
}

async function ensureSubmissionStorage(database) {
  const storageRows = await database`
    SELECT
      to_regclass('public.pet_submission_files') AS submission_files,
      to_regclass('public.pet_submission_log') AS submission_log
  `;
  if (submissionStorageReady(storageRows[0])) return;
  throw new Error("Submission storage migration is missing.");
}

export function createSubmissionsHandler(dependencies = {}) {
  return (request, response) => handleSubmission(request, response, dependencies);
}

async function handleSubmission(request, response, dependencies) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (!request.headers["content-type"]?.includes("application/json")) {
    return response.status(415).json({ error: "Send the submission as JSON." });
  }

  const database = (dependencies.getDatabase || getDatabase)();
  if (!database) {
    return response.status(503).json({
      error: "Submissions are temporarily unavailable while the community database is being connected.",
    });
  }

  let user;
  try {
    user = await (dependencies.authenticate || requireUser)(request);
  } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }

  const body = request.body || {};
  const organizationId = body.organizationId || null;
  let organization = null;
  if (organizationId) {
    try {
      if (!isUuid(organizationId)) return response.status(422).json({ error: "Choose a registered shelter, rescue, or foster profile." });
      await organizationMembership(database, organizationId, user.id, "administrator");
      [organization] = await database`SELECT name FROM organizations WHERE id = ${organizationId}`;
    } catch (error) {
      return response.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : "Your caregiver profile could not be checked." });
    }
  }
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
    shelter: organization?.name || clean(body.shelter, 160),
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
  if (body.authorityConfirmed !== true || body.disclosureConfirmed !== true || body.localLawConfirmed !== true) {
    return response.status(400).json({ error: "Confirm all required attestations." });
  }
  try {
    const reservation = await consumeUsageChain(database, [
      { scope: "pet_submission_user", subject: user.id, limit: organization ? 20 : 3, windowMs: 60 * 60 * 1000 },
      ...(organization ? [{ scope: "pet_submission_organization", subject: organizationId, limit: 50, windowMs: 24 * 60 * 60 * 1000 }] : []),
      { scope: "pet_submission_recipient", subject: pet.email, limit: organization ? 50 : 3, windowMs: 24 * 60 * 60 * 1000 },
    ]);
    if (!reservation.allowed) {
      return response.status(429).json({ error: "Submission limit reached. Try again later or contact Pawline support." });
    }
  } catch {
    return response.status(503).json({ error: "Submission safety checks are temporarily unavailable." });
  }
  let files;
  try {
    const rawFiles = Array.isArray(body.files) ? body.files : [];
    if (rawFiles.length > MAX_FILES) return response.status(413).json({ error: `Add no more than ${MAX_FILES} files.` });
    files = rawFiles.map(parseFile);
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
        submitted_by_email, organization_id, claimed_by_clerk_user_id, claimed_by_display_name, claimed_at, status, raw_payload
      ) SELECT
        ${fingerprint}, ${pet.name}, ${pet.species}, ${pet.breed}, ${pet.age || null},
        ${pet.sex || null}, ${pet.size || null}, ${pet.description || null}, ${pet.city}, ${pet.country},
        ${pet.postalCode}, ${pet.shelter},
        ${pet.email}, ${pet.phone || null}, ${pet.imageUrl || null},
        ${pet.sourceUrl || null}, ${pet.email}, ${organizationId}, ${user.id}, ${user.displayName}, now(), 'pending', ${JSON.stringify({
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
          extraction: normalizeExtractionMeta(body.extractionMeta),
        })}
      WHERE (${organizationId}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM organization_memberships WHERE organization_id = ${organizationId}::uuid
          AND clerk_user_id = ${user.id} AND role = 'administrator'
      ))
      ON CONFLICT (fingerprint) DO UPDATE SET
        breed = EXCLUDED.breed,
        age = EXCLUDED.age,
        description = EXCLUDED.description,
        shelter = EXCLUDED.shelter,
        contact_phone = EXCLUDED.contact_phone,
        image_url = EXCLUDED.image_url,
        source_url = EXCLUDED.source_url,
        status = 'pending',
        verified_at = NULL,
        claimed_by_clerk_user_id = EXCLUDED.claimed_by_clerk_user_id,
        claimed_by_display_name = EXCLUDED.claimed_by_display_name,
        claimed_at = EXCLUDED.claimed_at,
        updated_at = now()
      WHERE pets.claimed_by_clerk_user_id = EXCLUDED.claimed_by_clerk_user_id
        AND pets.organization_id IS NOT DISTINCT FROM EXCLUDED.organization_id
        AND pets.source_id IS NULL
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
    const extractionMeta = normalizeExtractionMeta(body.extractionMeta);
    if (extractionMeta) {
      await database`
        INSERT INTO pet_submission_log (pet_id, event_type, event_data)
        VALUES (${rows[0].id}, 'ai_extracted', ${JSON.stringify(extractionMeta)})
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
    const notification = await (dependencies.notifySubmission || notifySubmission)({ id: rows[0].id, pet, acknowledgementEmail: user.email });
    return response.status(202).json({
      id: rows[0].id,
      message: "Thank you — your pet was submitted for review. After approval, you can answer adoption questions in Messages.",
      notification: notificationStatus(notification),
    });
  } catch (error) {
    console.error("Pet submission failed", error);
    return response.status(500).json({ error: "We could not save the submission. Please try again." });
  }
}
export default createSubmissionsHandler();
