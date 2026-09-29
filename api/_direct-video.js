import { createHmac } from "node:crypto";
import { directError } from "./_direct.js";

export function videoConfiguration(environment = process.env, userId = "", callId = "") {
  const direct = environment.NODE_ENV !== "production" && environment.PAWLINE_VIDEO_ALLOW_DIRECT === "true";
  const urls = String(environment.PAWLINE_TURN_URLS || "").split(",").map(value => value.trim()).filter(Boolean);
  const relay = urls.length > 0 && urls.length <= 6 && urls.every(value => /^turns?:[a-z0-9.-]+(?::\d+)?(?:\?transport=(?:udp|tcp))?$/i.test(value)) && Boolean(environment.PAWLINE_TURN_SHARED_SECRET);
  const cloudflare = /^[a-z0-9_-]{1,128}$/i.test(environment.PAWLINE_CLOUDFLARE_TURN_KEY_ID || "")
    && Boolean(environment.PAWLINE_CLOUDFLARE_TURN_API_TOKEN);
  const enabled = environment.PAWLINE_VIDEO_ENABLED === "true" && (relay || cloudflare || direct);
  if (!enabled) return { enabled: false, reason: "Video calling is not available yet. You can keep talking here in messages." };
  if (!relay && cloudflare) return { enabled: true, provider: "cloudflare" };
  if (!relay) return { enabled: true, iceServers: [], iceTransportPolicy: "all" };
  // coturn REST credentials expire shortly after the maximum one-hour call.
  // The shared secret never leaves the server. Opaque IDs avoid disclosing identity.
  const subject = createHmac("sha256", environment.PAWLINE_TURN_SHARED_SECRET).update(`${userId}:${callId}`).digest("hex").slice(0, 24);
  const username = `${Math.floor(Date.now() / 1000) + 3900}:${subject}`;
  const credential = createHmac("sha1", environment.PAWLINE_TURN_SHARED_SECRET).update(username).digest("base64");
  return { enabled: true, iceServers: [{ urls, username, credential }], iceTransportPolicy: "relay" };
}

export async function resolveVideoConfiguration(environment = process.env, fetchCredentials = globalThis.fetch) {
  const config = videoConfiguration(environment);
  if (!config.enabled || config.provider !== "cloudflare") return config;
  const unavailable = () => directError("Video calling is temporarily unavailable. Please continue in messages.", 503);
  try {
    const response = await fetchCredentials(`https://rtc.live.cloudflare.com/v1/turn/keys/${environment.PAWLINE_CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${environment.PAWLINE_CLOUDFLARE_TURN_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 3900 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw unavailable();
    const body = await response.json();
    const turn = body?.iceServers?.find(server => server?.username && server?.credential && server.urls);
    const urls = (Array.isArray(turn?.urls) ? turn.urls : [turn?.urls]).filter(url =>
      typeof url === "string" && /^turns?:turn\.cloudflare\.com:(?:3478|443|80|5349)\?transport=(?:udp|tcp)$/.test(url));
    if (!urls.length || typeof turn.username !== "string" || turn.username.length > 512
      || typeof turn.credential !== "string" || turn.credential.length > 512) throw unavailable();
    return { enabled: true, iceServers: [{ urls, username: turn.username, credential: turn.credential }], iceTransportPolicy: "relay" };
  } catch {
    throw unavailable();
  }
}

export function publicCall(row, userId, conversation) {
  if (!row) return null;
  const opposite = row.caller_is_inquirer !== (conversation.inquirer_clerk_user_id === userId);
  return {
    id: row.id, conversationId: row.conversation_id, state: row.state,
    callerName: row.caller_name, mine: row.caller_user_id === userId,
    participant: row.caller_user_id === userId || row.callee_user_id === userId,
    canAccept: row.state === "ringing" && opposite,
    createdAt: row.created_at, acceptedAt: row.accepted_at, expiresAt: row.expires_at,
  };
}

export function validateSignal(kind, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw directError("Invalid call signal.");
  if (kind === "offer" || kind === "answer") {
    if (payload.type !== kind || typeof payload.sdp !== "string" || !payload.sdp.startsWith("v=0") || payload.sdp.length > 60000) throw directError("Invalid session description.");
    return { type: kind, sdp: payload.sdp };
  }
  if (kind === "candidate") {
    if (typeof payload.candidate !== "string" || payload.candidate.length > 4096
      || (payload.sdpMid != null && (typeof payload.sdpMid !== "string" || payload.sdpMid.length > 256))
      || (payload.sdpMLineIndex != null && (!Number.isInteger(payload.sdpMLineIndex) || payload.sdpMLineIndex < 0 || payload.sdpMLineIndex > 64))) throw directError("Invalid connection candidate.");
    return { candidate: payload.candidate, sdpMid: payload.sdpMid ?? null, sdpMLineIndex: payload.sdpMLineIndex ?? null };
  }
  throw directError("Invalid call signal type.");
}

export async function expireCalls(database, conversationId) {
  await database`
    UPDATE direct_video_calls SET state = CASE WHEN state = 'ringing' THEN 'missed' ELSE 'ended' END, ended_at = now()
    WHERE conversation_id = ${conversationId} AND state IN ('ringing', 'accepted')
      AND (expires_at <= now() OR caller_seen_at < now() - interval '45 seconds'
        OR (state = 'accepted' AND callee_seen_at < now() - interval '45 seconds'))
  `;
  await database`
    DELETE FROM direct_video_signals WHERE call_id IN (
      SELECT id FROM direct_video_calls WHERE conversation_id = ${conversationId} AND state NOT IN ('ringing', 'accepted')
    )
  `;
}

// Scheduled cleanup is independent of clients returning to a conversation.
// Keep call metadata for the recent-call list; delete negotiation data promptly.
export async function purgeExpiredVideoSignals(database) {
  await database`
    UPDATE direct_video_calls SET state = CASE WHEN state = 'ringing' THEN 'missed' ELSE 'ended' END, ended_at = now()
    WHERE state IN ('ringing', 'accepted') AND (expires_at <= now()
      OR caller_seen_at < now() - interval '45 seconds'
      OR (state = 'accepted' AND callee_seen_at < now() - interval '45 seconds'))
  `;
  const rows = await database`
    DELETE FROM direct_video_signals WHERE created_at < now() - interval '70 minutes'
      OR call_id IN (SELECT id FROM direct_video_calls WHERE state NOT IN ('ringing', 'accepted')) RETURNING id
  `;
  return rows.length;
}
