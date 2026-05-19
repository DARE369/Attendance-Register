-- ============================================================
-- Migration: holiday periods + admin roles + admin profile
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Add holiday_end_date to support multi-day holiday periods
ALTER TABLE holidays
  ADD COLUMN IF NOT EXISTS holiday_end_date DATE DEFAULT NULL;

-- 2. Drop old unique constraint (period holidays can overlap single-day dates)
ALTER TABLE holidays
  DROP CONSTRAINT IF EXISTS holidays_holiday_date_holiday_type_key;

-- 3. Add role column to admins table
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('super_admin', 'admin', 'scanner'));

-- 4. Add profile fields to admins
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT;

-- 5. Promote first existing admin to super_admin
UPDATE admins
SET role = 'super_admin'
WHERE created_at = (SELECT MIN(created_at) FROM admins);

-- 6. report_templates table for customizable PDF templates
CREATE TABLE IF NOT EXISTS report_templates (
    template_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key  TEXT         NOT NULL UNIQUE,
    display_name  TEXT         NOT NULL,
    school_name   TEXT,
    logo_url      TEXT,
    color_scheme  TEXT         DEFAULT '#1a3a52',
    sections      JSONB        DEFAULT '[]'::jsonb,
    custom_notes  TEXT,
    updated_by    UUID         REFERENCES admins(admin_id),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed default templates
INSERT INTO report_templates (template_key, display_name, sections)
VALUES
  ('daily_summary',   'Daily Summary',          '["overview","student_summary","class_breakdown","staff_summary"]'::jsonb),
  ('period_report',   'Attendance Period Report','["overview","daily_trend","class_breakdown","top_absentees"]'::jsonb),
  ('staff_report',    'Staff Attendance Report', '["overview","staff_detail","punctuality_summary"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;
