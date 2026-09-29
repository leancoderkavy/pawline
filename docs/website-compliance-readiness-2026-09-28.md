# Pawline website compliance readiness — September 28, 2026

## Scope and result

Pawline's current repository serves pet adoption, shelter, messaging, application, and pet-record workflows. Pet health records alone are outside HIPAA's human-health PHI definition. Pawline still handles adopter personal information. Owner confirms intended audience is US users age 13 or older. This review does not establish full legal compliance or verify every production provider setting.

**Approval status: pending.** The owner has identified themself as both privacy-request operator and final privacy/legal sign-off authority. That statement assigns responsibility; it does not approve this record. The owner should approve only after resolving or expressly accepting the open items below. No external legal opinion has been obtained in this review.

## Implemented in this release

- Private privacy-request form for access, correction, deletion, and other questions. The public issue tracker is removed as the policy's request channel.
- Database-backed request queue, durable submission rate limit, Clerk-authenticated operator access, and status tracking.
- Reference-only operator email alert when Resend sender configuration is present. The email contains no requester details.
- Operator procedure requiring identity verification before disclosure or change.
- Signup self-attestation and Terms copy for the stated age 13 minimum. This is not independent age verification.
- Follow-up: Privacy and Terms effective dates now reflect September 28 changes. Privacy notice describes stored request fields. Automated WCAG A/AA scans cover 10 public routes at 360px and 1280px; contrast fixes cover guide labels, mobile eyebrow text, and the map submit button.

## Production acceptance checks

### Verified September 28, 2026

- Main commit `8680b64cb58c043364fcf8e3089a1f58b48d6b1c` passed Pawline App CI and CodeQL and received a successful Vercel Production deployment. Canonical Privacy, Terms, and privacy-request pages returned HTTP 200 with current copy; anonymous `GET /api/privacy-requests` returned 401.
- The production database has `privacy_requests`. A synthetic public submission was stored and removed. In a later signed-in check, the authorized operator queue displayed a separate synthetic database row; that exact row was removed afterward. The queue was empty before the check. These checks establish working intake and operator read access, not actual request fulfillment.
- Live axe checks found no WCAG A/AA violations on 10 public routes at 360px and 1280px. At a 320px viewport, the privacy form had no horizontal overflow, labeled fields, and visible keyboard focus through its controls.
- Vercel project settings showed Production `DATABASE_URL`, Clerk keys, `PAWLINE_MODERATION_EMAIL`, `PAWLINE_FROM_EMAIL`, and Resend key names. No dedicated `PAWLINE_PRIVACY_OPERATOR_EMAIL` was listed, so the documented moderation fallback is in use. Secret values were not inspected. The live operator check supports this configuration.
- Resend lists `pawlineadopt.com` as a verified sending domain. This does not verify delivery of every privacy alert or a staffed response channel.
- Neon Pawline project uses its `main` branch in AWS US East 2. Its Backup & Restore page showed a one-day point-in-time history window, no snapshots, and no schedule. The overview showed no IP restrictions. The available schedule offers daily snapshots at 00:00 UTC kept for 14 days by default; that option was inspected without saving. This is configuration evidence, not a completed restore or access-risk review.
- The product owner stated they personally own both the privacy-request queue and final privacy/legal sign-off. This identifies the responsible person; it is not a recorded approval of the findings or evidence of a staffed review cadence.

### Required before a compliance approval

1. The owner must adopt a queue review cadence, specify a private response channel, and retain a record of completed requests. The form and status selector do not fulfill requests automatically.
2. Review a real request handling procedure, including identity verification, account data inventory, deletion exceptions, provider data, and response deadlines. Test a non-operator signed-in account for a 403 response; anonymous denial and operator access are verified.
3. Review Vercel, Neon, Clerk, Resend, Daily, Mapbox, and any enabled AI provider settings and contracts for access, retention, backup/restore, incident response, and deletion. In particular, decide whether Neon's one-day history window and lack of scheduled snapshots meet the recovery objective, then document a safe restore test. Scheduled snapshots can add usage-billed storage. Do not treat the presence of environment variables as proof of provider safeguards.
4. Complete manual signed-in keyboard, screen-reader, and zoom checks for messaging, applications, and shelter workflows. Automated scans and the public privacy-form keyboard check do not establish site-wide accessibility.
5. Record the accountable owner's approval after they check this evidence against actual business practices and applicable law. Seek qualified privacy/legal review for unresolved legal scope or notice requirements. No technical test can grant that approval.

## Owner decision record

Decision: **pending**. The owner has not yet accepted a backup schedule, adopted the proposed queue procedure, documented a restore test, or approved the remaining legal and accessibility risks. A later approval should identify the owner, date, applicable scope, accepted exceptions, and next review date. Do not replace those decisions with a CI result, deployment status, or this document.

## Legal scope still to determine

Owner states Pawline targets US users age 13 or older. Owner also reports Pawline is below all California CCPA business thresholds: annual revenue below the current $26.625 million threshold, no buying/selling/sharing of 100,000 or more California residents' or households' personal information, and less than half of revenue from selling or sharing California personal information. On those reported facts, Pawline does not appear to meet the CCPA business definition. Confirm this annually and if business practices change. Confirm whether other signup routes bypass the age prompt, and establish a process for any known under-13 accounts. Review other applicable state privacy rules and obtain legal review before claiming compliance with a specific regime.

## Sources

- [HIPAA definitions, 45 CFR 160.103](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/subpart-A/section-160.103)
- [FTC privacy and security guidance](https://www.ftc.gov/business-guidance/privacy-security)
- [DOJ guidance on website accessibility and the ADA](https://www.ada.gov/resources/web-guidance/)
- [California privacy law and regulations](https://cppa.ca.gov/regulations/)
- [California agency CCPA applicability FAQ](https://cppa.ca.gov/faq)
- [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
