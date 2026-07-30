import ablyToken from "../../../api/ably-token";
import communityLeads from "../../../api/community-leads";
import communityMessages from "../../../api/community-messages";
import communityParseLink from "../../../api/community-parse-link";
import communityReport from "../../../api/community-report";
import cronDiscover from "../../../api/cron/discover";
import discoveries from "../../../api/discoveries";
import events from "../../../api/events";
import extractSubmission from "../../../api/extract-submission";
import geocode from "../../../api/geocode";
import health from "../../../api/health";
import mapToken from "../../../api/map-token";
import mapImage from "../../../api/map";
import matches from "../../../api/matches";
import petMedia from "../../../api/pet-media";
import pets from "../../../api/pets";
import sources from "../../../api/sources";
import submissions from "../../../api/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = {
  "ably-token": ablyToken,
  "community-leads": communityLeads,
  "community-messages": communityMessages,
  "community-parse-link": communityParseLink,
  "community-report": communityReport,
  "cron/discover": cronDiscover,
  discoveries,
  events,
  "extract-submission": extractSubmission,
  geocode,
  health,
  "map-token": mapToken,
  map: mapImage,
  matches,
  "pet-media": petMedia,
  pets,
  sources,
  submissions,
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
  const handler = handlers[key];
  if (!handler) return Response.json({ error: "API route not found" }, { status: 404 });
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
