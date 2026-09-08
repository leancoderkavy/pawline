CREATE TABLE IF NOT EXISTS adoption_appointments (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  proposed_by text NOT NULL,
  caregiver_id text,
  kind text NOT NULL CHECK (kind IN ('video', 'visit')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '30 minutes'),
  time_zone text NOT NULL,
  state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'confirmed', 'cancelled', 'elapsed', 'completed', 'missed')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 600),
  next_step text CHECK (next_step IN ('continue_application', 'request_information', 'schedule_visit', 'withdraw_interest')),
  next_step_by text,
  room_name text UNIQUE,
  room_ready boolean NOT NULL DEFAULT false,
  room_closed boolean NOT NULL DEFAULT false,
  last_call_ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adoption_appointments_conversation ON adoption_appointments(conversation_id, starts_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS adoption_appointments_one_upcoming ON adoption_appointments(conversation_id) WHERE state IN ('proposed', 'confirmed');
CREATE TABLE IF NOT EXISTS appointment_email_preferences (
  appointment_id uuid NOT NULL REFERENCES adoption_appointments(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (appointment_id, user_id)
);
CREATE TABLE IF NOT EXISTS appointment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES adoption_appointments(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('updated', 'reminder')),
  due_at timestamptz NOT NULL,
  sent_at timestamptz,
  discarded boolean NOT NULL DEFAULT false,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  UNIQUE (appointment_id, revision, user_id, kind)
);
CREATE INDEX IF NOT EXISTS appointment_notifications_due ON appointment_notifications(due_at) WHERE sent_at IS NULL AND NOT discarded;
CREATE TABLE IF NOT EXISTS appointment_attendance (
  appointment_id uuid NOT NULL REFERENCES adoption_appointments(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  participant_id text NOT NULL,
  first_joined_at timestamptz NOT NULL,
  last_left_at timestamptz,
  PRIMARY KEY (appointment_id, revision, participant_id)
);
CREATE TABLE IF NOT EXISTS appointment_webhook_events (
  id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS appointment_video_budget (
  month date PRIMARY KEY,
  reserved_minutes integer NOT NULL DEFAULT 0 CHECK (reserved_minutes >= 0)
);
CREATE TABLE IF NOT EXISTS appointment_video_reservations (
  appointment_id uuid NOT NULL REFERENCES adoption_appointments(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  reserved_minutes integer NOT NULL,
  PRIMARY KEY (appointment_id, revision)
);
