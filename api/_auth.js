import { createClerkClient, verifyToken } from "@clerk/backend";

function bearerToken(request) {
  const header = String(request.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function requireUser(request) {
  const token = bearerToken(request);
  if (!token || !process.env.CLERK_SECRET_KEY) {
    const error = new Error("Sign in with Pawline to use the community.");
    error.statusCode = 401;
    throw error;
  }
  try {
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: String(process.env.CLERK_AUTHORIZED_PARTIES || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const profile = await clerk.users.getUser(verified.sub);
    const displayName =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.username ||
      "Pawline member";
    return {
      id: verified.sub,
      displayName: displayName.slice(0, 80),
      imageUrl: profile.imageUrl || null,
    };
  } catch {
    const error = new Error("Your Pawline session could not be verified.");
    error.statusCode = 401;
    throw error;
  }
}

