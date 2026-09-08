-- Disposable public location snapshots and refresh leases; no user identifiers.
CREATE TABLE IF NOT EXISTS shelter_search_cache (
  cache_key text PRIMARY KEY CHECK (char_length(cache_key) <= 80),
  payload jsonb,
  observed_at timestamptz,
  retry_at timestamptz NOT NULL DEFAULT now()
);
