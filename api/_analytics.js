function headerValue(headers, name) {
  const value = headers?.[name] || headers?.[name.toLowerCase()];
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /[\u0000-\u001f\u007f]/.test(trimmed)) return "";
  return trimmed;
}

export async function captureServerEvent(request, { distinctId, event, properties = {} } = {}) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const resolvedId = distinctId || headerValue(request?.headers, "x-posthog-distinct-id");
  if (!token || !host || !resolvedId || !event) return;
  try {
    const { PostHog } = await import("posthog-node");
    const client = new PostHog(token, { host, flushAt: 1, flushInterval: 0 });
    try {
      const sessionId = headerValue(request?.headers, "x-posthog-session-id");
      client.capture({
        distinctId: resolvedId,
        event,
        properties: {
          ...properties,
          ...(sessionId ? { $session_id: sessionId } : {}),
        },
      });
    } finally {
      await client.shutdown();
    }
  } catch (error) {
    console.error("Analytics capture failed", error?.message || error);
  }
}
