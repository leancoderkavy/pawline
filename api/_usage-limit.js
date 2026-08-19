export async function consumeUsage(database, { scope, subject, limit, windowMs }) {
  if (!database) throw new Error("Durable usage limits are unavailable.");
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const rows = await database`
    INSERT INTO usage_limits (scope, subject, window_started_at, request_count)
    VALUES (${scope}, ${subject}, ${windowStart}, 1)
    ON CONFLICT (scope, subject, window_started_at) DO UPDATE SET
      request_count = usage_limits.request_count + 1
    RETURNING request_count
  `;
  return Number(rows[0]?.request_count || 0) <= limit;
}

export async function consumeUsageChain(database, limits) {
  for (const options of limits) {
    if (!await consumeUsage(database, options)) {
      return { allowed: false, deniedScope: options.scope };
    }
  }
  return { allowed: true, deniedScope: null };
}

export function createUsageFallbackLimiter({
  clientLimit = 120,
  globalLimit = 3000,
  windowMs = 60 * 60 * 1000,
} = {}) {
  let windowStart = null;
  let globalCount = 0;
  const clientCounts = new Map();

  return (clientKey, now = Date.now()) => {
    const nextWindowStart = Math.floor(now / windowMs) * windowMs;
    if (windowStart !== nextWindowStart) {
      windowStart = nextWindowStart;
      globalCount = 0;
      clientCounts.clear();
    }
    const clientCount = clientCounts.get(clientKey) || 0;
    if (clientCount >= clientLimit || globalCount >= globalLimit) return false;
    clientCounts.set(clientKey, clientCount + 1);
    globalCount += 1;
    return true;
  };
}

export function requestClientKey(request, environment = process.env) {
  const address = String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 160) || "unknown";
  const secret = environment.USAGE_LIMIT_SALT
    || environment.CLERK_SECRET_KEY
    || environment.CRON_SECRET
    || "pawline-usage-v1";
  return `client:${createHmac("sha256", secret).update(address).digest("hex")}`;
}

export async function cleanupUsageLimits(database, retentionDays = 7) {
  if (!database) throw new Error("Durable usage limits are unavailable.");
  const days = Math.max(1, Math.min(30, Math.trunc(Number(retentionDays) || 7)));
  const rows = await database`
    DELETE FROM usage_limits
    WHERE window_started_at < now() - (${days} * interval '1 day')
    RETURNING 1
  `;
  return rows.length;
}
import { createHmac } from "node:crypto";
