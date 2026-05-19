-- ============================================================
-- PHASE 10 MIGRATIONS  —  Run in Supabase SQL Editor
-- ============================================================

-- 1. HOLIDAYS
CREATE TABLE IF NOT EXISTS holidays (
    holiday_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_name VARCHAR(255) NOT NULL,
    holiday_date DATE         NOT NULL,
    holiday_type VARCHAR(20)  NOT NULL DEFAULT 'custom'
                 CHECK (holiday_type IN ('national','state','custom')),
    applies_to   VARCHAR(20)  NOT NULL DEFAULT 'both'
                 CHECK (applies_to IN ('students','staff','both')),
    description  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMP NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (holiday_date, holiday_type)
);

CREATE INDEX IF NOT EXISTS idx_holiday_date ON holidays(holiday_date);

INSERT INTO holidays (holiday_name, holiday_date, holiday_type, applies_to, description)
VALUES
  ('New Year',         '2026-01-01', 'national', 'both', 'New Year''s Day'),
  ('Independence Day', '2026-06-12', 'national', 'both', 'Nigeria Independence Day'),
  ('Christmas',        '2026-12-25', 'national', 'both', 'Christmas Holiday'),
  ('Easter',           '2026-04-05', 'national', 'both', 'Easter Holiday')
ON CONFLICT DO NOTHING;


-- 2. FRAUD ALERTS
CREATE TABLE IF NOT EXISTS fraud_alerts (
    alert_id      UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type  VARCHAR(100) NOT NULL,
    severity      VARCHAR(10)  NOT NULL DEFAULT 'medium'
                  CHECK (severity IN ('low','medium','high')),
    involved_ids  TEXT[]    NOT NULL,
    involved_names TEXT[]   NOT NULL,
    evidence      JSONB     NOT NULL DEFAULT '{}',
    description   TEXT,
    is_resolved   BOOLEAN   NOT NULL DEFAULT false,
    admin_notes   TEXT,
    flagged_date  DATE      NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_severity ON fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_resolved  ON fraud_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_fraud_date      ON fraud_alerts(flagged_date);


-- 3. ADMINS — add role / permissions / is_active
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role        VARCHAR(50)  DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions JSONB        DEFAULT '{}';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active   BOOLEAN      DEFAULT true;


-- 4. ATTENDANCE LOGS — add holiday flag
ALTER TABLE attendance_logs         ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT false;
ALTER TABLE teacher_attendance_logs ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT false;


-- 5. STAFF TYPE CONFIG — add checkout window columns
--    (grace_period_minutes kept so existing UI doesn't break)
ALTER TABLE staff_type_config ADD COLUMN IF NOT EXISTS check_out_start TIME DEFAULT '14:00';
ALTER TABLE staff_type_config ADD COLUMN IF NOT EXISTS check_out_end   TIME DEFAULT '15:00';
ALTER TABLE staff_type_config ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMP DEFAULT now();

UPDATE staff_type_config
SET check_out_start = '14:00',
    check_out_end   = '15:00'
WHERE check_out_start IS NULL;
