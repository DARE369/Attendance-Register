-- ============================================================
-- Staff mobile sign-in (docs/staff-signin-plan.md, Database changes;
-- amended by docs/staff-signin-audit.md)
--
-- Run in the Supabase SQL editor. Idempotent: safe to run twice.
-- Existing gate-scanner records keep working: new log columns default to
-- 'scanner' or are null.
--
-- Differences from the plan:
--   * No app_settings table. Settings live in the existing school_settings
--     key/value table (seeded at the bottom).
--   * One active passkey per staff member is enforced by a partial unique index.
--   * Indexes for the lookups the API makes (rate limits, review inbox).
--
-- New tables have row level security ON with no policies: the backend uses the
-- service-role key (bypasses RLS) and the public anon key can read nothing.
-- ============================================================


-- 1. Existing tables --------------------------------------------------------

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS accuracy_limit_m INT;          -- null = use school default

ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_accuracy_limit_m_check;
ALTER TABLE teachers ADD CONSTRAINT teachers_accuracy_limit_m_check
  CHECK (accuracy_limit_m IS NULL OR accuracy_limit_m BETWEEN 10 AND 100);

ALTER TABLE teacher_attendance_logs
  ADD COLUMN IF NOT EXISTS check_in_method    TEXT DEFAULT 'scanner', -- scanner | mobile | correction
  ADD COLUMN IF NOT EXISTS check_in_verified  BOOLEAN,
  ADD COLUMN IF NOT EXISTS check_in_reasons   TEXT[],
  ADD COLUMN IF NOT EXISTS check_in_evidence  JSONB,    -- lat, lng, accuracy_m, distance_m, zone_version, install_id, credential_id, user_reason
  ADD COLUMN IF NOT EXISTS check_in_review    JSONB,    -- {by, at, decision, note}
  ADD COLUMN IF NOT EXISTS check_out_method   TEXT,
  ADD COLUMN IF NOT EXISTS check_out_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS check_out_reasons  TEXT[],
  ADD COLUMN IF NOT EXISTS check_out_evidence JSONB,
  ADD COLUMN IF NOT EXISTS check_out_review   JSONB;

-- Review inbox: unverified records not yet reviewed
CREATE INDEX IF NOT EXISTS idx_tal_check_in_unverified
  ON teacher_attendance_logs (scan_date)
  WHERE check_in_verified = false AND check_in_review IS NULL;
CREATE INDEX IF NOT EXISTS idx_tal_check_out_unverified
  ON teacher_attendance_logs (scan_date)
  WHERE check_out_verified = false AND check_out_review IS NULL;


-- 2. Passkeys (one active per staff member) ---------------------------------

CREATE TABLE IF NOT EXISTS staff_passkeys (
  credential_id TEXT        PRIMARY KEY,                 -- base64url
  teacher_id    UUID        NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  public_key    TEXT        NOT NULL,                    -- base64url
  sign_count    BIGINT      NOT NULL DEFAULT 0,
  transports    TEXT[],
  backed_up     BOOLEAN,
  install_id    TEXT,
  device_label  TEXT,
  status        TEXT        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'pending_approval', 'revoked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_passkeys_one_active
  ON staff_passkeys (teacher_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_staff_passkeys_teacher ON staff_passkeys (teacher_id);
CREATE INDEX IF NOT EXISTS idx_staff_passkeys_install ON staff_passkeys (install_id);


-- 3. Emailed codes and admin setup codes ------------------------------------

CREATE TABLE IF NOT EXISTS staff_login_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID        NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  code_hash   TEXT        NOT NULL,
  purpose     TEXT        NOT NULL CHECK (purpose IN ('enroll', 'login')),
  created_by  TEXT,                                      -- admin id for setup codes, null for emailed
  attempts    INT         NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate limit: codes requested per staff member in the last 15 minutes
CREATE INDEX IF NOT EXISTS idx_staff_login_codes_teacher
  ON staff_login_codes (teacher_id, created_at DESC);


-- 4. Single-use passkey challenges (shared across server workers) -----------

CREATE TABLE IF NOT EXISTS staff_challenges (
  challenge   TEXT        PRIMARY KEY,
  teacher_id  UUID        REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  purpose     TEXT        NOT NULL CHECK (purpose IN ('register', 'login', 'sign_in', 'sign_out')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_challenges_expires ON staff_challenges (expires_at);


-- 5. Zone circles, versioned ------------------------------------------------

CREATE TABLE IF NOT EXISTS campus_zones (
  zone_id     UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  version     INT              NOT NULL,
  name        TEXT             NOT NULL,
  center_lat  DOUBLE PRECISION NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng  DOUBLE PRECISION NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
  radius_m    INT              NOT NULL CHECK (radius_m BETWEEN 20 AND 500),
  is_active   BOOLEAN          NOT NULL DEFAULT true,
  created_by  TEXT,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campus_zones_version ON campus_zones (version DESC);


-- 6. Survey readings taken while mapping ------------------------------------

CREATE TABLE IF NOT EXISTS campus_survey_points (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  accuracy_m   DOUBLE PRECISION NOT NULL,
  zone_version INT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);


-- 7. Correction requests ----------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID        NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  scan_date    DATE        NOT NULL,
  kind         TEXT        NOT NULL CHECK (kind IN ('check_in', 'check_out')),
  claimed_time TIME        NOT NULL,
  reason       TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  TEXT,
  reviewed_at  TIMESTAMPTZ,
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrections_status  ON attendance_corrections (status, created_at);
CREATE INDEX IF NOT EXISTS idx_corrections_teacher ON attendance_corrections (teacher_id, scan_date DESC);


-- 8. Reminders already sent (prevents duplicates) ---------------------------

CREATE TABLE IF NOT EXISTS staff_reminders_sent (
  teacher_id UUID        NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  scan_date  DATE        NOT NULL,
  kind       TEXT        NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, scan_date, kind)
);


-- 9. Row level security: on, no policies ------------------------------------

ALTER TABLE staff_passkeys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_login_codes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_challenges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_zones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_survey_points   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_reminders_sent   ENABLE ROW LEVEL SECURITY;


-- 10. Settings (existing school_settings key/value table) -------------------

INSERT INTO school_settings (key, value) VALUES
  ('staff_accuracy_default_m',  '50'),   -- default GPS accuracy limit (m); per-staff override up to 100
  ('staff_unverified_wait_s',   '60'),   -- seconds before "Sign in anyway" appears (30-120)
  ('staff_reminders_enabled',   'false') -- turned on one week after rollout
ON CONFLICT (key) DO NOTHING;
