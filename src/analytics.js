import { analyticsEvents } from './posthogSetup.js';

export function capture(event) {
  if (!analyticsEvents.includes(event)) return;
  try { globalThis.window?.posthog?.capture(event); } catch { /* Analytics never blocks the product. */ }
}

let identity;
export function syncAnalyticsIdentity(userId) {
  const sdk = globalThis.window?.posthog;
  if (!sdk || identity === userId) return;
  try {
    if (identity || !userId) {
      if (identity && !userId) capture('signed_out');
      sdk.reset();
    }
    if (userId) sdk.identify(userId); // Opaque Clerk ID; no profile/contact fields.
    identity = userId;
  } catch { /* Blocked/unavailable analytics is optional. */ }
}
