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

1. Create a Postgres database and run `db/schema.sql`.
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
