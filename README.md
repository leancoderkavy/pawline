# Pawline

Pawline combines authorized adoption feeds and moderated community submissions.

## MCP server

Pawline's read-only MCP server exposes current pet search, adoption-source
status, and service health to compatible AI clients:

```bash
npx -y pawline-mcp
```

See [`mcp/README.md`](mcp/README.md) for client configuration and capability
boundaries. Availability is time-sensitive and must be confirmed with the
linked shelter.

## Database and ingestion

1. Run `npm run db:migrate:dry-run` to parse the local schema and verify required migration artifacts without opening a database connection, then create a Postgres database and run `db/schema.sql`.
2. Optionally run `db/public_sources.sql` to install the reviewed Montgomery
   County and King County definitions. Reviewed public feeds are enabled by
   that migration.
3. Set `DATABASE_URL` and a random `CRON_SECRET` in Vercel.
4. Add a row to `sources` with `enabled = false`.
5. Put the provider's canonical field names in `parser_config.mapping`; JSON feeds
   may also set `records_path`.
6. Test the source, confirm permission and attribution, then enable it.

Example parser configuration:

```json
{
  "records_path": "animals",
  "mapping": {
    "external_id": "id",
    "name": "name",
    "species": "species",
    "breed": "breed",
    "city": "location.city",
    "country": "location.country",
    "image_url": "photo",
    "source_url": "adoption_url"
  }
}
```

Parser configurations may also use `constants`, per-field `value_maps`, and
`strip_html_fields`. See `db/public_sources.sql` for reviewed examples.

Vercel calls `/api/cron/ingest` four times daily (00:00, 06:00, 12:00, and
18:00 UTC). The Python importer accepts
authorized HTTPS JSON, CSV, and published Google Sheet CSV feeds; it does not
scrape HTML. It sends conditional requests, limits response size, rejects local
network destinations, records each run, and upserts duplicate records.
Listings missing from two consecutive successful, non-empty snapshots are
marked `unavailable`; disappearance is never treated as proof of adoption.

Community submissions use `/api/submissions` and remain `pending` until a
reviewer changes the record to `available` and sets `verified_at`.

Pawline is a mobile-friendly pet adoption discovery app for finding adoptable
dogs and cats, browsing nearby organizations on a map, viewing adoption events,
and submitting community listings.

## Adoption matchmaker

The discovery screen includes a seven-question lifestyle quiz covering home
type, activity level, children, existing pets, time alone, adopter experience,
and species preference. Matching is deterministic and runs in
`src/matching.js`; it does not make adoption decisions.

Each result separates:

- listing facts that support the match,
- possible conflicts disclosed by the listing, and
- missing compatibility details to confirm with the shelter.

Scores are an ordering aid, not a guarantee. Pawline never fills missing listing
attributes with generated claims, and it links back to the shelter for current
availability and final adoption decisions.

After the quiz, adopters can explicitly request a bounded AI compatibility
draft. The server sends only quiz answers and public listing facts through
Vercel AI Gateway; contact information, account data, and medical records are
excluded. AI output is independently validated, capped below a perfect score,
and presented as questions and evidence to review with the shelter—not an
adoption decision or compatibility guarantee.

The scheduled importer also refreshes Pasadena Humane's official dog-adoption
calendar four times daily. Upcoming events are listed with their source links,
and live event coordinates appear alongside geolocated pets on the map.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Production integrations

Copy `.env.example` to `.env.local` for local development. All provider
credentials stay in server-side Vercel functions; do not prefix them with
`VITE_`.

### Government open data — adoptable pets

`/api/pets` reads two credential-free official feeds directly:

- Montgomery County Animal Services adoptable pets, refreshed every two hours.
- Regional Animal Services of King County records explicitly marked
  `ADOPTABLE`.

Both adapters retain official shelter attribution and source links, accept only
dogs and cats, normalize provider fields, and return partial/error status when a
feed is unavailable. No synthetic fallback records are returned.

### RescueGroups — adoptable pets

The server-side adapter at `/api/pets` uses the RescueGroups v5 public API.
Request one API key specifically for Pawline, accept the provider terms, and set:

```text
RESCUEGROUPS_API_KEY
```

Without the key, the government feeds remain active and RescueGroups is omitted
from the provider list.

### Neon — submissions and verified events

Create a Neon Postgres database, run `db/schema.sql`, and set:

```text
DATABASE_URL
CRON_SECRET
```

Community submissions remain private and `pending` until manually verified.
Only events with `status = 'published'` and pets with `status = 'available'`
plus a `verified_at` timestamp are returned publicly.

### Mapbox — location search and maps

Create a URL-restricted Mapbox access token and set:

```text
MAPBOX_ACCESS_TOKEN
```

