import handler from "../../../api/ably-token";
import { runLegacyHandler } from "../_adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request) {
  return runLegacyHandler(handler, request);
}
