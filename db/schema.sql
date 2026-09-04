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

-- Canonical organizations are deliberately independent from pet strings.
-- Backfills must be reviewed; do not infer an organization from a name.
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 240),
  kind text NOT NULL DEFAULT 'shelter'
    CHECK (kind IN ('municipal_shelter', 'shelter', 'rescue')),
  verification_state text NOT NULL DEFAULT 'unclaimed'
    CHECK (verification_state IN ('unclaimed', 'claimed', 'partially_verified', 'verified', 'stale')),
  official_domain text,
  official_url text,
  public_contact_email text,
  public_contact_phone text,
  intake_capacity text NOT NULL DEFAULT 'accepting'
    CHECK (intake_capacity IN ('accepting', 'limited', 'waitlist', 'paused')),
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_provenance jsonb NOT NULL DEFAULT '[]'::jsonb,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizations_verification_fresh
  ON organizations (verification_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS organizations_contact_email
  ON organizations (lower(public_contact_email)) WHERE public_contact_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label text,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text,
  latitude double precision,
  longitude double precision,
  visit_instructions text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_locations_one_primary
  ON organization_locations (organization_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS organization_locations_organization
  ON organization_locations (organization_id, is_primary DESC);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('member', 'administrator')),
  invited_by_clerk_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS organization_memberships_user
  ON organization_memberships (clerk_user_id, organization_id);

CREATE TABLE IF NOT EXISTS organization_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by_clerk_user_id text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK ((redeemed_at IS NULL) = (redeemed_by_clerk_user_id IS NULL))
);
CREATE INDEX IF NOT EXISTS organization_claim_tokens_redeem
  ON organization_claim_tokens (organization_id, expires_at DESC)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS organization_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES organization_locations(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  source text NOT NULL DEFAULT 'organization'
    CHECK (source IN ('organization', 'official_source', 'pawline_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, weekday),
  CHECK ((is_closed AND opens_at IS NULL AND closes_at IS NULL)
    OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);
CREATE TABLE IF NOT EXISTS organization_hour_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES organization_locations(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  note text,
  confirmed_at timestamptz,
  source text NOT NULL DEFAULT 'organization'
    CHECK (source IN ('organization', 'official_source', 'pawline_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, exception_date),
  CHECK ((is_closed AND opens_at IS NULL AND closes_at IS NULL)
    OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);

CREATE TABLE IF NOT EXISTS organization_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('identity', 'official_contact', 'hours', 'policies', 'listing_source', 'responsiveness')),
  state text NOT NULL CHECK (state IN ('unverified', 'confirmed', 'stale', 'rejected')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_type text NOT NULL CHECK (actor_type IN ('organization', 'pawline', 'system')),
  actor_clerk_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_verification_recent
  ON organization_verification_events (organization_id, dimension, created_at DESC);

ALTER TABLE pets ADD COLUMN IF NOT EXISTS organization_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_organization_id_fkey') THEN
    ALTER TABLE pets ADD CONSTRAINT pets_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pets_organization_public
  ON pets (organization_id, status, updated_at DESC) WHERE organization_id IS NOT NULL;

ALTER TABLE sources ADD COLUMN IF NOT EXISTS organization_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sources_organization_id_fkey') THEN
    ALTER TABLE sources ADD CONSTRAINT sources_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS sources_organization_id ON sources (organization_id) WHERE organization_id IS NOT NULL;

ALTER TABLE direct_conversations ADD COLUMN IF NOT EXISTS organization_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_conversations_organization_id_fkey') THEN
    ALTER TABLE direct_conversations ADD CONSTRAINT direct_conversations_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS direct_conversations_organization_recent
  ON direct_conversations (organization_id, last_message_at DESC) WHERE organization_id IS NOT NULL;

-- Private adopter records. They are never exposed by public organization APIs.
CREATE TABLE IF NOT EXISTS adopter_profiles (
  clerk_user_id text PRIMARY KEY,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  household jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_clerk_user_id text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS households_owner ON households (owner_clerk_user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS household_members (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'collaborator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS household_members_user ON household_members (clerk_user_id, household_id);

CREATE TABLE IF NOT EXISTS adoption_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  household_id uuid REFERENCES households(id) ON DELETE SET NULL,
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'awaiting_participation', 'submitted', 'reviewing', 'follow_up_needed',
    'meet_and_greet', 'approved', 'declined', 'withdrawn', 'adoption_pending', 'adopted', 'expired'
  )),
  core_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  add_on_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  hold_expires_at timestamptz,
  submitted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adoption_applications_adopter_recent
  ON adoption_applications (clerk_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS adoption_applications_organization_queue
  ON adoption_applications (organization_id, status, updated_at DESC) WHERE organization_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS adoption_application_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES adoption_applications(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  answer jsonb NOT NULL,
  scope text NOT NULL CHECK (scope IN ('core', 'organization', 'pet')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, question_key)
);
CREATE TABLE IF NOT EXISTS adoption_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES adoption_applications(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  media_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  shared_with_organization_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS adoption_application_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES adoption_applications(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  field_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS adoption_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES adoption_applications(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated', 'submitted', 'status_changed', 'message_sent', 'outcome_confirmed', 'expired')),
  actor_type text NOT NULL CHECK (actor_type IN ('adopter', 'organization', 'pawline', 'system')),
  actor_clerk_user_id text,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adoption_application_events_history
  ON adoption_application_events (application_id, created_at ASC);
CREATE TABLE IF NOT EXISTS adoption_application_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES adoption_applications(id) ON DELETE CASCADE,
  sender_clerk_user_id text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('adopter', 'organization', 'pawline')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adoption_application_messages_history
  ON adoption_application_messages (application_id, created_at ASC);
CREATE TABLE IF NOT EXISTS adoption_outcome_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES adoption_applications(id) ON DELETE CASCADE,
  confirmed_by_clerk_user_id text NOT NULL,
  confirmer_role text NOT NULL CHECK (confirmer_role IN ('adopter', 'organization')),
  outcome text NOT NULL CHECK (outcome IN ('adopted', 'not_adopted', 'placement_continues', 'placement_changed')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, confirmer_role)
);

CREATE TABLE IF NOT EXISTS adoption_placement_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES adoption_applications(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  adopter_confirmed_at timestamptz,
  placement_state text CHECK (placement_state IN ('continues', 'changed', 'prefer_not_to_say')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adoption_placement_checkins_due
  ON adoption_placement_checkins (due_at ASC) WHERE adopter_confirmed_at IS NULL;

-- Public official outreach is globally suppressed on recipient complaints,
-- bounces, or opt-outs. It is not driven by application content.
CREATE TABLE IF NOT EXISTS organization_email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint', 'opt_out', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('claim_invitation', 'hours_reminder', 'hours_stale')),
  freshness_cycle text NOT NULL DEFAULT 'initial' CHECK (char_length(freshness_cycle) BETWEEN 1 AND 80),
  idempotency_key text NOT NULL UNIQUE,
  resend_email_id text UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'opted_out', 'failed', 'expired')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, recipient_email, kind, freshness_cycle)
);
CREATE INDEX IF NOT EXISTS organization_outreach_messages_status
  ON organization_outreach_messages (status, created_at DESC);
CREATE TABLE IF NOT EXISTS organization_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_message_id uuid NOT NULL REFERENCES organization_outreach_messages(id) ON DELETE CASCADE,
  provider_event_id text UNIQUE,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'bounced', 'complained', 'opted_out')),
  received_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Organization reviews are verified interaction records, not a care-quality score.
CREATE TABLE IF NOT EXISTS organization_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id uuid REFERENCES adoption_applications(id) ON DELETE SET NULL,
  reviewer_clerk_user_id text NOT NULL,
  interaction_type text NOT NULL CHECK (interaction_type IN ('application', 'visit', 'foster', 'adoption')),
  interaction_at date,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  narrative text,
  moderation_state text NOT NULL DEFAULT 'pending' CHECK (moderation_state IN ('pending', 'published', 'rejected', 'appealed')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (moderation_state <> 'published' OR verified_at IS NOT NULL)
);
ALTER TABLE organization_reviews
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES adoption_applications(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organization_reviews_one_interaction
  ON organization_reviews (organization_id, reviewer_clerk_user_id, interaction_type, interaction_at) WHERE interaction_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organization_reviews_one_application
  ON organization_reviews (application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS organization_reviews_public
  ON organization_reviews (organization_id, created_at DESC) WHERE moderation_state = 'published';
CREATE TABLE IF NOT EXISTS organization_review_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES organization_reviews(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  media_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  delete_after timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_review_evidence_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES organization_review_evidence(id) ON DELETE CASCADE,
  actor_clerk_user_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('viewed', 'downloaded', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_review_evidence_access_history
  ON organization_review_evidence_access_log (evidence_id, created_at DESC);
CREATE TABLE IF NOT EXISTS organization_review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES organization_reviews(id) ON DELETE CASCADE,
  author_clerk_user_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_review_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES organization_reviews(id) ON DELETE CASCADE,
  submitted_by_clerk_user_id text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Metadata-only AI audit and evaluation records. Never persist prompts,
-- completions, answers, messages, documents, or contact details here.
CREATE TABLE IF NOT EXISTS ai_task_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  application_id uuid REFERENCES adoption_applications(id) ON DELETE CASCADE,
  task text NOT NULL CHECK (task IN ('application_coach', 'intake_summarizer', 'match_explanation')),
  field_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_task_consents_user_task ON ai_task_consents (clerk_user_id, task, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ai_task_consents_application_task
  ON ai_task_consents (application_id, task) WHERE application_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS ai_task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  request_id text NOT NULL,
  clerk_user_id text,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  model text,
  provider text,
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'blocked', 'rejected')),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  cost_microunits integer CHECK (cost_microunits IS NULL OR cost_microunits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task, request_id)
);
CREATE INDEX IF NOT EXISTS ai_task_runs_task_recent ON ai_task_runs (task, created_at DESC);
CREATE TABLE IF NOT EXISTS ai_evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  model text NOT NULL,
  provider text NOT NULL,
  passed boolean NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Shared shelter messaging and private video sessions.
UPDATE direct_conversations c SET organization_id = p.organization_id
FROM pets p WHERE p.id = c.listing_id AND c.organization_id IS NULL
  AND p.organization_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM organization_memberships m
    WHERE m.organization_id = p.organization_id AND m.clerk_user_id = c.owner_clerk_user_id);
ALTER TABLE direct_conversations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'resolved'));
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS client_message_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS direct_messages_idempotency
  ON direct_messages (conversation_id, sender_clerk_user_id, client_message_id);
CREATE INDEX IF NOT EXISTS direct_messages_page
  ON direct_messages (conversation_id, created_at DESC, id DESC) WHERE moderation_state = 'visible';
CREATE TABLE IF NOT EXISTS direct_conversation_state (
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  last_read_at timestamptz,
  blocked_at timestamptz,
  PRIMARY KEY (conversation_id, clerk_user_id)
);
CREATE TABLE IF NOT EXISTS direct_video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  caller_user_id text NOT NULL,
  callee_user_id text,
  caller_name text NOT NULL,
  caller_is_inquirer boolean NOT NULL,
  state text NOT NULL DEFAULT 'ringing' CHECK (state IN ('ringing', 'accepted', 'declined', 'cancelled', 'ended', 'missed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  caller_seen_at timestamptz NOT NULL DEFAULT now(),
  callee_seen_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 seconds',
  CHECK (caller_user_id <> callee_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS direct_video_one_active
  ON direct_video_calls (conversation_id) WHERE state IN ('ringing', 'accepted');
CREATE INDEX IF NOT EXISTS direct_video_recent ON direct_video_calls (conversation_id, created_at DESC);
CREATE TABLE IF NOT EXISTS direct_video_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES direct_video_calls(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL,
  client_signal_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('offer', 'answer', 'candidate')),
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 65536),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, sender_user_id, client_signal_id)
);
CREATE INDEX IF NOT EXISTS direct_video_signals_call ON direct_video_signals (call_id, id);