Pawline proxies geocoding and static-map requests through server-side routes so
the token is not shipped in the Vite bundle. Geocoding is temporary and results
are used for the current search session; do not persist coordinates unless the
Mapbox account and request are configured for permanent geocoding.

### Resend — moderation and acknowledgement email

Verify a sending domain in Resend, create a sending-only API key, and set:

```text
RESEND_API_KEY
PAWLINE_FROM_EMAIL=Pawline <adoptions@your-domain.example>
PAWLINE_MODERATION_EMAIL=team@your-domain.example
```

Each accepted submission triggers an internal review alert and a submitter
acknowledgement. Email delivery failure is logged but does not discard the
saved submission.

### List a pet document intake

The List a Pet flow accepts multiple PDF, TXT, JPG, PNG, and WebP files (3 MB
combined). `/api/extract-submission` sends those files through the Vercel AI SDK
and AI Gateway to create an editable draft from directly supported facts.
Submitters must review the draft and attest to their authority, complete
medical/behavior disclosure, and local transfer-law compliance before the
listing is saved.

Uploaded records are stored in `pet_submission_files`; they are not public.
Only the selected primary photo becomes readable after moderators change the
pet to `available`. `pet_submission_log` records submission and AI-extraction
events. Apply `db/schema.sql` before enabling the flow. AI Gateway uses Vercel
deployment OIDC when available, or `AI_GATEWAY_API_KEY` outside that environment.

### Provider readiness

`GET /api/health` reports the two active public feeds and whether RescueGroups,
Neon, Mapbox, Resend, and the scheduled importer are configured without
exposing credentials.

### AI SEO review pipeline

The AI SEO pipeline creates source-grounded education drafts for **human
review**. It does not publish a page, update the sitemap, or make a draft
indexable. A Tuesday/Friday Vercel cron processes one queued job at a time. It
uses Tavily only to collect public HTTPS research snippets, asks AI Gateway for
a structured draft grounded in those snippets, and rejects draft outputs that
fail deterministic checks for citation coverage, length, slug and metadata
format, unsupported source URLs, or unsafe certainty/advice claims.

Apply `db/schema.sql`, then set these server-only variables:

```text
DATABASE_URL
CRON_SECRET
SEO_PIPELINE_SECRET
TAVILY_API_KEY
AI_GATEWAY_API_KEY
PAWLINE_SEO_MODEL=google/gemini-2.5-flash-lite
```

Queue a brief with the private operator endpoint. The `SEO_PIPELINE_SECRET` is
different from the cron secret and must never be exposed in browser code:

```bash
curl -X POST https://www.pawlineadopt.com/api/seo-pipeline \
  -H "Authorization: Bearer $SEO_PIPELINE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"focusKeyword":"how to prepare to adopt a dog","intent":"informational","audience":"first-time dog adopters","location":"Los Angeles","angle":"A practical, source-backed checklist"}'
```

The response returns a job id. Retrieve the private review artifact with:

```bash
curl "https://www.pawlineadopt.com/api/seo-pipeline?job=JOB_UUID" \
  -H "Authorization: Bearer $SEO_PIPELINE_SECRET"
```

Jobs can become `needs_review`, `needs_revision`, or `error`; none of these
states exposes content publicly. A human must validate citations and product
claims, edit as necessary, then make a separately authorized publishing change.

### Shelter source enrichment and confirmation email

Scheduled web discovery can queue recent public adoption-page leads for private
operator review. The shelter workflow sends only the stored public title,
snippet, HTTPS source URL/domain, city, and species hint to AI Gateway. It
extracts a cited review record for these data points: organization, official
domain, location, adoption/listing/feed URLs and format, dog/cat coverage,
freshness evidence, terms, attribution, and any public contact information.
It does not browse new pages, infer missing data, verify a shelter, activate a
source, publish a listing, or send email automatically.

Apply `db/schema.sql`, then set these server-only values. Keep both enable flags
unset or `false` during setup; they are independent from the administrator
secret so a leaked review credential cannot enable paid AI calls or email.

```text
SHELTER_OUTREACH_SECRET
SHELTER_OUTREACH_MODEL=google/gemini-2.5-flash-lite
SHELTER_OUTREACH_MONTHLY_MAX_GENERATIONS=10
SHELTER_OUTREACH_DAILY_EMAIL_LIMIT=20
SHELTER_OUTREACH_AI_ENABLED=false
SHELTER_OUTREACH_SEND_ENABLED=false
```

The private `/api/shelter-outreach` endpoint requires
`Authorization: Bearer $SHELTER_OUTREACH_SECRET`. Queue candidates with
`{"action":"queue-discoveries"}`. For one candidate, explicitly confirm
`consentToAiProcessing: true` before the `enrich` action. A human must then
record a reviewed contact email and an official-domain contact-source URL with
the `approve-draft` action. The resulting email is still unsent; `send-email`
additionally requires the exact `sendConfirmation` value and
`SHELTER_OUTREACH_SEND_ENABLED=true`.

