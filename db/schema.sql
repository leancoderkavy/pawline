CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('api', 'json', 'csv', 'google_sheet')),
  url text,
  country_code text,
  attribution text,
  terms_url text,
  enabled boolean NOT NULL DEFAULT false,
  parser_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  etag text,
  last_modified text,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  external_id text,
  fingerprint text NOT NULL UNIQUE,
  name text NOT NULL,
  species text NOT NULL CHECK (species IN ('Dog', 'Cat')),
  breed text,
  age text,
  sex text,
  size text,
  description text,
  city text,
  country text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  shelter text,
  contact_email text,
  contact_phone text,
  image_url text,
  source_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'unavailable', 'adopted', 'rejected')),
  missed_syncs integer NOT NULL DEFAULT 0,
  submitted_by_email text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS missed_syncs integer NOT NULL DEFAULT 0;
ALTER TABLE pets
  DROP CONSTRAINT IF EXISTS pets_status_check;
ALTER TABLE pets
  ADD CONSTRAINT pets_status_check
  CHECK (status IN ('pending', 'available', 'unavailable', 'adopted', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS pets_source_external_unique
  ON pets (source_id, external_id)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pets_public_search
  ON pets (status, species, updated_at DESC);
CREATE INDEX IF NOT EXISTS pets_source_id ON pets (source_id);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'unchanged', 'success', 'error')),
  fetched_count integer NOT NULL DEFAULT 0,
  upserted_count integer NOT NULL DEFAULT 0,
  error text
);

CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  shelter text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adoption_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  external_id text,
  title text NOT NULL,
  venue text,
  city text,
  country text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  source_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS adoption_events_source_external_unique
  ON adoption_events (source_id, external_id)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
