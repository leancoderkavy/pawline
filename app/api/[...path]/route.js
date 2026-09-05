import { runLegacyHandler } from "../_adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = {
  "adopter-profile": () => import("../../../api/adopter-profile"),
  "adoption-applications": () => import("../../../api/adoption-applications"),
  "adoption-application-messages": () => import("../../../api/adoption-application-messages"),
  "adoption-checkins": () => import("../../../api/adoption-checkins"),
  "adoption-outcomes": () => import("../../../api/adoption-outcomes"),
  "application-coach": () => import("../../../api/application-coach"),
  "ai-intake-summary": () => import("../../../api/ai-intake-summary"),
  "ai-consents": () => import("../../../api/ai-consents"),
  "community-leads": () => import("../../../api/community-leads"),
  "community-parse-link": () => import("../../../api/community-parse-link"),
  "community-report": () => import("../../../api/community-report"),
  "direct-conversations": () => import("../../../api/direct-conversations"),
  "direct-messages": () => import("../../../api/direct-messages"),
  "direct-message-report": () => import("../../../api/direct-message-report"),
  "direct-video": () => import("../../../api/direct-video"),
  "cron/purge-video-signals": () => import("../../../api/cron/purge-video-signals"),
  "cron/discover": () => import("../../../api/cron/discover"),
  "cron/purge-held-applications": () => import("../../../api/cron/purge-held-applications"),
  "cron/seo-pipeline": () => import("../../../api/cron/seo-pipeline"),
  discoveries: () => import("../../../api/discoveries"),
  events: () => import("../../../api/events"),
  "extract-submission": () => import("../../../api/extract-submission"),
  favorites: () => import("../../../api/favorites"),
  geocode: () => import("../../../api/geocode"),
  health: () => import("../../../api/health"),
  "map-token": () => import("../../../api/map-token"),
  map: () => import("../../../api/map"),
  matches: () => import("../../../api/matches"),
  "nearby-shelters": () => import("../../../api/nearby-shelters"),
  "organization-claim": () => import("../../../api/organization-claim"),
  "organization-reviews": () => import("../../../api/organization-reviews"),
  organizations: () => import("../../../api/organizations"),
  caregivers: () => import("../../../api/caregivers"),
  "caregiver-pets": () => import("../../../api/caregiver-pets"),
  "pet-media": () => import("../../../api/pet-media"),
  pets: () => import("../../../api/pets"),
  sources: () => import("../../../api/sources"),
  "seo-pipeline": () => import("../../../api/seo-pipeline"),
  "shelter-outreach": () => import("../../../api/shelter-outreach"),
  "shelter-applications": () => import("../../../api/shelter-applications"),
  submissions: () => import("../../../api/submissions"),
};

async function dispatch(nextRequest, context) {
  const { path = [] } = await context.params;
  const key = path.join("/");
  const loadHandler = handlers[key];
  if (!loadHandler) return Response.json({ error: "API route not found" }, { status: 404 });
  const { default: handler } = await loadHandler();
  return runLegacyHandler(handler, nextRequest);
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
