export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = {
  "ably-token": () => import("../../../api/ably-token"),
  "community-leads": () => import("../../../api/community-leads"),
  "community-messages": () => import("../../../api/community-messages"),
  "community-parse-link": () => import("../../../api/community-parse-link"),
  "community-report": () => import("../../../api/community-report"),
  "cron/discover": () => import("../../../api/cron/discover"),
  discoveries: () => import("../../../api/discoveries"),
  events: () => import("../../../api/events"),
  "extract-submission": () => import("../../../api/extract-submission"),
  geocode: () => import("../../../api/geocode"),
  health: () => import("../../../api/health"),
  "map-token": () => import("../../../api/map-token"),
  map: () => import("../../../api/map"),
  matches: () => import("../../../api/matches"),
  "pet-media": () => import("../../../api/pet-media"),
  pets: () => import("../../../api/pets"),
  sources: () => import("../../../api/sources"),
  submissions: () => import("../../../api/submissions"),
};

class LegacyResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = new Headers();
    this.payload = null;
  }
  setHeader(name, value) {
    this.headers.set(name, String(value));
    return this;
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  json(value) {
    this.headers.set("Content-Type", "application/json; charset=utf-8");
    this.payload = JSON.stringify(value);
    return this;
  }
  send(value) {
    this.payload = value;
    return this;
  }
  end() {
    this.payload = null;
    return this;
  }
  toResponse() {
    return new Response(this.payload, { status: this.statusCode, headers: this.headers });
  }
}

async function dispatch(nextRequest, context) {
  const { path = [] } = await context.params;
  const key = path.join("/");
  const loadHandler = handlers[key];
  if (!loadHandler) return Response.json({ error: "API route not found" }, { status: 404 });
  const { default: handler } = await loadHandler();
  const url = new URL(nextRequest.url);
  let body;
  if (!["GET", "HEAD"].includes(nextRequest.method)) {
    const contentType = nextRequest.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await nextRequest.json().catch(() => ({}));
    }
  }
  const headers = Object.fromEntries(nextRequest.headers.entries());
  const request = {
    method: nextRequest.method,
    headers,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
    socket: { remoteAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown" },
  };
  const response = new LegacyResponse();
  await handler(request, response);
  return response.toResponse();
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
