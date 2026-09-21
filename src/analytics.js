import posthog from "posthog-js";

function analyticsEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export function capture(event, properties) {
  if (!analyticsEnabled() || !event) return;
  posthog.capture(event, properties);
}

export function identifyUser(distinctId, properties) {
  if (!analyticsEnabled() || !distinctId) return;
  const person = Object.fromEntries(Object.entries(properties || {}).filter(([, value]) => Boolean(value)));
  posthog.identify(distinctId, person);
}

export function resetAnalytics() {
  if (!analyticsEnabled()) return;
  posthog.reset();
}

export function captureException(error) {
  if (!analyticsEnabled() || !error) return;
  posthog.captureException?.(error);
}
