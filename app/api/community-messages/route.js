import handler from "../../../api/community-messages";
import { runLegacyHandler } from "../_adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request) {
  return runLegacyHandler(handler, request);
}

export function POST(request) {
  return runLegacyHandler(handler, request);
}
