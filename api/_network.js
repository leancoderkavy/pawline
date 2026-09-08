import { getDatabase } from "./_db.js";
import { requireUser } from "./_auth.js";
import { consumeUsage } from "./_usage-limit.js";
export const networkError = (message, statusCode = 422) =>
  Object.assign(new Error(message), { statusCode });
export const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
export function requiredText(value, min, max, label) {
  const text =
    typeof value === "string"
      ? value.replace(/[\u0000-\u001f]/g, " ").trim()
      : "";
  if (text.length < min || text.length > max)
    throw networkError(`Provide ${label} (${min}–${max} characters).`);
  return text;
}
export function privateHandler(methods, action, dependencies = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!methods.includes(request.method)) {
      response.setHeader("Allow", methods.join(", "));
      return response.status(405).json({ error: "Method not allowed" });
    }
    try {
      const user = await (dependencies.requireUser || requireUser)(request);
      const database = (dependencies.getDatabase || getDatabase)();
      if (!database)
        throw networkError("Storage is temporarily unavailable.", 503);
      if (
        request.method !== "GET" &&
        !(await (dependencies.consumeUsage || consumeUsage)(database, {
          scope: "network_write_user",
          subject: user.id,
          limit: 60,
          windowMs: 3600000,
        }))
      )
        throw networkError("Please wait before making more changes.", 429);
      return response.status(200).json(await action(database, user, request));
    } catch (error) {
      return response
        .status(error.statusCode || 503)
        .json({
          error: error.statusCode
            ? error.message
            : "This feature is temporarily unavailable. Please retry.",
        });
    }
  };
}
