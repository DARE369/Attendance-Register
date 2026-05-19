-- ──────────────────────────────────────────────────────────────────────────────
-- Seed Staff Types — run once in Supabase SQL Editor
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- Adjust check-in/check-out times to match your school schedule.
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO staff_type_config
    (config_id, staff_type, check_in_start, check_in_end, check_out_time, check_out_end, grace_period_minutes, is_active)
VALUES
    (gen_random_uuid(), 'Teaching Staff',          '07:00', '08:30', '14:00', '15:00', 0, true),
    (gen_random_uuid(), 'Part-Time Teaching Staff', '07:00', '09:00', '13:00', '14:00', 0, true),
    (gen_random_uuid(), 'Support Staff',            '07:00', '08:30', '14:00', '15:30', 0, true),
    (gen_random_uuid(), 'Receptionist',             '07:00', '08:00', '15:00', '16:00', 0, true),
    (gen_random_uuid(), 'Facility Manager',         '07:00', '08:30', '15:00', '16:00', 0, true),
    (gen_random_uuid(), 'Janitor',                  '06:00', '07:30', '14:00', '15:30', 0, true)
ON CONFLICT (staff_type) DO NOTHING;