Each send has a bounded daily limit, an internal outbox row, and a stable
Resend idempotency key. If delivery is uncertain or rejected, Pawline leaves
the draft for human review rather than retrying or sending a follow-up
automatically. Register delivery webhooks separately before relying on delivery
or bounce state as proof of receipt.

Adopt-a-Pet is intentionally not enabled by default. Its API requires a signed
partnership agreement, provider approval of the implementation, shelter notice,
and required attribution. Ticketmaster is also not used as an adoption-event
source: keyword matches do not establish that an organizer is authorized or
that an event is actually an adoption event.

### Organization claims, hours, and applications

The adoption platform adds canonical `organizations`, locations, hours,
memberships, claim tokens, verification events, and a nullable `organization_id`
on pets and sources. Existing shelter names are never automatically merged.
Claim links are 32-byte random values stored only as hashes, expire in seven
days, bind to the recipient's verified Clerk email, and are consumed atomically
with the administrator membership. Set `PAWLINE_CANONICAL_ORIGIN` to the
canonical HTTPS site; claim URLs never use a request Host header.

`/api/resend-webhook` is a dedicated raw-body Next route. Set
`RESEND_WEBHOOK_SECRET` and configure Resend to send `email.sent`,
`email.delivered`, `email.bounced`, and `email.complained`. Events are replay
safe by Svix delivery id. Bounces and complaints suppress that recipient
globally. Opt-out links remain activation-blocked until their signed endpoint
is implemented. This implementation creates reviewed outbox records only;
it does not authorize production shelter outreach or a provider send.

Draft and held applications remain private. A claimed organization can only
read a submitted application after the adopter selects the exact fields to
share. Held unclaimed-organization data requires explicit consent and must be
purged by the protected daily `/api/cron/purge-held-applications` job after its
30-day hold window. When the pet is already linked to an unclaimed canonical
organization with a reviewed HTTPS site and same-domain public contact address,
Pawline queues only a deduplicated, suppressed-aware **invitation-needed**
outbox record. It does not mint a claim link or send mail at application
creation. If the organization/contact is absent or insufficiently verified,
the application response truthfully reports `manual_contact_required`; shelter
name strings are never auto-merged.

`/api/organization-reviews` is a conservative review foundation. An adopter
can create one verified review only from their submitted, organization-linked
application; it enters `pending` moderation and is never publicly visible by
default. The public endpoint returns only published, verified reviews. An
organization administrator may make one safety-filtered reply to a published
review or file an appeal for Pawline moderation. Organization workspaces never
receive pending or rejected reviewer narratives; they can see only published
reviews and an appealed review that was previously public. The protected
`/pawline-moderation/reviews` route is available only to the verified Clerk
email configured in `PAWLINE_MODERATION_EMAIL`, and may publish or reject a
pending/appealed review. Evidence uploads and evidence access remain unavailable
until isolated evidence storage is separately authorized.

### Optional OpenRouter assistance

The application coach and intake summary are optional, structured,
suggest-only helpers. To make any private task available, set every server-only
control below after an evaluation and privacy review:

```text
OPENROUTER_ENABLED=true
OPENROUTER_LIVE_CALLS_ENABLED=true
OPENROUTER_API_KEY=...
OPENROUTER_ZDR=true
OPENROUTER_DATA_COLLECTION=deny
OPENROUTER_ALLOWED_MODELS=one-reviewed-model
OPENROUTER_ALLOWED_PROVIDERS=one-reviewed-provider
OPENROUTER_APPLICATION_COACH_MODEL=one-reviewed-model
OPENROUTER_INTAKE_SUMMARIZER_MODEL=one-reviewed-model
```

Every task model must be in its immutable allowlist and cannot be
`openrouter/auto`. Requests use a fixed provider allowlist, disable fallbacks,
require supported parameters, set `data_collection: "deny"`, and set `zdr:
true`. Pawline stores metadata only: task, request id, prompt/schema version,
model/provider, latency, and token counts—never prompts, answers, messages,
documents, addresses, or contact details. Durable subject, organization, and
global limits run before any request.

This checkout has AI SDK 7 but not the official
`@openrouter/ai-sdk-provider` package in its lockfile. The disabled-by-default
server transport therefore uses OpenRouter's documented structured
chat-completions request shape. Before enabling production spend, add the
reviewed official adapter, preserve the same no-fallback/ZDR contract, and
rerun the frozen task evaluations. The server rejects invalid structured output,
uncited summary assertions, and decision language; AI cannot score, rank,
approve, decline, or act on an application.

### Shelter messaging and private video calls

