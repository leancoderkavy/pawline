# Video appointments

Adopters and authorized caregivers arrange a video hello or final visit inside an existing pet conversation. Either side can propose or counter-propose; the other side confirms. Only the adopter and assigned caregiver receive video access. Other current organization members can see appointment context with the shared conversation, but cannot join someone else's confirmed call.

## Implementation

- `api/appointments.js`: authenticated scheduling, revision checks, overlap prevention, reminder preferences, room access, and adoption intentions. One upcoming appointment per conversation. Times are UTC instants with the originating IANA zone. Appointments last 15, 20, or 30 minutes, up to 60 days ahead.
- `api/_daily.js`: server-only Daily REST integration; private rooms, two participants, unique participant IDs, non-owner room-specific tokens expiring after at most two minutes, and room expiry at the appointment end. Token eject options are deliberately omitted because they override Daily's room expiry. Camera and microphone begin off. Recording, transcription, and participant admin controls are disabled. Daily Prebuilt supplies device selection, prejoin, media controls, and reconnection.
- `src/AppointmentPanel.jsx`: booking, confirmation, local time display, calendar download, explicit email opt-in, embedded calls, and post-appointment intentions. Calendar files contain no call credentials or private notes; imported calendar copies require a fresh download after changes.
- `api/cron/appointment-reminders.js`: five-minute maintenance, provider room closure, and leased/idempotent Resend delivery. Recipients must still have verified account email, conversation access, and a current enabled preference. Superseded revisions are discarded. `failed` and `exhausted` counts expose delivery problems without private error details.
- `api/daily-webhook.js`: optional signed attendance events. The exact unsigned `{"test":"test"}` setup probe returns 200 without database access. Other events require a fresh HMAC. Duplicate/out-of-order events do not duplicate attendance. Receipt IDs expire after 30 days. No recording or transcript events are subscribed or stored.

An elapsed appointment is labelled **Time ended**, not automatically declared a successful meeting or a no-show. Participants can mark it finished. A next-step choice shares intent; it does not submit, approve, or withdraw an adoption application.

## Production setup

1. Run `node scripts/migrate-appointments.mjs --dry-run`, then run the same script with the verified production `DATABASE_URL`. It applies ten additive statements in one transaction and verifies the existing pet count. The full schema and general migration verification include the same artifacts.
2. Create a dedicated Daily domain for Pawline. Store `DAILY_API_KEY` and `DAILY_DOMAIN=https://YOUR-DOMAIN.daily.co` as server environment variables in the existing Pawline Vercel project. Do not use `NEXT_PUBLIC_` prefixes, URLs with query credentials, or commit credentials.
3. Set `PAWLINE_DAILY_MONTHLY_MINUTES=9000` or a smaller positive integer. A full two-person room window, including ten-minute early entry, is reserved once per appointment revision before creating a room. Each relevant UTC month is charged the full reservation at a month boundary. Failed/abandoned rooms retain their reservation. This deliberately overestimates use. It does not include calls created outside Pawline or replace Daily account usage monitoring.
4. Set `PAWLINE_DAILY_ENABLED=true` only for the provider pilot. Redeploy after setting the domain: Next's CSP and camera/microphone permissions include that exact domain at build time. An absent/invalid domain or API key keeps video creation closed. Final-visit scheduling still works.
5. Existing `CLERK_SECRET_KEY`, authorized parties, `DATABASE_URL`, `RESEND_API_KEY`, sender configuration, and `CRON_SECRET` must remain configured. Ably accelerates inbox updates; authenticated polling remains available.
6. Webhooks are optional. Daily currently requires adding a credit card for webhook access. Do not add billing just to enable the booking/calling MVP. If the account owner enables them, generate a base64 HMAC secret, configure `DAILY_WEBHOOK_SECRET`, and register `https://www.pawlineadopt.com/api/daily-webhook` for `participant.joined`, `participant.left`, and `meeting.ended`, preferably with exponential retry. Verify actual delivery and status in Daily.

## Verification and rollout evidence

`npm test`, `npm run build`, `npm run test:app`, `npm run test:chat`, `npm run test:appointments`, both migration dry runs, and `npm audit --audit-level=high` are the local checks. CI runs the new appointment browser scenario as well as the existing checks.

The appointment browser suite runs real UI and API handlers against disposable PostgreSQL and separate adopter/caregiver contexts, with the Daily SDK and REST service replaced only at the test boundary. It checks booking, counter-proposal, confirmation, calendar export, join/leave/rejoin cleanup, finish, revocation polling, next steps, final visits, cancellation, and 320/768/1024/1440px layouts. This is **not evidence of actual Daily media delivery**. The existing chat suite separately exercises legacy WebRTC media with test devices.

Required production proof after credentials are available:

- Use two owned QA accounts and a private QA conversation; do not publish a fictitious adoptable pet or contact real shelters as a test. Complete a real two-browser/device Daily call and verify both directions of sound/video, camera/mic toggles, permission denial, reconnect, early/late access, leave/rejoin, and end-for-both behavior.
- Confirm a third user/current unassigned teammate and a removed caregiver cannot obtain a room token. Resolve/block the conversation during the call; verify server room closure and client cleanup.
- Confirm production booking/rescheduling/cancellation, current calendar download, opted-in reminder delivery to the owned QA inbox, and no delivery after opt-out/cancellation. Preserve provider message IDs and actual receipt as separate evidence from queue success.
- Confirm the merged main SHA is deployed on `https://www.pawlineadopt.com`, signed-out private endpoints reject access, and provider/configuration failures give usable messages.

If Daily credentials or two owned authenticated accounts are unavailable, report the missing proof explicitly. A green build or simulated call must not be reported as full production end-to-end success.

## Recovery

Set `PAWLINE_DAILY_ENABLED=false` to stop new room access. With the API key retained, scheduled maintenance closes outstanding rooms; room expiry independently bounds their lifetime. Blocking/resolving a conversation attempts immediate provider closure, with maintenance retry if Daily is unavailable. Client authorization checks run every ten seconds; a malicious client can retain media until provider closure/room expiry if the provider is unavailable. Existing data is preserved and the additive migration need not be rolled back.

Inspect authenticated cron results for nonzero `failed`/`exhausted`, provider errors/usage in Daily, and Resend delivery status. Investigate before retrying exhausted notifications; do not reset attempts blindly or email opted-out users. An opened video appointment cannot be rescheduled: finish it, then create a new appointment, so an old room cannot be reused for another time.

## Provider references

- [Daily private room configuration](https://docs.daily.co/reference/rest-api/rooms/create-room)
- [Daily meeting tokens and expiry precedence](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token)
- [Daily webhook billing, signatures, setup probe and retries](https://docs.daily.co/reference/rest-api/webhooks)
- [Daily participant-left event duration](https://docs.daily.co/reference/rest-api/webhooks/events/participant-left)
