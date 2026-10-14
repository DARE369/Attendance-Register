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
