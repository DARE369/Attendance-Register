# 04 — Database Schema Reference

The database is **Supabase (PostgreSQL)**, accessed by the backend through the
PostgREST REST API. There is **no ORM** — all access goes through
`services/supabase_client.py`.

> Source of truth: `school-attendance/migrations/full_schema.sql` (idempotent,
> covers tables 1–12) plus the dated migrations for newer features.

---

## Migration run order

Run these in the Supabase **SQL Editor**, in order, on a fresh project:

1. `migrations/full_schema.sql` — all core tables (idempotent, safe to re-run)
2. `migrations/2026-05-22_transport_mode_teacher_notifications.sql` — adds transport mode columns
3. `migrations/2026-05-23_scan_day_overrides.sql` — `scan_day_overrides` table
4. `migrations/2026-05-23_school_settings.sql` — `school_settings` (configurable time windows)
5. `migrations/2026-05-24_student_groups.sql` — `student_groups` table

Other migration files in the folder (`phase10.sql`, `seed_staff_types.sql`,
`fix_rls_policies.sql`, the `2026-05-19_*` files) are older/superseded steps —
`full_schema.sql` already folds in their effects. Prefer `full_schema.sql`.

All migrations are idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).
Requires the `pgcrypto` extension (created by `full_schema.sql`).

---

## Tables

### `students`
| Column | Type | Notes |
|--------|------|-------|
| student_id | TEXT | **PK** (barcode value) |
| full_name | TEXT | not null |
| class | TEXT | not null; indexed |
| parent_phone | TEXT | E.164 format |
| parent_email | TEXT | |
| created_at | TIMESTAMPTZ | default now() |
| transport_mode | VARCHAR(20) | `parent_drop`\|`school_bus`\|`self` (added 05-22) |
| group_tag | TEXT | FK-ish reference to `student_groups.name` (added 05-22) |

### `admins`
| Column | Type | Notes |
|--------|------|-------|
| admin_id | UUID | **PK** |
| username | TEXT | unique, not null |
| password_hash | TEXT | bcrypt |
| display_name, email, phone | TEXT | profile fields |
| role | TEXT | `super_admin`\|`admin`\|`scanner`, default `admin` |
| permissions | JSONB | default `{}` |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | the **oldest** admin is auto-promoted to `super_admin` |

### `attendance_logs` (students)
| Column | Type | Notes |
|--------|------|-------|
| log_id | UUID | **PK** |
| student_id | TEXT | FK → students, ON DELETE CASCADE |
| scan_timestamp | TIMESTAMPTZ | default now() |
| log_type | TEXT | `arrival`\|`departure` |
| comments | TEXT | status e.g. `early`/`late` |
| entry_point | TEXT | e.g. `main_gate` |
| is_holiday | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

Indexes on student_id, scan_timestamp DESC, log_type.

### `notification_settings`
One row per admin (`admin_id` UNIQUE FK). Toggles: `email_enabled`,
`whatsapp_enabled`, `notify_late_arrivals`, `notify_non_arrivals`,
`notify_non_departures`, plus transport toggles added 05-22:
`notify_parent_drop`, `notify_self_transport`, `notify_school_bus`.

### `staff_type_config`
Per-staff-type time windows: `staff_type` (unique), `check_in_start/end`,
`check_out_start/time/end`, `grace_period_minutes`, `is_active`.
Seed types: Teacher, Admin Staff, Support Staff.

### `teachers`
| Column | Type | Notes |
|--------|------|-------|
| teacher_id | UUID | **PK** |
| full_name | TEXT | |
| staff_type | TEXT | FK → staff_type_config.staff_type |
| barcode_id | TEXT | unique |
| phone, email | TEXT | |
| is_active | BOOLEAN | |
| assigned_class | TEXT | added 05-22 |
| notify_on_scan | BOOLEAN | added 05-22 |

### `teacher_attendance_logs`
One row per (teacher, date) — UNIQUE(teacher_id, scan_date). Holds
`check_in_time/status/comments`, `check_out_time/status/comments`, `is_holiday`.

### `holidays`
Single-day or date-range (`holiday_date` → `holiday_end_date`). `holiday_type`
(`national`/`state`/`custom`), `applies_to` (`students`/`staff`/`both`),
`is_active`.

### `scan_day_overrides` (migration 05-23)
Force-`allow` or force-`block` scanning on a specific `override_date`
(unique). Overrides weekend/holiday logic. `created_by` → admins.

### `school_settings` (migration 05-23)
Key/value store for **configurable time windows** and thresholds. Seeded keys:
`arrival_early_start` (05:00), `arrival_early_end` (09:00),
`arrival_ontime_end` (10:00), `arrival_late_end` (12:00),
`departure_start` (14:00), `departure_end` (19:00),
`duplicate_scan_cooldown` (5s), `non_arrival_cutoff` (12:00),
`non_departure_cutoff` (18:00).

### `student_groups` (migration 05-24)
Named groups with a `transport_mode` (`parent_drop`/`school_bus`/`self`).
`students.group_tag` references `student_groups.name`. Seeded with
Bus Group A/B, Parent Drop-off, Walkers.

### `fraud_alerts`
`pattern_type`, `severity` (low/medium/high), `involved_ids[]`,
`involved_names[]`, `evidence` JSONB, `is_resolved`, `admin_notes`, `flagged_date`.

### `audit_logs`
`admin_id` (TEXT — note admins use UUID but this column is TEXT), `action`,
`table_name`, `record_id`, `old_value`/`new_value` JSONB, `description`, `timestamp`.

### `message_templates`
`template_key` (unique), `subject`, `body_text`, `body_html`,
`channel` (`email`/`whatsapp`/`both`), `is_active`. If the table is empty/absent,
the code falls back to built-in default templates (no outage).

### `report_templates`
PDF report config: `template_key`, `display_name`, `school_name`, `logo_url`,
`color_scheme`, `sections` JSONB, `custom_notes`. Seeded: `daily_summary`,
`period_report`, `staff_report`.

---

## Row Level Security (RLS)

`full_schema.sql` **disables RLS on every table**. The backend authenticates with
the **service role key** (which bypasses RLS anyway). This is acceptable because
the database is never exposed directly to clients — only the Flask backend talks
to it. If you ever expose Supabase directly to the browser, you must re-enable RLS
and write policies first. See [08 — Known Issues](08_KNOWN_ISSUES_AND_ROADMAP.md).

---

## ID-type gotchas

- `admins.admin_id` is **UUID**, but `audit_logs.admin_id` is **TEXT** — code
  stringifies the id when writing audit rows. Keep this in mind for joins.
- `students.student_id` and `teachers.barcode_id` are the **scanned barcode
  values** — they are the lookup keys for scans.
