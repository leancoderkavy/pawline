import assert from "node:assert/strict";
import test from "node:test";

test("server analytics does nothing when the project token is absent", async () => {
  const savedToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const savedHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  try {
    const { captureServerEvent } = await import("../api/_analytics.js");
    await captureServerEvent(
      { headers: { "x-posthog-distinct-id": "person_1", "x-posthog-session-id": "session_1" } },
      { event: "user_signed_in", properties: { method: "email" } },
    );
    assert.equal(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, undefined);
  } finally {
    if (savedToken === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    else process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = savedToken;
    if (savedHost === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = savedHost;
  }
});
