# Pawline

Pawline combines authorized adoption feeds and moderated community submissions.

## Database and ingestion

1. Create a Postgres database and run `db/schema.sql`.
2. Optionally run `db/public_sources.sql` to install the reviewed Montgomery
   County and King County definitions. They are inserted disabled.
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

### Provider readiness

`GET /api/health` reports the two active public feeds and whether RescueGroups,
Neon, Mapbox, Resend, and the scheduled importer are configured without
exposing credentials.

Adopt-a-Pet is intentionally not enabled by default. Its API requires a signed
partnership agreement, provider approval of the implementation, shelter notice,
and required attribution. Ticketmaster is also not used as an adoption-event
source: keyword matches do not establish that an organizer is authorized or
that an event is actually an adoption event.
