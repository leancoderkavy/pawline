# Pet discovery and shelter network release

Pawline now has a searchable stored pet catalog alongside its live provider search, with saved searches, lost-and-found reports, shelter CSV intake, and meeting proposals within conversations. This is a foundation for growing an adoption network; it does not establish that Pawline has the largest inventory or outperforming adoption outcomes.

## Delivered behavior

- Stored catalog: stable ID cursors, species and text filters, optional distance search, and individual shareable pet pages. Imported records require a successful source sync within 48 hours to appear in this catalog. Location searches exclude unknown coordinates.
- Live provider search: deterministic provider pagination, species filtering before database pagination, RescueGroups advanced search with radius support, and source-scoped animal identity. The response keeps the complete merged provider page rather than silently truncating some sources. Live provider pages are not a snapshot of all worldwide inventory.
- Saved searches: authenticated, account-isolated search filters and in-app checks for records added since saving. There are no scheduled email or push alerts in this release.
- Lost and found: public city-level reports, private tips visible to the reporter, owner-controlled reunited/closed states, concern reports, and suppression after three distinct flags. Public search excludes reports older than 90 days; this is not a data-deletion policy. Reports do not verify ownership.
- Shelter intake: organization administrators preview CSV files, confirm publication authority, and import up to 200 records into the existing review queue. Stable organization animal IDs update the same records. Every import, including updates, requires review before publication. The template does not create an automatic external data partnership.
- Conversations: the appointment workflow on main handles proposals, confirmation, cancellation, calendar downloads, opt-in reminders, and video-provider access. This release integrates with that shared workflow rather than introducing a second scheduler. See `video-appointments-operations.md` for provider and reminder setup.
- Coverage: stored counts and source observations distinguish current, stale, failed, and never-synced feeds. These are not claimed adoption counts or verified shelter partnerships.

## Python importer

`python scripts/ingest.py --dry-run` validates configured authorized JSON/CSV snapshots without applying imports. `--source SOURCE_UUID` scopes a run. Normal execution installs the reviewed source definitions and imports under an advisory lock.

The importer bounds pages, bytes, timeouts, and record counts; rejects duplicate or missing source IDs, repeated pages, redirects, unsafe public URLs, and unexpectedly large inventory drops; and keeps oversized raw payloads valid JSON. It supports the expanded species vocabulary. A failed or incomplete snapshot does not mark missing pets unavailable. Two successful missing observations mark an animal unavailable, never adopted. The cron endpoint reports source errors instead of returning a false success.

This release uses approved official sources already configured in the repository. It does not scrape Petfinder inventory or bypass access restrictions. New sources still require a reviewed mapping, permission/terms assessment, attribution, stable identity, and update/removal handling.

## Operations performed on September 8

- Applied `db/network-growth.sql` to production using `scripts/migrate-network.mjs`; repeated application succeeded. The normal migration runner now also includes it in an atomic advisory-locked transaction.
- Dry-run validated 48 Montgomery County pet records, 49 Pasadena public events, and 40 King County pet records. The production run completed at 19:26:46 UTC with those same accepted counts and no missing-record transitions. These are refreshed records, not 88 newly acquired animals or 49 new partnerships.
- Sent one individual outreach email to Pasadena Humane requesting the appropriate adoption-data/pilot contact, and one to Regional Animal Services of King County requesting attribution, update, and correction guidance. Both used their published contact addresses. Messages requested permission and did not claim an existing partnership. Gmail returned SENT receipts; delivery, reading, replies, and agreements remain unconfirmed. No automatic follow-up sequence was enabled.

## Verification and remaining dependencies

Tests cover importer snapshot failures, source identity, repeated and rolled-back migrations, catalog pagination, geographic filtering, account isolation, private tips, shelter administrator authorization and pending imports, and appointment authorization. Browser coverage exercises existing chat/video with two local fixture users and fake media, mobile intake, and the shared appointment workflow. Test fixtures use a disposable database and are not part of production authentication.

Production health reported video calling unconfigured before this release and after the appointment release on main. The appointment workflow needs its Daily provider configuration and two-account production media verification; the legacy WebRTC path separately requires TURN for reliable calls across restrictive networks. Local fixture success is not evidence of production media delivery. Provider credentials, incoming outreach replies, and external data agreements remain operational dependencies.

Next work should be driven by authorized shelter feeds and measured inventory freshness, search coverage, shelter response times, meeting completions, and confirmed adoption outcomes. Nationwide supply acquisition, automatic cross-provider entity reconciliation, and scheduled notifications are not completed by this release.
