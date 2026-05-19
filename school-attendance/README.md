# Peculiar Register — Student Attendance System

A full-stack school attendance tracking system with barcode scanning, real-time dashboard, parent notifications, and CSV bulk import.

---

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18 + Vite + Tailwind CSS      |
| Backend  | Python Flask (Blueprints)           |
| Database | Supabase (PostgreSQL via PostgREST) |
| Email    | Gmail SMTP (smtplib)                |
| WhatsApp | Twilio                              |

---

## Setup (First Time)

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- A Supabase project (free tier works)
- A Gmail account with App Password enabled
- (Optional) A Twilio account for WhatsApp

### 2. Clone and configure
```bash
# The .env file goes ONE level above school-attendance/
cd "Peculiar Register"
cp school-attendance/.env.example .env
# Edit .env and fill in all values
```

### 3. Create the Supabase tables
Run these SQL statements in the Supabase SQL editor:

```sql
create table students (
  student_id   text primary key,
  full_name    text not null,
  class        text not null,
  parent_phone text,
  parent_email text
);

create table attendance_logs (
  id              bigserial primary key,
  student_id      text references students(student_id),
  log_type        text not null,   -- 'arrival' | 'departure'
  scan_timestamp  timestamptz not null,
  comments        text,            -- 'early' | 'late' | null
  entry_point     text
);

create table admins (
  id           bigserial primary key,
  username     text unique not null,
  password     text not null       -- bcrypt hash
);

create table notification_settings (
  admin_id             text primary key,
  email_enabled        boolean default true,
  whatsapp_enabled     boolean default true,
  notify_late_arrivals boolean default true,
  notify_non_arrivals  boolean default true,
  notify_non_departures boolean default true,
  updated_at           timestamptz
);
```

### 4. Install Python dependencies
```bash
cd school-attendance
pip install -r requirements.txt
```

### 5. Install frontend dependencies
```bash
cd school-attendance/frontend
npm install
```

### 6. Load mock student data
```bash
cd school-attendance
python scripts/generate_mock_data.py
python scripts/load_mock_data.py
```

---

## Running Locally

Open **two terminals**:

**Terminal 1 — Flask backend:**
```bash
cd school-attendance
python app.py
# Runs on http://localhost:5000
```

**Terminal 2 — Vite frontend:**
```bash
cd school-attendance/frontend
npm run dev
# Runs on http://localhost:5173
```

Open http://localhost:5173 in your browser.

---

## Pages

| URL          | Description                                |
|--------------|--------------------------------------------|
| `/login`     | Admin login                                |
| `/scanner`   | Barcode scanner interface                  |
| `/dashboard` | Real-time attendance dashboard             |
| `/import`    | Bulk CSV student import                    |

---

## API Endpoints

| Method | Path                         | Auth | Description                  |
|--------|------------------------------|------|------------------------------|
| POST   | /auth/login                  | No   | Admin login                  |
| POST   | /auth/register               | No   | Register new admin           |
| POST   | /api/scan                    | No   | Process barcode scan         |
| GET    | /api/test-scan               | No   | Test scan (dev only)         |
| GET    | /api/admin/dashboard         | JWT  | Dashboard data               |
| GET    | /api/admin/export-csv        | JWT  | Download attendance CSV      |
| POST   | /api/admin/import-csv        | JWT  | Bulk import students         |
| GET    | /api/admin/settings          | JWT  | Get notification settings    |
| POST   | /api/admin/settings          | JWT  | Save notification settings   |

---

## Time Windows

| Time          | Classification |
|---------------|----------------|
| 05:00–09:00   | Arrival (early)|
| 09:00–10:00   | Arrival (on time) |
| 10:00–12:00   | Arrival (late) |
| 14:00–19:00   | Departure      |
| Outside above | Invalid (not logged) |

---

## Logs

All log files are written to `school-attendance/logs/`:

| File                    | Contents                          |
|-------------------------|-----------------------------------|
| `attendance.log`        | All application logs              |
| `scan_logs.txt`         | Scan events only                  |
| `notification_logs.txt` | Email / WhatsApp events           |
| `import_logs.txt`       | CSV import events                 |
| `error_logs.txt`        | All errors (any category)         |

