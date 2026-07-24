# Pawline

Pawline combines authorized adoption feeds and moderated community submissions.

## Database and ingestion

1. Create a Postgres database and run `db/schema.sql`.
2. Set `DATABASE_URL` and a random `CRON_SECRET` in Vercel.
3. Add a row to `sources` with `enabled = false`.
4. Put the provider's canonical field names in `parser_config.mapping`; JSON feeds
   may also set `records_path`.
5. Test the source, confirm permission and attribution, then enable it.

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

Vercel calls `/api/cron/ingest` every four hours. The Python importer accepts
authorized HTTPS JSON, CSV, and published Google Sheet CSV feeds; it does not
scrape HTML. It sends conditional requests, limits response size, rejects local
network destinations, records each run, and upserts duplicate records.

Community submissions use `/api/submissions` and remain `pending` until a
reviewer changes the record to `available` and sets `verified_at`.

Pawline is a mobile-friendly pet adoption discovery app for finding adoptable
dogs and cats, browsing nearby organizations on a map, viewing adoption events,
and submitting community listings.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Live adoption data

The app includes a server-side RescueGroups adapter at `/api/pets`. Configure
the following environment variable in Vercel:

```text
RESCUEGROUPS_API_KEY
```

Without the key, the app safely falls back to its curated demonstration data.
