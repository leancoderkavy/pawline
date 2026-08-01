import Ably from "ably";
import { requireUser } from "./_auth.js";
import { getDatabase } from "./_db.js";
import { consumeUsage } from "./_usage-limit.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.ABLY_API_KEY) return response.status(503).json({ error: "Realtime community is not configured." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  const database = getDatabase();
  if (!database) return response.status(503).json({ error: "Realtime safety checks are unavailable." });
  try {
    const allowed = await consumeUsage(database, {
      scope: "ably_token_user", subject: user.id, limit: 60, windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return response.status(429).json({ error: "Realtime session limit reached. Try again later." });
  } catch {
    return response.status(503).json({ error: "Realtime safety checks are unavailable." });
  }
  const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: user.id,
    capability: {
      "pawline:community": ["subscribe", "presence"],
      [`pawline:direct:${user.id}`]: ["subscribe"],
    },
  });
  return response.status(200).json(tokenRequest);
}
