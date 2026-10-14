-- ============================================================
--  Peculiar Register — Complete Database Schema
--  Safe to run on a fresh Supabase project OR on top of an
--  existing database.  Every statement uses IF NOT EXISTS /
--  IF EXISTS / ADD COLUMN IF NOT EXISTS so it is fully
--  idempotent — running it twice causes no harm.
--
--  Run this in the Supabase SQL Editor.
-- ============================================================

-- Required extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    student_id   TEXT        PRIMARY KEY,
    full_name    TEXT        NOT NULL,
    class        TEXT        NOT NULL,
    parent_phone TEXT,
    parent_email TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);


-- ============================================================
-- 2. ADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    admin_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profile fields (added in session)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS email        TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone        TEXT;

-- Role / permission fields
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role        TEXT    NOT NULL DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions JSONB   DEFAULT '{}';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT true;

-- Enforce role values (safe to add even if column already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'admins' AND constraint_name = 'admins_role_check'
    ) THEN
        ALTER TABLE admins
            ADD CONSTRAINT admins_role_check
            CHECK (role IN ('super_admin', 'admin', 'scanner'));
    END IF;
END $$;

-- Promote the oldest admin to super_admin so the admin management UI unlocks
UPDATE admins
SET role = 'super_admin'
WHERE created_at = (SELECT MIN(created_at) FROM admins)
  AND role != 'super_admin';


