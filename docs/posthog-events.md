# PostHog critical-path audit

HOLD-MERGE: draft review only. No merge, deployment, dashboard changes, or paid services were performed for this audit.

## Existing setup and fixes

The root layout contained the only PostHog integration: a CDN snippet with a hardcoded public project token, US ingestion, and `person_profiles: identified_only`. No explicit captures, Clerk identity/reset hooks, or error reporting were present. There is no payment provider or real checkout flow in this repository; no payment events were invented.

The same CDN loader now uses `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` (defaults to `https://us.i.posthog.com`). Blank/invalid keys or unsupported hosts disable the loader. Only US Cloud is accepted, matching the existing CSP script/connect origins. The key is a public project token, not a personal API key. Public environment changes require a rebuild.

On the main product landing, Clerk's loaded auth state identifies by opaque `userId` without traits; account switches reset first, and sign-out captures before reset. Repeated effects are deduplicated. Initial signed-out state also resets stale identity, so anonymous continuity across reloads is intentionally limited. Restored sessions identify but do not count as a fresh sign-in. Completion events come from the custom auth modal after Clerk finalization, not from page loads.

## Events added

All custom event names use snake_case. **No custom properties** are accepted.

| Event | Trigger |
| --- | --- |
| `auth_started` | Initial sign-in/sign-up submission when Clerk is ready; retries count as attempts |
| `sign_in_completed`, `sign_up_completed` | Successful Clerk finalization in the auth modal |
| `signed_out` | Loaded auth state transitions from identified to signed out |
| `auth_error` | Auth modal displays a validation/provider/resend error; no error text |
| `pet_viewed` | Explicit opening of pet details from map or discovery; not deep-link/back navigation |
| `pet_favorite_added`, `pet_favorite_removed` | Guest local save succeeds, or signed-in cloud save succeeds; excludes initial sync/import |
| `favorite_error` | Local save or cloud mutation fails |
| `application_submitted` | Application submission API succeeds; excludes local drafts |
| `application_error` | Application submission fails |
| `appointment_proposed` | Propose API succeeds |
| `appointment_confirmed` | Accept API succeeds |
| `appointment_rescheduled` | Reschedule API succeeds |
| `appointment_cancelled` | Cancel API succeeds |
| `appointment_completed` | End API succeeds |
| `appointment_error` | Appointment mutation fails; polling is excluded to avoid repeated noise |
| `app_error` | Next.js route error boundary receives a new error |

Appointment success is recorded before refreshing the list. A failed follow-up read displays its error without classifying the accepted mutation as failed. Events measure browser-observed successes, not unique database transitions: retries may count again, and blockers/navigation may lose events. Background jobs, direct API consumers, Clerk-hosted flows, identity restoration on the standalone claim/moderation pages, and errors outside these paths are not instrumented.

## Privacy controls

Autocapture, pageviews/pageleave, replay, heatmaps, dead/rage clicks, automatic exceptions, performance capture, surveys, and feature-flag requests are disabled. Error events contain no message, stack, request body, note, or URL. `before_send` rejects unknown events and replaces outgoing properties with a minimal SDK allowlist: project token, distinct/anonymous/device/session/window identifiers, library/version, and identity/person-processing booleans. This also removes SDK-added URLs, referrers, UTM fields, and nested `$set`/`$set_once` traits. `$identify` is the only allowed SDK event. No pet, application, appointment, or conversation IDs are sent.

The Clerk ID and SDK identifiers are pseudonymous, not anonymous. `ip: false` disables PostHog IP-based enrichment; network requests necessarily still reach the provider. Existing SDK storage can contain historic metadata locally, but that metadata is stripped from outgoing events. See [PostHog configuration](https://posthog.com/docs/libraries/js/config) for the capture and `before_send` options.

## Setup gaps before any future rollout

- Set and verify the intended public project token in the target build environment. Removing the hardcoded fallback means analytics remains off without it. No hosted environment values or dashboard settings were read or changed.
- Confirm US project ownership/region and ingestion in an authorized test environment. EU/custom proxy hosts need a separate CSP/config change.
- Review analytics disclosure, consent requirements, retention, and account deletion for pseudonymous identifiers; the current privacy page does not specifically describe PostHog. No consent UI or dashboard policy was added.
- Live ingestion, project quotas/billing, and dashboard-side processing remain unverified. This audit sends no live analytics and enables no paid feature.
- CDN `array.js` remains unpinned, as before. Recheck filtering when changing the SDK/configuration. There is no server SDK, server exception pipeline, or guaranteed-delivery payment instrumentation.

## Verification

`node --test test/posthog.test.js` executes the generated loader in a sandbox and checks disabled config, early event queuing, property scrubbing (including nested traits), identity switching/logout, duplicate effects, and fail-open behavior. The existing appointment browser scenario stubs PostHog locally and checks exact success-event sequences with no properties for two participants. It does not contact PostHog, Clerk, or Daily.
