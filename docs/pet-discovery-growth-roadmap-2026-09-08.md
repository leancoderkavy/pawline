# Pawline: pet discovery and shelter network roadmap

Prepared September 8, 2026. This is an implementation roadmap based on repository inspection and public-source research, not evidence of deployed capability or current inventory counts.

## Product objective

Make Pawline the most useful place to find a pet, reach the people caring for it, meet by video, and complete the next adoption step. Grow toward the largest independently measured network of current, unique adoptable pets and participating shelters.

Initial planning assumption: US adoption discovery, followed by broader species and country coverage. Lost-and-found is a separate workflow below. These scope assumptions are reversible.

Petfinder currently advertises a network of over 14,500 shelters and rescues and supports dogs, cats, and other animals. This is its self-reported network size, not a verified count of active inventory. Pawline needs both useful local coverage and a dependable shelter workflow to compete; adding communication buttons alone will not produce that network.

## What exists in this checkout

| Area | Evidence | Next question |
| --- | --- | --- |
| Pet aggregation | `api/pets.js` merges database, Montgomery County, King County, LA Animal Services, and optional RescueGroups results | How many unique, current pets are actually searchable in each region? |
| Durable ingestion | `scripts/ingest.py`, `db/schema.sql`, and README describe authorized imports, run tracking, and unavailable transitions | Which sources are running successfully in production, with what freshness? |
| Shelter operations | Organization identities, locations, memberships, claims, applications, and outcomes exist in `db/schema.sql` and API handlers | Can a real shelter complete the workflow with two distinct staff/adopter accounts? |
| Messaging | `src/DirectMessagesWorkspace.jsx` and direct-message APIs exist | Verify delivery, reconnection, access control, and notifications with separate identities |
| Video | `src/videoSession.js`, `api/direct-video.js`, and `api/_direct-video.js` exist | Production requires enabled video and TURN configuration; prove calls across different networks |
| Source catalog | `api/sources.js` exposes configured/static source states | Replace configuration-only confidence with last successful sync, failures, and usable record counts |

Existing code is not production acceptance evidence. Current database size, provider credentials, partner approvals, live call quality, and deployment state were not verified in this review.

## Priority 1: trustworthy inventory and complete search

Build a canonical search inventory from sources whose terms permit persistence. For providers requiring live queries, retain a clearly described federated path. Do not assume an API key permits indefinite storage or redistribution.

The current search handler requests a page from each provider, merges and bounds that result, and exposes `hasMore` only below page 20. That is not a complete, stable national inventory traversal. Replace this with server-side geographic filtering and stable cursor pagination over authorized canonical records. Test that all eligible records can be reached without duplication or omission while sources update.

Extend the existing source and pet schema rather than building a second catalog:

- Preserve source record identity, canonical pet identity, owning organization, source URL, source-updated time, last successful observation, availability, and permitted retention.
- Store multiple source references per canonical animal. Use shelter-issued IDs and organization identity for strong matches; uncertain name/photo/location matches enter review instead of automatic merges.
- Record organization identity separately from branches, public locations, and private foster addresses.
- Separate successful fetch time from provider-confirmed animal availability. Never present a cache refresh as shelter verification.
- Preserve existing behavior that disappearance is not proof of adoption. Quarantine suspect feed drops and alert on stale sources.
- Measure active unique pets, listed organizations, verified organizations, and actively participating organizations separately. Search leads and historical pets do not inflate active counts.

Acceptance: fixtures covering cross-source duplicates, different animals with the same name, partial feed failures, interrupted imports, removed animals, and complete pagination; production baseline by region; visible stale/partial states; documented source permissions.

## Priority 2: give shelters a reason to participate

Make the free core useful: claim a profile, import existing data, maintain pet status, collaborate in an inbox, and manage applications. Minimize duplicate entry through shelter-authorized integrations and validated CSV imports.

Connect existing organization and application functionality into one clear journey: verify organization ownership → preview import and errors → publish approved records → receive inquiries → assign staff → arrange a visit → confirm outcome. Provide import receipts and correction/withdrawal tools. An unclaimed directory entry must not imply someone is monitoring its inbox.

