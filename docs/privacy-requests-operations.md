# Privacy request operations

Pawline accepts access, correction, deletion, and other privacy requests at `/privacy/request`. The endpoint stores requests in `privacy_requests`. It does not automatically disclose or delete data.

## Before launch

1. Set `PAWLINE_PRIVACY_OPERATOR_EMAIL` to a verified Clerk account controlled by the privacy operator. `PAWLINE_MODERATION_EMAIL` is a fallback. The endpoint fails closed if neither is set.
2. Run `npm run db:migrate` against the intended database. Verify the `privacy_requests` table exists.
3. Deploy the matching application code and submit a synthetic request through `/privacy/request`. Confirm the reference ID appears in the database.
4. Sign in as the operator at `/pawline-moderation/privacy`. Confirm another account receives 403 from `GET /api/privacy-requests`. Assign a named person and review cadence for the queue; do not rely on email alone. The queue puts unresolved requests before completed or denied requests, oldest unresolved first. Resend sends a reference-only alert when configured; a failed alert leaves the stored request available in the queue.

## Handling a request

Verify control of the account through a private channel before disclosing, changing, or deleting account data. A contact email submitted in the form is unverified. Keep verification evidence and a record of actions taken. Check legal retention and exception requirements before deleting records. Never put request details in a public issue, analytics event, or AI prompt. Update `status` as the request progresses; reply to the requester through a verified private channel.

## Remaining review

This feature is one privacy control. Counsel or a qualified privacy reviewer still needs to determine applicable state and international laws, response deadlines, required notices, and rights. Separately verify live provider settings, security controls, accessibility, retention, and incident procedures. Do not describe the website as certified or fully compliant based on this feature alone.
