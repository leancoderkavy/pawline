import { createHash } from "node:crypto";
import { organizationMembership } from "./_adoption-platform.js";
import { canonicalPetSpecies } from "../config/species.js";
import { safeHttpUrl, safeImageUrl } from "./_safe-url.js";
import {
  privateHandler,
  requiredText,
  networkError,
  uuid,
} from "./_network.js";

export function parsePetCsv(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 200000)
    throw networkError("Use a CSV file smaller than 200 KB.");
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || !field) quoted = !quoted;
      else throw networkError("Unexpected quote in CSV.");
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw networkError("A quoted CSV field is not closed.");
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  const headers = (rows.shift() || []).map((cell) =>
    cell
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase(),
  );
  if (
    !["external_id", "name", "species"].every((key) => headers.includes(key)) ||
    new Set(headers).size !== headers.length
  )
    throw networkError(
      "CSV needs unique external_id, name, and species columns.",
    );
  if (!rows.length || rows.length > 200)
    throw networkError("Import between 1 and 200 pets at a time.");
  const ids = new Set(),
    pets = [],
    errors = [];
  rows.forEach((cells, index) => {
    try {
      if (cells.length !== headers.length)
        throw networkError("Column count does not match header.");
      const r = Object.fromEntries(
        headers.map((key, i) => [key, cells[i].trim()]),
      );
      const id = requiredText(r.external_id, 1, 120, "a shelter animal ID"),
        name = requiredText(r.name, 1, 100, "a pet name"),
        species = canonicalPetSpecies(r.species);
      if (!species) throw networkError("Unsupported species.");
      if (ids.has(id)) throw networkError("Duplicate shelter animal ID.");
      ids.add(id);
      if (r.image_url && !safeImageUrl(r.image_url))
        throw networkError("Invalid image URL.");
      if (r.source_url && !safeHttpUrl(r.source_url))
        throw networkError("Invalid source URL.");
      pets.push({
        externalId: id,
        name,
        species,
        breed: r.breed?.slice(0, 160) || null,
        description: r.description?.slice(0, 4000) || null,
        image: safeImageUrl(r.image_url),
        sourceUrl: safeHttpUrl(r.source_url),
      });
    } catch (error) {
      errors.push({ row: index + 2, error: error.message });
    }
  });
  return { pets, errors };
}
export async function shelterImportAction(database, user, request) {
  const body = request.body || {};
  if (!uuid(body.organizationId))
    throw networkError("Choose your organization.");
  await organizationMembership(
    database,
    body.organizationId,
    user.id,
    "administrator",
  );
  const [organization] =
    await database`SELECT name FROM organizations WHERE id=${body.organizationId}`;
  if (!organization) throw networkError("Organization not found.", 404);
  const preview = parsePetCsv(body.csv);
  if (body.action !== "import") return { ...preview, pendingReview: true };
  if (body.authorityConfirmed !== true || preview.errors.length)
    throw networkError("Confirm authority and fix every row before importing.");
  const statements = preview.pets.map((pet) => {
    const fingerprint = createHash("sha256")
      .update(`shelter-import:${body.organizationId}:${pet.externalId}`)
      .digest("hex");
    return database`INSERT INTO pets (fingerprint,external_id,organization_id,claimed_by_clerk_user_id,claimed_by_display_name,claimed_at,name,species,breed,description,shelter,image_url,source_url,status)
      VALUES (${fingerprint},${pet.externalId},${body.organizationId},${user.id},${user.displayName},now(),${pet.name},${pet.species},${pet.breed},${pet.description},${organization.name},${pet.image},${pet.sourceUrl},'pending')
      ON CONFLICT (fingerprint) DO UPDATE SET name=EXCLUDED.name,species=EXCLUDED.species,breed=EXCLUDED.breed,description=EXCLUDED.description,image_url=EXCLUDED.image_url,source_url=EXCLUDED.source_url,status='pending',verified_at=NULL,updated_at=now()
      WHERE pets.organization_id=${body.organizationId} RETURNING id`;
  });
  await database.transaction(statements);
  return {
    imported: preview.pets.length,
    status: "pending",
    message:
      "Import saved for review. Re-importing the same organization animal IDs updates those records.",
  };
}
export default privateHandler(["POST"], shelterImportAction);
