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
  claimed_by_clerk_user_id text,
  claimed_by_display_name text,
  claimed_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS missed_syncs integer NOT NULL DEFAULT 0;
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS claimed_by_clerk_user_id text,
  ADD COLUMN IF NOT EXISTS claimed_by_display_name text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
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

CREATE TABLE IF NOT EXISTS pet_submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  media_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 3145728),
  content bytea NOT NULL,
  is_primary_photo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_submission_files_pet_id
  ON pet_submission_files (pet_id, created_at);

CREATE TABLE IF NOT EXISTS pet_submission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('submitted', 'ai_extracted', 'reviewed', 'published', 'rejected')),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_submission_log_pet_id
  ON pet_submission_log (pet_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS web_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  snippet text,
  source_url text NOT NULL UNIQUE,
  source_domain text NOT NULL,
  city text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  species text CHECK (species IS NULL OR species IN ('Dog', 'Cat')),
  status text NOT NULL DEFAULT 'current'
    CHECK (status IN ('current', 'stale', 'rejected')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_discoveries_fresh
  ON web_discoveries (status, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL DEFAULT 'community',
  clerk_user_id text NOT NULL,
  author_name text NOT NULL,
  author_image_url text,
  body text NOT NULL,
  link_preview jsonb,
  moderation_state text NOT NULL DEFAULT 'visible'
    CHECK (moderation_state IN ('visible', 'held', 'removed')),
  report_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_messages_room_created
  ON community_messages (room, created_at DESC);

-- AI SEO pipeline: drafts are deliberately private review artifacts. No table
-- in this group represents published or indexed content.
CREATE TABLE IF NOT EXISTS seo_content_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  focus_keyword text NOT NULL CHECK (char_length(focus_keyword) BETWEEN 3 AND 140),
  brief jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'researching', 'drafting', 'needs_review', 'needs_revision', 'error')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_message text,
  quality_report jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_content_jobs_queue
  ON seo_content_jobs (status, created_at ASC);

CREATE TABLE IF NOT EXISTS seo_content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES seo_content_jobs(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 6),
  title text NOT NULL,
  excerpt text NOT NULL,
  source_url text NOT NULL,
  source_domain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, position),
  UNIQUE (job_id, source_url)
);

CREATE TABLE IF NOT EXISTS seo_content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES seo_content_jobs(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  meta_description text NOT NULL,
  excerpt text NOT NULL,
  outline jsonb NOT NULL,
  article_markdown text NOT NULL,
  faq jsonb NOT NULL,
  citations jsonb NOT NULL,
  internal_links jsonb NOT NULL,
  quality_report jsonb NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Shelter source enrichment and confirmation workflow. These are private
-- operator records: enrichment, a contact reply, or a sent email never
-- publishes a source or activates a pet listing.
CREATE TABLE IF NOT EXISTS shelter_outreach_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_id uuid REFERENCES web_discoveries(id) ON DELETE SET NULL,
  source_url text NOT NULL UNIQUE,
  source_domain text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  data jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'enriching', 'needs_review', 'needs_revision', 'draft_ready', 'sending', 'sent', 'suppressed')),
  model text,
  enrichment_attempts integer NOT NULL DEFAULT 0 CHECK (enrichment_attempts >= 0),
  public_contact_email text,
  contact_name text,
  contact_source_url text,
  draft_subject text,
  draft_text text,
  draft_revision integer NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  review_note text,
  last_error text,
  reviewed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shelter_outreach_candidates_queue
  ON shelter_outreach_candidates (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS shelter_outreach_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES shelter_outreach_candidates(id) ON DELETE CASCADE,
  draft_revision integer NOT NULL CHECK (draft_revision > 0),
  recipient text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  resend_email_id text,
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, draft_revision)
);

CREATE INDEX IF NOT EXISTS shelter_outreach_emails_candidate_created
  ON shelter_outreach_emails (candidate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usage_limits (
  scope text NOT NULL,
  subject text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (scope, subject, window_started_at)
);

CREATE INDEX IF NOT EXISTS usage_limits_expiry
  ON usage_limits (window_started_at);

CREATE TABLE IF NOT EXISTS user_favorites (
  clerk_user_id text NOT NULL,
  listing_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clerk_user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS user_favorites_user_created
  ON user_favorites (clerk_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_clerk_user_id text NOT NULL,
  owner_name text NOT NULL,
  owner_image_url text,
  inquirer_clerk_user_id text NOT NULL,
  inquirer_name text NOT NULL,
  inquirer_image_url text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_clerk_user_id <> inquirer_clerk_user_id),
  UNIQUE (listing_id, owner_clerk_user_id, inquirer_clerk_user_id)
);

CREATE INDEX IF NOT EXISTS direct_conversations_owner_recent
  ON direct_conversations (owner_clerk_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS direct_conversations_inquirer_recent
  ON direct_conversations (inquirer_clerk_user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_clerk_user_id text NOT NULL,
  author_name text NOT NULL,
  author_image_url text,
  body text NOT NULL,
  moderation_state text NOT NULL DEFAULT 'visible'
    CHECK (moderation_state IN ('visible', 'held', 'removed')),
  report_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direct_messages_conversation_created
  ON direct_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS direct_message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  reporter_clerk_user_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_clerk_user_id)
);

CREATE TABLE IF NOT EXISTS community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
  reporter_clerk_user_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_clerk_user_id)
);

CREATE TABLE IF NOT EXISTS community_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by_clerk_user_id text NOT NULL,
  source_url text NOT NULL UNIQUE,
  source_domain text NOT NULL,
  name text,
  species text CHECK (species IS NULL OR species IN ('Dog', 'Cat')),
  breed text,
  age text,
  description text,
  image_url text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  verification_state text NOT NULL DEFAULT 'needs_confirmation'
    CHECK (verification_state IN ('needs_confirmation', 'confirmed', 'rejected')),
  parser_state text NOT NULL DEFAULT 'parsed'
    CHECK (parser_state IN ('parsed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
