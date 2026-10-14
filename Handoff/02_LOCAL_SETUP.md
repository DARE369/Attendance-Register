# 02 — Local Setup Guide

How to get Peculiar Register running on a fresh machine.

---

## Prerequisites

- **Python 3.11+** (3.12 is what production uses)
- **Node.js 18+** and npm
- A **Supabase** project (free tier is fine) — or access to the existing one
- A **Gmail** account with an **App Password** (for email notifications)
- (Optional) **D7 Networks** account for WhatsApp
- Git

---

## 1. Get the code

```bash
git clone <repo-url> "Peculiar Register"
cd "Peculiar Register"
```

The app code lives in `school-attendance/`. **Important:** the `.env` file lives
in the **`Peculiar Register/` root**, one level *above* `school-attendance/`.
`config.py` uses `find_dotenv()` to locate it.

---

## 2. Create the `.env` file

```bash
cp school-attendance/.env.example .env
```

Then edit `.env` and fill in every value. See
[06 — Environment Variables](06_ENVIRONMENT_VARIABLES.md) for what each one means.
At minimum you need:

- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`, `ADMIN_REGISTER_SECRET`
- `SMTP_EMAIL`, `SMTP_PASSWORD` (Gmail App Password) — for email
- `D7_API_TOKEN`, `D7_WHATSAPP_FROM` — for WhatsApp (optional locally)

> ⚠️ The committed `.env.example` still lists **Twilio** variables, but the code
> (`config.py`) actually reads **D7 Networks** variables (`D7_API_TOKEN`,
> `D7_WHATSAPP_FROM`). Use the D7 variables. See doc 08.

---

## 3. Create the database tables

Open the **Supabase SQL Editor** and run the migrations. The simplest path is the
consolidated schema file, then any newer migrations:

```
school-attendance/migrations/full_schema.sql          ← run first (idempotent, all core tables)
school-attendance/migrations/2026-05-22_transport_mode_teacher_notifications.sql
school-attendance/migrations/2026-05-23_scan_day_overrides.sql
school-attendance/migrations/2026-05-23_school_settings.sql
school-attendance/migrations/2026-05-24_student_groups.sql
```

See [04 — Database Schema](04_DATABASE_SCHEMA.md) for the full table list and
recommended run order. All migrations are written to be idempotent
(`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

---

## 4. Install backend dependencies

```bash
cd school-attendance
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
```

---

## 5. Install frontend dependencies

```bash
cd school-attendance/frontend
npm install
```

Create `frontend/.env.local` (copy from `.env.local.example`) and point it at your
local backend:

```
VITE_API_BASE_URL=http://localhost:5000
```

---

## 6. Create a first admin user

Admins are created via the register endpoint, which requires the
`ADMIN_REGISTER_SECRET`. With the backend running (step 7), call:

```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"choose-a-password","email":"you@example.com","register_secret":"<ADMIN_REGISTER_SECRET from .env>"}'
```

(On Windows PowerShell, use `Invoke-RestMethod` or the `curl.exe` equivalent.)

---

## 7. Run the app (two terminals)

**Terminal 1 — backend:**
```bash
cd school-attendance
python app.py
# → http://localhost:5000
```

**Terminal 2 — frontend:**
```bash
cd school-attendance/frontend
npm run dev
# → http://localhost:5173
```

Open **http://localhost:5173** and log in with the admin you created.

Health check: `GET http://localhost:5000/health` → `{"status":"ok"}`.

---

## 8. (Optional) Load mock data

There are helper scripts in `school-attendance/` for generating and loading test
students:

```bash
cd school-attendance
python generate_mock_data.py
python load_mock_data.py
```

> Note: the README references `scripts/generate_mock_data.py`, but the files are
> actually at the `school-attendance/` root. Use the paths above.

---

## Common local issues

| Symptom | Cause / Fix |
|---------|-------------|
| `ECONNREFUSED` in browser | Flask backend isn't running — start Terminal 1 |
| `.env` not found | `.env` must be in `Peculiar Register/`, not in `school-attendance/` |
| Emails not sending | `SMTP_PASSWORD` must be a Gmail **App Password** (16 chars), not your login password |
| Supabase 406 errors in logs | Normal for single-row "not found" lookups; handled as `None` |
| Supabase 401 on admin writes | Set `SUPABASE_SERVICE_ROLE_KEY` (anon key can't write protected tables) |
| Scanner not capturing input | Click anywhere on the scanner page to refocus the hidden input |
