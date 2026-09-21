import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (token && apiHost) {
  posthog.init(token, {
    api_host: apiHost,
    defaults: "2026-05-30",
  });

  if (typeof window !== "undefined" && !window.__pawlineAnalyticsFetch) {
    window.__pawlineAnalyticsFetch = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      try {
        const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || "";
        let pathname = rawUrl;
        try {
          pathname = new URL(rawUrl, window.location.origin).pathname;
        } catch {
          return originalFetch(input, init);
        }
        if (!pathname.startsWith("/api/")) return originalFetch(input, init);
        const headers = new Headers(init?.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined));
        const distinctId = posthog.get_distinct_id?.();
        const sessionId = posthog.get_session_id?.();
        if (distinctId) headers.set("X-POSTHOG-DISTINCT-ID", distinctId);
        if (sessionId) headers.set("X-POSTHOG-SESSION-ID", sessionId);
        return originalFetch(input, { ...init, headers });
      } catch {
        return originalFetch(input, init);
      }
    };
  }
}
