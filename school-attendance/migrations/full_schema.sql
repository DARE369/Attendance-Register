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
