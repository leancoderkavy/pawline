import Ably from "ably";
import { requireUser } from "./_auth.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.ABLY_API_KEY) return response.status(503).json({ error: "Realtime community is not configured." });
  let user;
  try { user = await requireUser(request); } catch (error) {
    return response.status(error.statusCode || 401).json({ error: error.message });
  }
  const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: user.id,
    capability: {
      "pawline:community": ["subscribe", "presence"],
    },
  });
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json(tokenRequest);
}

