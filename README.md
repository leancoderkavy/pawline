# Pawline

Pawline is a mobile-friendly pet adoption discovery app for finding adoptable dogs and cats, browsing nearby organizations on a map, viewing adoption events, and submitting community listings.

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

The app includes a server-side RescueGroups adapter at `/api/pets`. Configure the following environment variable in Vercel:

```text
RESCUEGROUPS_API_KEY
```

Without the key, the app safely falls back to its curated demonstration data.