Open **Messages → Listing chats** (`/#messages`). Adopters can start a thread
from the **Message** button on an available, verified Pawline pet. Shelter staff
can also open the inbox from **Shelter workspace → Adoption questions**. The
inbox includes search, unread/open/resolved filters, and a Shelter inbox filter.
Each conversation has paginated history, per-person unread counts, draft text
while switching conversations, retry-safe sends, reporting, resolve/reopen, and
block/unblock controls. Drafts remain in memory and clear when the user leaves
Messages or signs out; messages persist in PostgreSQL.

Canonical `pets.organization_id` links and current `organization_memberships`
give a shelter team access to its conversations. A shelter name alone never
grants access. Available, verified listings without a canonical organization
continue to use their individual claimed owner. Team membership is rechecked
on every API request, including reporting and video signaling. Removed team
members lose access even if they originally owned the thread. Migration only
shares legacy owner threads where that owner already belongs to the pet's
explicitly linked organization.

`/api/direct-conversations`, `/api/direct-messages`, `/api/direct-message-report`,
and `/api/direct-video` require verified Clerk bearer tokens and a migrated
database. Direct messages retain the existing moderation rules and durable
rate limits. Message creation requires a UUID `clientMessageId`; clients reuse
it when retrying the same send. Newest messages load first in pages of 60, with
a `before` UUID cursor for older history. The inbox returns up to 200 recent
conversations. `PATCH /api/direct-conversations` supports `read` (with the last
visible `messageId`), `resolve`, `reopen`, `block`, and `unblock`. Blocking pauses
both messages and calls; only the account that blocked can remove its block.

Ably is optional for listing chat. With `ABLY_API_KEY`, the server publishes
content-free invalidations to each participant's private channel; the client
reloads through authenticated APIs. Five-second polling while Messages is
visible provides a fallback and picks up missed events/new inquiries. No email,
push, or background ringing is sent. Arrange a time in chat and keep Messages
open to receive an incoming video invitation.

Video calls are one-to-one, scoped to the conversation, and require explicit
acceptance. Either side can invite; a single shelter staff member can accept.
The camera/microphone stay off until **Preview devices** is selected. The user
then chooses **Start call** or **Accept and join**. Controls include mute,
camera off, decline, cancel, and hang up. Leaving closes the peer connection
and stops media tracks. The server expires unanswered invitations after 90
seconds (or a 45-second caller heartbeat timeout), disconnected accepted calls
after 45 seconds, and all calls after one hour. Pawline does not record media.
Only the caller and accepted recipient can access SDP/ICE signaling; other
shelter staff can see call status. The implementation follows the browser
[WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API).

Before enabling production:

1. Run `npm run db:migrate:dry-run`, then apply `npm run db:migrate` against the
   intended database as a reviewed migration. The migration is idempotent and
   request handlers never create tables. Deploy schema before application code.
2. Configure `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and the
   authorized origins. The local test fixture does not exercise live Clerk.
3. Configure a coturn-compatible relay with `PAWLINE_TURN_URLS` (comma-separated
   `turn:`/`turns:` URLs) and server-only `PAWLINE_TURN_SHARED_SECRET`. The server
   issues per-call HMAC credentials valid for 65 minutes. Production uses
   relay-only ICE; the TURN shared secret never reaches the browser. Relay
   hosting/provider billing must be configured separately.
4. Set `PAWLINE_VIDEO_ENABLED=true` only after testing the relay over separate
   networks. `PAWLINE_VIDEO_ALLOW_DIRECT=true` is for local development and is
   ignored in production. With missing relay configuration, chat stays usable
   and the Video call action explains that calling is unavailable.
5. Configure `CRON_SECRET` and ensure `/api/cron/purge-video-signals` runs every
   15 minutes as specified in `vercel.json`. Hangup/block/resolve delete signaling
   immediately; session reads remove expired signaling too. The scheduled job
   handles abandoned sessions. Signals older than 70 minutes are deleted on the
   next job, so worst-case scheduled retention is approximately 85 minutes.
   Call status metadata remains for the conversation's recent-call history.

`/api/health` exposes configuration booleans for direct messaging and video;
these do not prove that the database is migrated or the relay works.

Validation:

- `npm test` includes real PostgreSQL integration tests using disposable PGlite
  storage and the production handler factories. No production DB writes occur.
- `npm run test:chat` runs the actual chat components and handlers on a loopback
  fixture server, with two isolated users and Chromium simulated media devices.
  It exercises persistence, mobile interaction, moderation, unread counts,
  failure recovery, and actual WebRTC media between two browser contexts.
  Install Chromium with `npx playwright install chromium` if needed. Traces and
  screenshots are written to the OS temporary directory.
- The fixture identity resolver exists only under `e2e/`; the production app
  imports neither that resolver nor its database. No auth bypass is enabled by
  an environment flag. Live Clerk, Ably, and cross-network TURN checks remain
  separate deployment checks.