-- ============================================================
-- 3. ATTENDANCE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
    log_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id     TEXT        NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    log_type       TEXT        NOT NULL CHECK (log_type IN ('arrival', 'departure')),
    comments       TEXT,
    entry_point    TEXT,
    is_holiday     BOOLEAN     NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_student   ON attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON attendance_logs(scan_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_type      ON attendance_logs(log_type);

-- Backfill column if table pre-dates the holiday flag
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- 4. NOTIFICATION SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_settings (
    setting_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id               UUID        NOT NULL REFERENCES admins(admin_id) ON DELETE CASCADE UNIQUE,
    email_enabled          BOOLEAN     NOT NULL DEFAULT true,
    whatsapp_enabled       BOOLEAN     NOT NULL DEFAULT true,
    notify_late_arrivals   BOOLEAN     NOT NULL DEFAULT true,
    notify_non_arrivals    BOOLEAN     NOT NULL DEFAULT true,
    notify_non_departures  BOOLEAN     NOT NULL DEFAULT true,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 5. STAFF TYPE CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_type_config (
    config_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_type            TEXT        NOT NULL UNIQUE,
    check_in_start        TIME        NOT NULL DEFAULT '06:30:00',
    check_in_end          TIME        NOT NULL DEFAULT '08:00:00',
    check_out_start       TIME                 DEFAULT '14:00:00',
    check_out_time        TIME        NOT NULL DEFAULT '15:00:00',
    check_out_end         TIME                 DEFAULT '18:00:00',
    grace_period_minutes  INT         NOT NULL DEFAULT 5,
    is_active             BOOLEAN     NOT NULL DEFAULT true,
    updated_at            TIMESTAMPTZ          DEFAULT now()
);

-- Add columns that may be missing on older deployments
ALTER TABLE staff_type_config ADD COLUMN IF NOT EXISTS check_out_start TIME        DEFAULT '14:00:00';
ALTER TABLE staff_type_config ADD COLUMN IF NOT EXISTS check_out_end   TIME        DEFAULT '18:00:00';
ALTER TABLE staff_type_config ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();


-- ============================================================
-- 6. TEACHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
    teacher_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name   TEXT        NOT NULL,
    staff_type  TEXT        NOT NULL REFERENCES staff_type_config(staff_type),
    barcode_id  TEXT        NOT NULL UNIQUE,
    phone       TEXT,
    email       TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 7. TEACHER ATTENDANCE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_attendance_logs (
    log_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id          UUID        NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    scan_date           DATE        NOT NULL,
    check_in_time       TIMESTAMPTZ,
    check_in_status     TEXT,
    check_in_comments   TEXT,
    check_out_time      TIMESTAMPTZ,
    check_out_status    TEXT,
    check_out_comments  TEXT,
    is_holiday          BOOLEAN     NOT NULL DEFAULT false,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (teacher_id, scan_date)
);

ALTER TABLE teacher_attendance_logs ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- 8. HOLIDAYS  (supports single-day and date-range periods)
-- ============================================================
CREATE TABLE IF NOT EXISTS holidays (
    holiday_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_name    VARCHAR(255) NOT NULL,
    holiday_date    DATE         NOT NULL,
    holiday_end_date DATE                    DEFAULT NULL,  -- NULL = single-day
    holiday_type    VARCHAR(20)  NOT NULL DEFAULT 'custom'
                    CHECK (holiday_type IN ('national', 'state', 'custom')),
    applies_to      VARCHAR(20)  NOT NULL DEFAULT 'both'
                    CHECK (applies_to IN ('students', 'staff', 'both')),
    description     TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holiday_date ON holidays(holiday_date);

-- Add holiday_end_date if the table was created without it
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS holiday_end_date DATE DEFAULT NULL;

-- Remove old unique constraint that blocks period holidays
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_holiday_date_holiday_type_key;
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_holiday_date_key;


-- ============================================================
-- 9. FRAUD ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_alerts (
    alert_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type   VARCHAR(100) NOT NULL,
    severity       VARCHAR(10)  NOT NULL DEFAULT 'medium'
                   CHECK (severity IN ('low', 'medium', 'high')),
    involved_ids   TEXT[]       NOT NULL,
    involved_names TEXT[]       NOT NULL,
    evidence       JSONB        NOT NULL DEFAULT '{}',
    description    TEXT,
    is_resolved    BOOLEAN      NOT NULL DEFAULT false,
    admin_notes    TEXT,
    flagged_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_severity ON fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_resolved ON fraud_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_fraud_date     ON fraud_alerts(flagged_date);


-- ============================================================
-- 10. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL   PRIMARY KEY,
    admin_id    TEXT,
    action      TEXT        NOT NULL,
    table_name  TEXT,
    record_id   TEXT,
    old_value   JSONB,
    new_value   JSONB,
    description TEXT,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 11. MESSAGE TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS message_templates (
    template_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key  TEXT        NOT NULL UNIQUE,
    subject       TEXT,
    body_text     TEXT        NOT NULL,
    body_html     TEXT,
    channel       TEXT        NOT NULL DEFAULT 'email'
                  CHECK (channel IN ('email', 'whatsapp', 'both')),
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 12. REPORT TEMPLATES  (customizable PDF report settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS report_templates (
    template_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key  TEXT        NOT NULL UNIQUE,
    display_name  TEXT        NOT NULL,
    school_name   TEXT,
    logo_url      TEXT,
    color_scheme  TEXT        DEFAULT '#1a3a52',
    sections      JSONB       DEFAULT '[]'::jsonb,
    custom_notes  TEXT,
    updated_by    UUID        REFERENCES admins(admin_id),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed the three built-in templates
INSERT INTO report_templates (template_key, display_name, sections)
VALUES
    ('daily_summary',
     'Daily Summary',
     '["overview","student_summary","class_breakdown","staff_summary"]'::jsonb),
    ('period_report',
     'Attendance Period Report',
     '["overview","daily_trend","class_breakdown","top_absentees"]'::jsonb),
    ('staff_report',
     'Staff Attendance Report',
     '["overview","staff_detail","punctuality_summary"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;


-- ============================================================
-- 13. ROW LEVEL SECURITY
--     Service-role key bypasses RLS automatically.
--     Disable on all tables so the backend key works without
--     needing per-table policies.
-- ============================================================
ALTER TABLE students                DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings   DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_type_config       DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers                DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_attendance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE holidays                DISABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts            DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates       DISABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates        DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 14. MAY 2026 ADDITIONS (were run as separate migrations; folded in so a
--     fresh install stays one script)
-- ============================================================

-- Migration: transport mode, student groups, teacher notification opt-in
-- Run this in the Supabase SQL editor before deploying the backend update.

-- 1. Students: transport mode + group tag
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(20) DEFAULT 'parent_drop',
  ADD COLUMN IF NOT EXISTS group_tag       TEXT;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_transport_mode_check;
ALTER TABLE students
  ADD CONSTRAINT students_transport_mode_check
  CHECK (transport_mode IN ('parent_drop', 'school_bus', 'self'));

-- 2. Teachers: assigned class + scan notification opt-in
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS assigned_class TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_scan BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Notification settings: transport-mode parent notification toggles
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_parent_drop    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_self_transport BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_school_bus     BOOLEAN NOT NULL DEFAULT FALSE;

-- Scan Day Overrides
-- Allows admins to force-open (allow scanning) or force-close (block scanning)
-- any date that would otherwise be determined by weekend/holiday logic.

CREATE TABLE IF NOT EXISTS scan_day_overrides (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    override_date date        NOT NULL UNIQUE,
    override_type text        NOT NULL CHECK (override_type IN ('allow', 'block')),
    reason        text,
    created_by    uuid        REFERENCES admins(admin_id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_overrides_date ON scan_day_overrides (override_date);

ALTER TABLE scan_day_overrides DISABLE ROW LEVEL SECURITY;

-- School-wide configurable settings
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS school_settings (
    key        TEXT        PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE school_settings DISABLE ROW LEVEL SECURITY;

-- Seed defaults (will not overwrite existing values)
INSERT INTO school_settings (key, value) VALUES
  ('arrival_early_start',     '05:00'),  -- Early arrival window opens
  ('arrival_early_end',       '09:00'),  -- Early ends / On-time begins
  ('arrival_ontime_end',      '10:00'),  -- On-time ends / Late begins
  ('arrival_late_end',        '12:00'),  -- Late window closes (after = invalid_time)
  ('departure_start',         '14:00'),  -- Earliest valid departure
  ('departure_end',           '19:00'),  -- Latest valid departure
  ('duplicate_scan_cooldown', '5'),      -- Seconds between duplicate scans
  ('non_arrival_cutoff',      '12:00'),  -- Time to send non-arrival alerts
  ('non_departure_cutoff',    '18:00')   -- Time to send non-departure alerts
ON CONFLICT (key) DO NOTHING;

-- Student Groups: admin-managed list of named groups with associated transport mode.
-- The group_tag on students is a foreign key reference to this table's name column.

CREATE TABLE IF NOT EXISTS student_groups (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL UNIQUE,
    transport_mode VARCHAR(20) NOT NULL DEFAULT 'parent_drop',
    description    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT student_groups_transport_mode_check
        CHECK (transport_mode IN ('parent_drop', 'school_bus', 'self'))
);

ALTER TABLE student_groups DISABLE ROW LEVEL SECURITY;

-- Seed sensible defaults
INSERT INTO student_groups (name, transport_mode, description) VALUES
    ('Bus Group A',    'school_bus',  'School bus - Route A'),
    ('Bus Group B',    'school_bus',  'School bus - Route B'),
    ('Parent Drop-off','parent_drop', 'Students dropped off by a parent or guardian'),
    ('Walkers',        'self',        'Students who walk or come to school alone')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- 15. STAFF MOBILE SIGN-IN (2026-10_staff_mobile_signin.sql)
-- ============================================================

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
