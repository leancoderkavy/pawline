-- Additive migration; existing pets and private conversations are preserved.
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_species_check;
ALTER TABLE pets ADD CONSTRAINT pets_species_check CHECK (species IN ('Dog','Cat','Rabbit','Bird','Small animal','Horse','Reptile','Barnyard'));
CREATE INDEX IF NOT EXISTS pets_catalog_cursor ON pets (id) WHERE status = 'available' AND verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS pets_catalog_location ON pets (latitude, longitude) WHERE status = 'available';

CREATE TABLE IF NOT EXISTS saved_pet_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  filters jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clerk_user_id, name)
);
CREATE INDEX IF NOT EXISTS saved_pet_searches_owner ON saved_pet_searches (clerk_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lost_pet_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('lost','found')),
  species text NOT NULL CHECK (species IN ('Dog','Cat','Rabbit','Bird','Small animal','Horse','Reptile','Barnyard')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 120),
  event_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reunited','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lost_pet_reports_public ON lost_pet_reports (created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS lost_pet_reports_owner ON lost_pet_reports (clerk_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS lost_pet_report_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES lost_pet_reports(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lost_pet_report_tips_report ON lost_pet_report_tips (report_id, created_at DESC);
CREATE TABLE IF NOT EXISTS lost_pet_report_flags (
  report_id uuid NOT NULL REFERENCES lost_pet_reports(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, clerk_user_id)
);

CREATE TABLE IF NOT EXISTS direct_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  proposed_by text NOT NULL,
  starts_at timestamptz NOT NULL,
  timezone text NOT NULL,
  state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS direct_meetings_conversation ON direct_meetings (conversation_id, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS direct_meetings_slot ON direct_meetings (conversation_id, starts_at) WHERE state <> 'cancelled';