---

## CSV Import Format

```csv
student_id,full_name,parent_phone,parent_email
STU001,John Doe,+2348012345678,john@parents.com
STU002,Jane Smith,+2348087654321,jane@parents.com
```

- Phone: E.164 format (`+country_code...`)
- Duplicate student IDs are skipped, not overwritten
- Max file size: 5 MB

---

## Troubleshooting

**`ECONNREFUSED` on the frontend** — Flask is not running. Start it in a separate terminal.

**`load_dotenv` not finding .env** — The `.env` must be in the `Peculiar Register/` folder (one level above `school-attendance/`), not inside it.

**Emails not sending** — Check that `SMTP_EMAIL` and `SMTP_PASSWORD` are set. The password must be a Gmail **App Password** (16 characters, no spaces), not your normal Gmail password.

**Supabase 406 errors** — This is normal for "not found" queries (single-row lookups that return no rows). The client handles this as `None`.

**Supabase 401 on admin writes** - Set `SUPABASE_SERVICE_ROLE_KEY` in the server `.env` from Supabase Project Settings -> API. The public anon key can read rows when policies allow it, but it is usually blocked from inserting or updating admin tables.

**Scanner not capturing keyboard input** — Click anywhere on the scanner page to re-focus the hidden input.

---

## Message Templates — SQL Migration

Run this in the Supabase SQL Editor to enable custom message templates:

```sql
create table message_templates (
  id           bigserial primary key,
  template_key text unique not null,
  channel      text not null,   -- 'email' | 'whatsapp'
  subject      text,            -- email only
  body         text not null,
  variables    text[],
  updated_at   timestamptz default now()
);
```

After running this, visit `/templates` in the dashboard to customise all notification messages. Before the table exists, the system uses the built-in default templates automatically (no outage).

---

## Phase 7 — SQL Migration (Teachers & Audit)

Run this in the Supabase SQL Editor to enable the teacher module:

```sql
-- Staff type configuration
create table if not exists staff_type_config (
  config_id             uuid primary key default gen_random_uuid(),
  staff_type            text unique not null,
  check_in_start        time not null default '06:30:00',
  check_in_end          time not null default '08:00:00',
  check_out_time        time not null default '15:00:00',
  check_out_end         time not null default '18:00:00',
  grace_period_minutes  int  not null default 5,
  is_active             boolean not null default true,
  updated_at            timestamptz default now()
);

-- Default staff types
insert into staff_type_config (staff_type, check_in_start, check_in_end, check_out_time, check_out_end, grace_period_minutes)
values
  ('Teacher',       '06:30:00', '07:45:00', '14:30:00', '17:00:00', 10),
  ('Admin Staff',   '07:00:00', '08:00:00', '15:00:00', '18:00:00',  5),
  ('Support Staff', '06:00:00', '08:30:00', '16:00:00', '19:00:00', 15)
on conflict (staff_type) do nothing;

-- Teachers
create table if not exists teachers (
  teacher_id  uuid primary key default gen_random_uuid(),
  full_name   text not null,
  staff_type  text not null references staff_type_config(staff_type),
  barcode_id  text unique not null,
  phone       text,
  email       text,
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);

-- Teacher attendance logs
create table if not exists teacher_attendance_logs (
  log_id              uuid primary key default gen_random_uuid(),
  teacher_id          uuid not null references teachers(teacher_id),
  scan_date           date not null,
  check_in_time       timestamptz,
  check_in_status     text,   -- 'on_time' | 'late'
  check_in_comments   text,
  check_out_time      timestamptz,
  check_out_status    text,   -- 'on_time' | 'early_departure'
  check_out_comments  text,
  updated_at          timestamptz default now(),
  unique (teacher_id, scan_date)
);

-- Audit logs (admin_id is TEXT — admins use bigserial, not UUID)
create table if not exists audit_logs (
  id          bigserial primary key,
  admin_id    text,
  action      text not null,
  table_name  text,
  record_id   text,
  old_value   jsonb,
  new_value   jsonb,
  description text,
  timestamp   timestamptz default now()
);

-- Optional: add staff_type column to students if not already present
alter table students add column if not exists staff_type text default 'Student';
```
