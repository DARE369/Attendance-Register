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
