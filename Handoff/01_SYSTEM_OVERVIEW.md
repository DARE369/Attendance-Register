# 01 — System Overview

## What it does

Peculiar Register tracks attendance for a school by scanning barcodes (student ID
cards / staff cards) at the gate. Each scan is:

1. Looked up against the `students` or `teachers` table.
2. Classified as an **arrival** or **departure** and given a status (`early`,
   `on_time`, `late`, `early_departure`, etc.) based on the current time and the
   configured time windows.
3. Recorded in the database (`attendance_logs` for students,
   `teacher_attendance_logs` for staff).
4. Optionally used to send a **parent/staff notification** (email and/or WhatsApp).

Administrators manage everything through a single React dashboard.

---

## Architecture

```
┌──────────────────────┐         HTTPS / JSON          ┌──────────────────────┐
│   React Frontend     │  ───────────────────────────► │   Flask Backend      │
│   (Vite + Tailwind)  │   axios, JWT in Authorization  │   (Blueprints)       │
│   Hosted: Vercel     │  ◄─────────────────────────── │   Hosted: Fly.io     │
└──────────────────────┘                                └──────────┬───────────┘
                                                                    │ PostgREST (HTTPS)
                                                                    ▼
                                                         ┌──────────────────────┐
                                                         │   Supabase Postgres   │
                                                         └──────────────────────┘
                                       Notifications ▲             │
                          ┌────────────────────────┐ │             │
                          │ Gmail SMTP (email)      │◄┘             │
                          │ D7 Networks (WhatsApp)  │◄──────────────┘
                          └────────────────────────┘
```

- The frontend talks **only** to the Flask backend (never directly to Supabase).
- The backend uses the Supabase **REST API (PostgREST)** via the `requests`
  library — there is no ORM and no direct Postgres connection.
- Auth is **stateless JWT** (HS256), issued on login and sent in the
  `Authorization: Bearer <token>` header. Tokens expire after 8 hours.

---

## Tech stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, axios, react-hot-toast | SPA |
| Backend | Python 3.11/3.12, Flask 3, flask-cors, PyJWT, bcrypt, fpdf2, gunicorn | Blueprint-based |
| Database | Supabase (PostgreSQL + PostgREST) | No ORM; raw REST calls |
| Email | Gmail SMTP via `smtplib` | App Password required |
| WhatsApp | D7 Networks API (see doc 08 re: Twilio leftovers) | |
| PDF reports | fpdf2 | Generated server-side |
| Hosting | Fly.io (backend), Vercel (frontend) | |

---

## Repository layout

```
Peculiar Register/
├── .env                         ← secrets (NOT committed; lives here, one level above app)
├── README.md
├── Handoff/                     ← this folder
└── school-attendance/
    ├── app.py                   ← Flask app factory + logging setup
    ├── wsgi.py                  ← gunicorn entrypoint (wsgi:application)
    ├── config.py                ← reads env vars into Config class
    ├── Dockerfile               ← backend container (python:3.12-slim + gunicorn)
    ├── fly.toml                 ← Fly.io deploy config
    ├── requirements.txt
    ├── routes/                  ← Flask blueprints (one file per area)
    │   ├── __init__.py          ← register_blueprints()
    │   ├── auth.py              ← login/register, token_required, require_role
    │   ├── scan.py             ← barcode scan processing
    │   ├── admin.py            ← dashboard, export, attendance log
    │   ├── settings.py        ← notification settings
    │   ├── import_csv.py       ← CSV bulk import
    │   ├── templates.py        ← message templates
    │   ├── management.py       ← students/teachers/staff-types/groups/school-settings
    │   ├── holidays.py         ← holidays + scan-day overrides
    │   ├── fraud_alerts.py     ← fraud alerts
    │   ├── admin_management.py ← admin user CRUD, profile, password
    │   └── reports.py          ← analytics + report generation
    ├── services/                ← business logic
    │   ├── supabase_client.py   ← all DB access (PostgREST wrapper)
    │   ├── auth_service.py      ← JWT + bcrypt
    │   ├── attendance_service.py← scan classification logic
    │   ├── teacher_attendance_service.py
    │   ├── notification_service.py
    │   ├── email_service.py
    │   ├── whatsapp_service.py
    │   ├── holiday_service.py
    │   ├── audit_service.py
    │   ├── csv_service.py
    │   ├── pdf_service.py
    │   └── tz.py                ← timezone helpers (Africa/Lagos)
    ├── models/                  ← lightweight data models
    ├── migrations/              ← SQL migrations (run manually in Supabase)
    └── frontend/
        ├── package.json
        ├── vite.config.js
        ├── vercel.json          ← SPA rewrite config
        ├── .env.production       ← VITE_API_BASE_URL = fly.dev URL
        └── src/
            ├── App.jsx          ← routes + role-based guards
            ├── pages/           ← LoginPage, ScannerPage, AdminDashboard, etc.
            ├── components/      ← dashboard panels, scanner input, tables
            ├── hooks/           ← usePersistentScans
            └── services/api.js  ← all backend API calls (axios)
```

---

## User roles

Roles are stored on the admin record and embedded in the JWT (`role` claim).

| Role | Can access | Enforced where |
|------|-----------|----------------|
| `admin` | Full dashboard: students, teachers, settings, reports, imports, everything | Backend `require_role()` + frontend `PrivateRoute adminOnly` |
| `scanner` | Scanner page only — locked out of the dashboard | Frontend redirects `scanner` → `/scanner`; backend role checks |

On login the frontend redirects based on role: `scanner` → `/scanner`,
everyone else → `/dashboard`.

---

## Attendance time windows (defaults)

These are now **configurable** via the `school_settings` table (see doc 04).
Defaults:

| Window | Time | Classification |
|--------|------|----------------|
| Early arrival | 05:00–09:00 | Arrival (early) |
| On-time arrival | 09:00–10:00 | Arrival (on time) |
| Late arrival | 10:00–12:00 | Arrival (late) |
| Departure | 14:00–19:00 | Departure |
| Outside windows | — | Invalid (not logged) |

Timezone is **Africa/Lagos** (set in `fly.toml` as `TZ` and handled in `services/tz.py`).

---

## Key feature areas

- **Barcode scanning** — `/scanner` page, hidden auto-focused input, persistent
  local scan history (`usePersistentScans` hook).
- **Live dashboard** — polls `/api/admin/dashboard` every 3s; summary cards,
  attendance log, scan log.
- **Student & teacher management** — CRUD, CSV bulk import, staff-type time configs.
- **Student groups & transport modes** — `parent_drop` / `school_bus` / `self`,
  used to decide which parents get notified.
- **Notifications** — per-channel (email/WhatsApp) and per-event toggles
  (late arrival, non-arrival, non-departure), plus transport-mode toggles.
- **Message templates** — admin-editable email/WhatsApp templates with variables.
- **Holidays & scan-day overrides** — block/allow scanning on specific dates.
- **Fraud alerts** — flags suspicious scan patterns for review.
- **Audit logs** — records admin actions.
- **Reports & analytics** — CSV export, PDF reports, per-student/staff analytics.
