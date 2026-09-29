# Pawline website compliance readiness — September 28, 2026

## Scope and result

Pawline's current repository serves pet adoption, shelter, messaging, application, and pet-record workflows. Pet health records alone are outside HIPAA's human-health PHI definition. Pawline still handles adopter personal information. Owner confirms intended audience is US users age 13 or older. This review does not establish full legal compliance or verify every production provider setting.

## Implemented in this release

- Private privacy-request form for access, correction, deletion, and other questions. The public issue tracker is removed as the policy's request channel.
- Database-backed request queue, durable submission rate limit, Clerk-authenticated operator access, and status tracking.
- Reference-only operator email alert when Resend sender configuration is present. The email contains no requester details.
- Operator procedure requiring identity verification before disclosure or change.
- Signup self-attestation and Terms copy for the stated age 13 minimum. This is not independent age verification.

## Production acceptance checks

1. Confirm Vercel production has `DATABASE_URL`, Clerk credentials, and a verified `PAWLINE_PRIVACY_OPERATOR_EMAIL` or `PAWLINE_MODERATION_EMAIL`. Confirm Resend sender settings if email alerts are expected.
2. Apply `privacy_requests` schema to the exact production database. Submit a synthetic request through the live site and verify queue receipt, operator access, and rejection for another account.
3. Assign a person to monitor the queue, answer requests through a private verified channel, and record completion. The form does not automatically fulfill a request.
4. Test the full website's important paths with keyboard, screen reader, mobile zoom, and contrast checks. The new form has a local keyboard smoke test, but this is not a site-wide accessibility audit.
5. Review production provider settings, access logs, backups, breach response, retention, and account deletion procedure. Confirm policy statements match those settings.

## Legal scope still to determine

Owner states Pawline targets US users age 13 or older. Owner also reports Pawline is below all California CCPA business thresholds: annual revenue below the current $26.625 million threshold, no buying/selling/sharing of 100,000 or more California residents' or households' personal information, and less than half of revenue from selling or sharing California personal information. On those reported facts, Pawline does not appear to meet the CCPA business definition. Confirm this annually and if business practices change. Confirm whether other signup routes bypass the age prompt, and establish a process for any known under-13 accounts. Review other applicable state privacy rules and obtain legal review before claiming compliance with a specific regime.

## Sources

- [HIPAA definitions, 45 CFR 160.103](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/subpart-A/section-160.103)
- [FTC privacy and security guidance](https://www.ftc.gov/business-guidance/privacy-security)
- [DOJ guidance on website accessibility and the ADA](https://www.ada.gov/resources/web-guidance/)
- [California privacy law and regulations](https://cppa.ca.gov/regulations/)
- [California agency CCPA applicability FAQ](https://cppa.ca.gov/faq)
- [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