RescueGroups is an immediate integration candidate already represented in the code. Its public documentation describes animal and organization search and an API-key application process. Confirm current terms and account scope before expanding use. Other providers listed in `api/sources.js` are integration candidates, not proven partnerships.

Acceptance: a participating shelter completes onboarding and an adoption inquiry with independent accounts; unauthorized organization access is denied; imports can be retried safely; no duplicate pet entry is required for subsequent updates.

## Priority 3: discovery that helps people decide

Keep the map and mobile workflow central. Add server-side radius and location search, useful filters, saved searches with opt-in alerts, shareable individual pet pages, and shelter profiles linked to current animals. Display availability evidence and unknown compatibility details clearly.

Expand species across schema, normalization, API filters, matching, and UI together. Petfinder already serves animals beyond dogs and cats; Pawline should not claim comprehensive pet coverage while its ingestion/search is restricted to those two species.

Acceptance: representative mobile users can find a suitable nearby pet and reach its responsible shelter; unknown traits never become invented matches; saved alerts respect changed status and user preferences; empty regional coverage is stated plainly.

## Priority 4: dependable chat and video meet-and-greets

Improve the existing implementation rather than introducing another messaging system. Keep the pet, organization, assigned staff, application, and meeting context connected. Show accurate delivery/unread states and notification preferences. Support blocking/reporting and reconnect without duplicate messages.

For video, provide scheduling, timezone-aware confirmations, camera/microphone preview, audio-only fallback, missed-call handling, and a return to the same conversation. Preserve relay-only production configuration and short-lived TURN credentials. Recording should remain off unless a separately designed, explicit consent flow is introduced.

Acceptance: two real accounts exchange messages and make a call on separate networks; mobile permissions denied/retried, disconnect/reconnect, decline, timeout, and hangup release media correctly; nonparticipants cannot retrieve messages or call signals. Measure call connection success and connection time without collecting media content.

## Priority 5: lost-and-found and geographic expansion

If “finding pets” includes missing pets, introduce distinct lost reports, found reports, shelter intake matches, nearby alerts, and reunited outcomes. Do not mix these records into adoptable inventory. Use approximate public locations, private contact relay, ownership verification, and false-claim reporting; avoid public foster-home addresses and sensitive identification details.

Expand country by country only after local data sources, address formats, languages, shelter practices, and support coverage are established. A global map is not global inventory coverage.

## Release sequence and measures

1. **Inventory baseline and search contract:** measure coverage/freshness, audit adapter permissions, define canonical identity and pagination, and publish source health based on observed runs.
2. **Canonical ingestion and shelter pilot:** ship schema migrations and authorized adapters with rollback, then prove import-to-inquiry with participating organizations.
3. **Adopter and communication journey:** verify search → pet → shelter → chat → video → application with separate accounts and real provider delivery.
4. **Regional expansion:** increase source and shelter participation only while freshness, response times, and import reliability meet the pilot targets.
5. **Additional species, lost-and-found, and countries:** release each with its own data and end-to-end acceptance evidence.

Proposed pilot targets, to calibrate after measuring a baseline: 95% of active inventory observed within the source's agreed freshness window; under 1% confirmed duplicate rate in a reviewed sample; p95 search API latency below 500 ms under documented expected load; at least 95% call connection success in supported-device tests. These are goals, not present results or public guarantees.

Track successful shelter connections and confirmed adoption outcomes alongside inventory size. For comparative claims, use the same date, geography, species, availability definition, and deduplication method. Petfinder's advertised organization count cannot establish a comparable unique-pet count.

No production changes, provider applications, outreach messages, or paid services were initiated by this roadmap.

## Research sources

- [Petfinder public homepage](https://www.petfinder.com/), accessed September 8, 2026: self-reported shelter/rescue network size and discovery categories.
- [RescueGroups Adoptable Pet Data API](https://rescuegroups.org/services/adoptable-pet-data-api/), accessed September 8, 2026: animal/organization search and API access process.
- [RescueGroups API Terms of Service](https://rescuegroups.org/api-terms-of-service/): source to review during integration acceptance, including display obligations.

This is a bounded public-product comparison, not an authenticated feature audit of Petfinder; no claim is made that Petfinder lacks any particular communication feature.
