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
