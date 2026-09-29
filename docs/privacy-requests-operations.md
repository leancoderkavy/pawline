# Privacy request operations

Pawline accepts access, correction, deletion, and other privacy requests at `/privacy/request`. The endpoint stores requests in `privacy_requests`. It does not automatically disclose or delete data.

## Before launch

1. Set `PAWLINE_PRIVACY_OPERATOR_EMAIL` to a verified Clerk account controlled by the privacy operator. `PAWLINE_MODERATION_EMAIL` is a fallback. The endpoint fails closed if neither is set.
2. Run `npm run db:migrate` against the intended database. Verify the `privacy_requests` table exists.
3. Deploy the matching application code and submit a synthetic request through `/privacy/request`. Confirm the reference ID appears in the database.
4. Sign in as the operator at `/pawline-moderation/privacy`. Confirm another account receives 403 from `GET /api/privacy-requests`. Assign a named person and review cadence for the queue; do not rely on email alone. The queue puts unresolved requests before completed or denied requests, oldest unresolved first. Resend sends a reference-only alert when configured; a failed alert leaves the stored request available in the queue.

## Handling a request

Verify control of the account through a private channel before disclosing, changing, or deleting account data. A contact email submitted in the form is unverified. Keep verification evidence and a record of actions taken. Check legal retention and exception requirements before deleting records. Never put request details in a public issue, analytics event, or AI prompt. Update `status` as the request progresses; reply to the requester through a verified private channel.

### Proposed owner procedure for approval

1. Check `/pawline-moderation/privacy` each business day. Treat a Resend alert as a reminder, not the queue of record. Record the request reference and received date in a private case log.
2. Acknowledge receipt privately within two business days. Determine the applicable legal deadline before promising a completion date. Do not treat the form email as proof of identity.
3. For account data, confirm control of the relevant signed-in Clerk account and its verified email through a private channel. Review records associated with that Clerk user ID in Neon and the relevant providers. Escalate ambiguous identity, another person's data, a minor's account, or a legal hold before disclosure or deletion.
4. Record the data locations checked, actions taken, any retention exception, reviewer, dates, and final response. Deliver data only through a channel verified for that requester. Set `completed` or `denied` only after the actual response or documented decision; changing queue status alone does not perform the request.
5. If a request reveals a possible incident, preserve relevant logs and references, restrict affected access, and obtain a jurisdiction-specific notice decision before communicating breach claims. Do not place personal details in public tickets or routine email alerts.

This procedure is proposed for the named owner to adopt. Its two-business-day acknowledgment is an internal target, not a statement of every legal deadline. Account deletion, provider deletion, retention exceptions, and incident notices still require case-specific review.

### Account data-location checklist

Use the verified Clerk user ID and any independently verified contact addresses. Check all matching references, not only a table's primary owner column:

- Clerk: account identity, verified email, authentication records, and any connected Google identity.
- Neon adopter data: `adopter_profiles`, `households`, `household_members`, `user_favorites`, `saved_pet_searches`, `adoption_applications`, and child answers, documents, consents, events, messages, outcomes, and check-ins.
- Neon communications: `direct_conversations`, `direct_messages`, reports, conversation state, video calls and signals, `adoption_appointments`, email preferences, notifications, and attendance. Shared conversations and application records may also concern other people or organizations.
- Neon public/community and caregiver data: `community_messages`, reports and leads, `lost_pet_reports` and tips or flags, `caregiver_registrations`, organization memberships, claim and verification events, reviews, replies, and appeals.
- Neon request/audit data: `privacy_requests`, AI consents and task runs, usage limits, and any relevant moderation or organization audit records. Preserve legally required records only after documenting the exception.
- Providers: check Resend delivery records, Daily meeting metadata, Clerk, Vercel logs, and any enabled AI or realtime provider for data within the request's scope. Browser-local favorites and drafts require instructions to the requester because Pawline cannot delete storage on their device.

This is a search checklist, not an automated deletion query or a guarantee that every provider holds data. Check the current schema and provider configuration for each case before acting. Never delete a shared record solely because one participant requests deletion.

## Remaining review

This feature is one privacy control. Counsel or a qualified privacy reviewer still needs to determine applicable state and international laws, response deadlines, required notices, and rights. Separately verify live provider settings, security controls, accessibility, retention, and incident procedures. Do not describe the website as certified or fully compliant based on this feature alone.
