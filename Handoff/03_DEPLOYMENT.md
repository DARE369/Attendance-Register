# 03 — Deployment Guide

The system is split into two independently deployed pieces:

| Piece | Host | URL |
|-------|------|-----|
| Backend (Flask API) | **Fly.io** | `https://peculiar-register.fly.dev` |
| Frontend (React SPA) | **Vercel** | (your Vercel project URL) |
| Database | **Supabase** | (your Supabase project URL) |

---

## Backend — Fly.io

### Config files
- `school-attendance/fly.toml` — app name `peculiar-register`, region `jnb`
  (Johannesburg), internal port **8080**, 1 shared CPU / 512 MB, `TZ=Africa/Lagos`,
  `min_machines_running = 1` (always-on).
- `school-attendance/Dockerfile` — `python:3.12-slim`, installs requirements,
  runs `gunicorn wsgi:application --bind 0.0.0.0:8080 --workers 2 --timeout 120`.
- `school-attendance/wsgi.py` — exposes `application` for gunicorn.

### First-time setup
```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
cd school-attendance
# App already exists as "peculiar-register"; if recreating: fly launch --no-deploy
```

### Set secrets (env vars) on Fly
Secrets are NOT in `fly.toml` — they're set via `fly secrets`. Set every value
from [06 — Environment Variables](06_ENVIRONMENT_VARIABLES.md):

```bash
cd school-attendance
fly secrets set \
  SUPABASE_URL="https://xxxx.supabase.co" \
  SUPABASE_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  JWT_SECRET="<long-random>" \
  ADMIN_REGISTER_SECRET="<random>" \
  SCHOOL_NAME="Peculiar School" \
  SMTP_EMAIL="school@gmail.com" \
  SMTP_PASSWORD="<gmail-app-password>" \
  D7_API_TOKEN="..." \
  D7_WHATSAPP_FROM="+234..." \
  CORS_ORIGINS="https://<your-vercel-domain>"
```

> `CORS_ORIGINS` is a comma-separated allowlist read in `app.py`. It must include
> the deployed frontend origin or the browser will block requests. Defaults to
> localhost only if unset.

### Deploy
```bash
cd school-attendance
fly deploy
```

### Useful Fly commands
```bash
fly status                 # machine state
fly logs                   # live logs
fly secrets list           # names only (values hidden)
fly ssh console            # shell into the machine
fly apps restart peculiar-register
```

---

## Frontend — Vercel

### Config
- `frontend/vercel.json` — build command `npm run build`, output `dist`,
  SPA rewrite (all routes → `/index.html`).
- `frontend/.env.production` — `VITE_API_BASE_URL=https://peculiar-register.fly.dev`.

### Deploy
The frontend is built by Vercel. Connect the repo to a Vercel project with:

- **Root directory:** `school-attendance/frontend`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Env var:** `VITE_API_BASE_URL = https://peculiar-register.fly.dev`

Pushes to the connected branch trigger automatic deploys. To deploy manually:

```bash
cd school-attendance/frontend
npm install -g vercel   # if needed
vercel --prod
```

> `VITE_*` variables are baked in at **build time**. If you change the backend URL,
> you must **rebuild/redeploy** the frontend.

---

## Database — Supabase

Supabase is managed (no deploy step). To apply schema changes:

1. Open the Supabase **SQL Editor**.
2. Paste and run the relevant migration from `school-attendance/migrations/`.
3. Migrations are idempotent, but **review before running on production**.

Row Level Security (RLS): several tables explicitly `DISABLE ROW LEVEL SECURITY`
and the backend uses the **service role key** for writes. See doc 04 and 08.

---

## Standard release procedure

1. Make and test changes locally (doc 02).
2. If schema changed: write a migration in `migrations/`, run it in Supabase
   **staging first if available, then production**.
3. Deploy backend: `cd school-attendance && fly deploy`.
4. Deploy frontend: push to the Vercel-connected branch (or `vercel --prod`).
5. Smoke test: hit `/health`, log in, perform a test scan, check the dashboard.

---

## Rollback

- **Backend:** `fly releases` to list, then `fly deploy --image <previous-image>`
  or `fly releases rollback`.
- **Frontend:** in the Vercel dashboard, promote a previous deployment.
- **Database:** migrations are forward-only here — keep a backup before destructive
  changes (Supabase → Database → Backups).
