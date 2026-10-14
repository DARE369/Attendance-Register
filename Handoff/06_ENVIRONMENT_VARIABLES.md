# 06 — Environment Variables

There are **two** sets of configuration:

1. **Backend** — read by `config.py` from a `.env` file at the
   `Peculiar Register/` root (local) or from **Fly.io secrets** (production).
2. **Frontend** — `VITE_*` variables baked in at build time (`.env.local` for
   local, Vercel project env / `.env.production` for production).

---

## Backend (`config.py`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SUPABASE_URL` | ✅ | — | Supabase project URL |
| `SUPABASE_KEY` | ✅ | — | Supabase anon key (reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (for writes) | falls back to `SUPABASE_KEY` | Service-role key; required for admin inserts/updates (bypasses RLS) |
| `JWT_SECRET` | ✅ | `dev-secret-change-in-production` | Signs JWTs — **must** be a long random string in prod |
| `ADMIN_REGISTER_SECRET` | ✅ | `""` | Gate for `/auth/register`; without it anyone could create admins |
| `FLASK_DEBUG` | — | `0` | `1` enables Flask debug mode (never in prod) |
| `SCHOOL_NAME` | — | `Peculiar School` | Shown in notifications/reports |
| `CORS_ORIGINS` | ✅ (prod) | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowlist; must include the Vercel frontend origin |
| `SMTP_SERVER` | — | `smtp.gmail.com` | Email server |
| `SMTP_PORT` | — | `587` | Email port (STARTTLS) |
| `SMTP_EMAIL` | ✅ (for email) | `""` | Gmail sender address |
| `SMTP_PASSWORD` | ✅ (for email) | `""` | Gmail **App Password** (16 chars, not login password) |
| `D7_API_TOKEN` | ✅ (for WhatsApp) | `""` | D7 Networks API token |
| `D7_WHATSAPP_FROM` | ✅ (for WhatsApp) | `""` | Registered WhatsApp sender, e.g. `+2348012345678` |

> ⚠️ **Twilio vs D7 mismatch:** `.env.example` still documents Twilio variables
> (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`), but the
> running code (`config.py` + `whatsapp_service.py`) uses **D7 Networks**
> (`D7_API_TOKEN`, `D7_WHATSAPP_FROM`). Set the **D7** variables. See doc 08.

### Where backend env lives
- **Local:** `Peculiar Register/.env` (one level above `school-attendance/`). Not committed.
- **Production:** `fly secrets set KEY=value` (see doc 03). View names with
  `fly secrets list`.

---

## Frontend (`VITE_*`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_API_BASE_URL` | ✅ | Backend base URL. Local: `http://localhost:5000`. Prod: `https://peculiar-register.fly.dev` |

### Where frontend env lives
- **Local:** `frontend/.env.local` (copy from `.env.local.example`)
- **Production:** `frontend/.env.production` (committed) **and/or** the Vercel
  project's environment variables. Remember: `VITE_*` is compiled in at build
  time — change it and you must **rebuild**.

---

## Secrets to rotate immediately after handoff

When ownership transfers, **rotate all of these** (the old owner has seen them):

- [ ] `JWT_SECRET` (invalidates all existing sessions — expected)
- [ ] `ADMIN_REGISTER_SECRET`
- [ ] `SUPABASE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (regenerate in Supabase → Settings → API)
- [ ] `SMTP_PASSWORD` (revoke old Gmail App Password, create a new one)
- [ ] `D7_API_TOKEN` (regenerate in D7 dashboard)

After rotating: update Fly secrets, redeploy backend, and re-issue admin logins.
