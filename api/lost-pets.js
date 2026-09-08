import { getDatabase } from "./_db.js";
import { PET_SPECIES } from "../config/species.js";
import {
  privateHandler,
  requiredText,
  networkError,
  uuid,
} from "./_network.js";
export function validateLostReport(body, now = new Date()) {
  if (
    !["lost", "found"].includes(body.kind) ||
    !PET_SPECIES.includes(body.species)
  )
    throw networkError("Choose a report type and species.");
  const name = requiredText(body.name, 1, 100, "a pet name or description");
  const description = requiredText(body.description, 10, 2000, "a description");
  const city = requiredText(body.city, 1, 120, "a city or neighborhood");
  if (
    /@|https?:\/\/|\b\d[\d ().+-]{7,}\d\b/i.test(
      `${name} ${description} ${city}`,
    )
  )
    throw networkError(
      "Keep phone numbers, email addresses, and links out of public reports. Use private tips.",
    );
  const date = String(body.eventDate || "");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date > now.toISOString().slice(0, 10)
  )
    throw networkError("Choose a valid date that is not in the future.");
  if (body.publicConsent !== true)
    throw networkError("Confirm the report may be shown publicly.");
  return {
    kind: body.kind,
    species: body.species,
    name,
    description,
    city,
    date,
  };
}
export async function lostReportAction(database, user, request) {
  const body = request.body || {},
    id = body.id || request.query?.id;
  if (request.method === "GET") {
    const reports =
      await database`SELECT id,kind,species,name,description,city,event_date,status FROM lost_pet_reports WHERE clerk_user_id=${user.id} ORDER BY created_at DESC LIMIT 50`;
    const tips =
      await database`SELECT t.id,t.report_id,t.body,t.created_at FROM lost_pet_report_tips t JOIN lost_pet_reports r ON r.id=t.report_id WHERE r.clerk_user_id=${user.id} ORDER BY t.created_at DESC LIMIT 100`;
    return { reports, tips };
  }
  if (request.method === "PATCH") {
    if (!uuid(id) || !["reunited", "closed"].includes(body.status))
      throw networkError("Choose a report and outcome.");
    const rows =
      await database`UPDATE lost_pet_reports SET status=${body.status},updated_at=now() WHERE id=${id} AND clerk_user_id=${user.id} RETURNING id`;
    if (!rows[0]) throw networkError("Report not found.", 404);
    return { updated: true };
  }
  if (body.action === "flag") {
    if (!uuid(id)) throw networkError("Choose a report.");
    await database`INSERT INTO lost_pet_report_flags (report_id,clerk_user_id) SELECT id,${user.id} FROM lost_pet_reports WHERE id=${id} AND clerk_user_id<>${user.id} ON CONFLICT DO NOTHING`;
    return { reported: true };
  }
  if (body.action === "tip") {
    if (!uuid(id)) throw networkError("Choose a report.");
    const text = requiredText(body.body, 10, 1000, "a private tip");
    const rows =
      await database`INSERT INTO lost_pet_report_tips (report_id,sender_id,body) SELECT id,${user.id},${text} FROM lost_pet_reports WHERE id=${id} AND status='open' AND clerk_user_id<>${user.id} RETURNING id`;
    if (!rows[0]) throw networkError("This report cannot receive a tip.", 409);
    return { sent: true };
  }
  const r = validateLostReport(body);
  const rows =
    await database`INSERT INTO lost_pet_reports (clerk_user_id,kind,species,name,description,city,event_date) VALUES (${user.id},${r.kind},${r.species},${r.name},${r.description},${r.city},${r.date}) RETURNING id`;
  return { report: rows[0] };
}
export function createLostPetsHandler(dependencies = {}) {
  const privateRoute = privateHandler(
    ["GET", "POST", "PATCH"],
    lostReportAction,
    dependencies,
  );
  return async function handler(request, response) {
    if (request.method !== "GET" || request.query?.mine === "true")
      return privateRoute(request, response);
    response.setHeader("Cache-Control", "public, s-maxage=30");
    const database = (dependencies.getDatabase || getDatabase)();
    if (!database)
      return response.status(503).json({ error: "Reports are unavailable." });
    try {
      const city = String(request.query?.city || "")
        .trim()
        .slice(0, 120);
      const reports =
        await database`SELECT id,kind,species,name,description,city,event_date,created_at FROM lost_pet_reports r WHERE status='open' AND created_at > now()-interval '90 days' AND (SELECT count(*) FROM lost_pet_report_flags f WHERE f.report_id=r.id)<3 AND (${city}='' OR strpos(lower(city),lower(${city}))>0) ORDER BY created_at DESC LIMIT 100`;
      return response.status(200).json({
        reports,
        note: "Community reports are not proof of ownership. Verify ownership privately before returning an animal.",
      });
    } catch {
      return response
        .status(503)
        .json({ error: "Reports are temporarily unavailable." });
    }
  };
}
export default createLostPetsHandler();
