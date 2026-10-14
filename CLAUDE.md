# Peculiar Register

Attendance register for Lekki Peculiar School: students and staff sign in at a gate barcode scanner; admins manage everything from a web dashboard. Staff mobile sign-in (passkey + campus zone) is being added.

## Source of truth for the staff sign-in feature

- `docs/staff-signin-plan.md`: the full plan (architecture, schema, endpoints, screens, build sessions).
- `docs/staff-signin-audit.md`: what the code actually looks like, and where the plan was corrected. **Where they disagree, the audit wins.**

Read both before working on any staff sign-in session.

## Stack

| Part | Tech | Deployed to |
| --- | --- | --- |
| Backend | Flask 3, gunicorn (2 workers), PyJWT, bcrypt, fpdf2 | Fly.io (`school-attendance/fly.toml`) |
| Database | Supabase Postgres via a hand-rolled PostgREST client (`services/supabase_client.py`, service-role key) | Supabase |
| Frontend | React 18, Vite 5, React Router 6, Tailwind 3, axios, react-hot-toast | Vercel (`frontend/vercel.json`) |
| Email | Gmail SMTP (`services/email_service.py`) | |
| WhatsApp | **D7 Networks** (`services/whatsapp_service.py`), Meta-approved templates only. Not Twilio. | |

## Layout

```
school-attendance/
  app.py, wsgi.py, config.py     Flask app factory, env config
  routes/                        Blueprints (registered in routes/__init__.py)
  services/                      Business logic + supabase_client.py (all DB access)
    tz.py                        Always use tz.now()/tz.today_str() for Lagos time
    staff_attendance_rules.py    Shared staff check-in/out rules (scanner + staff app)
  migrations/                    Hand-run SQL; full_schema.sql must stay a complete fresh install
  tests/                         pytest; DB is faked with monkeypatch, never hit for real
  frontend/src/
    pages/, components/          Admin dashboard + scanner
    services/api.js              Admin axios client (401 → /login)
```

## Running

```bash
# Backend (from school-attendance/; .env lives in the repo root)
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python app.py                 # http://localhost:5000
.venv/Scripts/python -m pytest tests -q     # tests

# Frontend (from school-attendance/frontend/)
npm install
npm run dev                                 # http://localhost:5173, proxies /api and /auth to :5000
npm run build
```

## Rules

- Server time only: use `services.tz`, never a client-supplied time.
- All DB access goes through `services/supabase_client.py` in its existing `_request` style.
- Staff check-in/out logic lives only in `services/staff_attendance_rules.py`.
- Holiday checks must pass an audience (`get_student_day_status` / `get_staff_day_status`); `holidays.applies_to` can be students-only or staff-only.
- New migrations are idempotent (`if not exists`) and also appended to `migrations/full_schema.sql`.
- Staff-facing UI is for a budget Android phone, one hand, on mobile data: big targets, plain words, no jargon. See the UX section of the audit.
- One branch and one PR per build session.
