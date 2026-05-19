-- ============================================================
--  Peculiar Register — Supabase PostgreSQL Schema
--  Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";


-- ------------------------------------------------------------
-- students
-- ------------------------------------------------------------
create table if not exists students (
    student_id   text        primary key,
    full_name    text        not null,
    class        text        not null,
    parent_phone text,
    parent_email text,
    created_at   timestamptz not null default now()
);


-- ------------------------------------------------------------
-- admins
-- ------------------------------------------------------------
create table if not exists admins (
    admin_id      uuid        primary key default gen_random_uuid(),
    username      text        not null unique,
    password_hash text        not null,
    email         text,
    created_at    timestamptz not null default now()
);


-- ------------------------------------------------------------
-- attendance_logs
-- ------------------------------------------------------------
create table if not exists attendance_logs (
    log_id         uuid        primary key default gen_random_uuid(),
    student_id     text        not null references students(student_id) on delete cascade,
    scan_timestamp timestamptz not null default now(),
    log_type       text        not null check (log_type in ('arrival', 'departure')),
    comments       text        check (comments in ('early', 'late', 'invalid_time') or comments is null),
    entry_point    text,
    created_at     timestamptz not null default now()
);

create index if not exists idx_logs_student    on attendance_logs(student_id);
create index if not exists idx_logs_timestamp  on attendance_logs(scan_timestamp desc);
create index if not exists idx_logs_type       on attendance_logs(log_type);


-- ------------------------------------------------------------
-- notification_settings
-- ------------------------------------------------------------
create table if not exists notification_settings (
    setting_id             uuid    primary key default gen_random_uuid(),
    admin_id               uuid    not null references admins(admin_id) on delete cascade unique,
    email_enabled          boolean not null default true,
    whatsapp_enabled       boolean not null default true,
    notify_late_arrivals   boolean not null default true,
    notify_non_arrivals    boolean not null default true,
    notify_non_departures  boolean not null default true,
    updated_at             timestamptz not null default now()
);


-- ------------------------------------------------------------
-- staff_type_config
-- ------------------------------------------------------------
create table if not exists staff_type_config (
    config_id             uuid        primary key default gen_random_uuid(),
    staff_type            text        not null unique,
    check_in_start        time        not null default '06:30:00',
    check_in_end          time        not null default '08:00:00',
    check_out_time        time        not null default '15:00:00',
    check_out_end         time        not null default '18:00:00',
    grace_period_minutes  int         not null default 5,
    is_active             boolean     not null default true,
    updated_at            timestamptz not null default now()
);


-- ------------------------------------------------------------
-- teachers
-- ------------------------------------------------------------
create table if not exists teachers (
    teacher_id  uuid        primary key default gen_random_uuid(),
    full_name   text        not null,
    staff_type  text        not null references staff_type_config(staff_type),
    barcode_id  text        not null unique,
    phone       text,
    email       text,
    is_active   boolean     not null default true,
    created_at  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- teacher_attendance_logs
-- ------------------------------------------------------------
create table if not exists teacher_attendance_logs (
    log_id              uuid        primary key default gen_random_uuid(),
    teacher_id          uuid        not null references teachers(teacher_id) on delete cascade,
    scan_date           date        not null,
    check_in_time       timestamptz,
    check_in_status     text,
    check_in_comments   text,
    check_out_time      timestamptz,
    check_out_status    text,
    check_out_comments  text,
    updated_at          timestamptz not null default now(),
    unique (teacher_id, scan_date)
);


-- ------------------------------------------------------------
-- audit_logs
-- ------------------------------------------------------------
create table if not exists audit_logs (
    id          bigserial   primary key,
    admin_id    text,
    action      text        not null,
    table_name  text,
    record_id   text,
    old_value   jsonb,
    new_value   jsonb,
    description text,
    timestamp   timestamptz not null default now()
);


-- ------------------------------------------------------------
-- Row Level Security - disable for service-role key usage
-- (enable and configure policies once auth is hardened)
-- ------------------------------------------------------------
alter table students             disable row level security;
alter table admins               disable row level security;
alter table attendance_logs      disable row level security;
alter table notification_settings disable row level security;
alter table staff_type_config    disable row level security;
alter table teachers             disable row level security;
alter table teacher_attendance_logs disable row level security;
alter table audit_logs           disable row level security;
