import crypto from "node:crypto";

const MAX_AGE_SECONDS = 5 * 60;

function keyBytes(secret) {
  const raw = String(secret || "");
  if (!raw.startsWith("whsec_")) return null;
  try {
    const result = Buffer.from(raw.slice("whsec_".length), "base64");
    return result.length ? result : null;
  } catch { return null; }
}

export function verifyResendSignature({ payload, id, timestamp, signature, secret, now = Date.now() }) {
  const key = keyBytes(secret);
  const sentAt = Number(timestamp);
  if (!key || !id || !signature || !Number.isInteger(sentAt) || Math.abs(Math.floor(now / 1000) - sentAt) > MAX_AGE_SECONDS) {
    return false;
  }
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return String(signature).split(" ").some((entry) => {
    const [version, received] = entry.split(",");
    if (version !== "v1" || !received) return false;
    const actual = Buffer.from(received);
    const target = Buffer.from(expected);
    return actual.length === target.length && crypto.timingSafeEqual(actual, target);
  });
}

export function normalizeResendDeliveryEvent(event) {
  const type = String(event?.type || "");
  const emailId = typeof event?.data?.email_id === "string" ? event.data.email_id : null;
  const map = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
  };
  return emailId && map[type] ? { emailId, eventType: map[type] } : null;
}
