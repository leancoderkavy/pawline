import { runLegacyHandler } from "../_adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = {
  "community-leads": () => import("../../../api/community-leads"),
  "community-parse-link": () => import("../../../api/community-parse-link"),
  "community-report": () => import("../../../api/community-report"),
  "direct-conversations": () => import("../../../api/direct-conversations"),
  "direct-messages": () => import("../../../api/direct-messages"),
  "direct-message-report": () => import("../../../api/direct-message-report"),
  "cron/discover": () => import("../../../api/cron/discover"),
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
  "pet-media": () => import("../../../api/pet-media"),
  pets: () => import("../../../api/pets"),
  sources: () => import("../../../api/sources"),
  "seo-pipeline": () => import("../../../api/seo-pipeline"),
  "shelter-outreach": () => import("../../../api/shelter-outreach"),
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
