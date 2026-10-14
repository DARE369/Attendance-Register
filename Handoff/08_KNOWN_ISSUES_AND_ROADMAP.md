# 08 — Known Issues, Tech Debt & Roadmap

Things the next maintainer should know about before making changes.

---

## ⚠️ Uncommitted working tree

At handoff time the git working tree has **many modified and untracked files that
are not committed**. The deployed code and the latest committed code may differ
from what's on disk. Before doing anything:

```bash
git status
git diff            # review modified files
```

Untracked-but-important files currently on disk include several **new frontend
components** (`AppShell.jsx`, `ScanOverridesManager.jsx`, `SchoolSettingsPanel.jsx`,
`StudentGroupsManager.jsx`), new backend helpers (`services/tz.py`), and the four
recent SQL migrations. Decide what to commit, then commit it so the repo matches
reality. Also present are scratch/diagnostic scripts (`diagnose.py`, `diagnose2.py`,
`full_sync.py`, `install_fix.py`) and loose CSVs (`LPS_Batch2_fixed.csv`,
`sample_students.csv`) at the repo root — review and remove or `.gitignore` these.

---

## 🔴 Security items to address

1. **WhatsApp provider mismatch (Twilio vs D7).** The running code uses **D7
   Networks** (`D7_API_TOKEN`, `D7_WHATSAPP_FROM` in `config.py` and
   `whatsapp_service.py`), but `.env.example` and the root `README.md` still
   document **Twilio**. Update the docs/`.env.example` to D7 to avoid confusion.

2. **RLS is disabled on all tables.** `full_schema.sql` runs
   `DISABLE ROW LEVEL SECURITY` on every table and the backend uses the
   service-role key. This is only safe because the DB is reachable *only* through
   the Flask backend. **Never** expose the Supabase anon URL/key to the browser
   without first re-enabling RLS and writing policies.

3. **Scan endpoints are unauthenticated.** `POST /api/scan` and
   `/api/scan/confirm` accept requests without a JWT (so the kiosk works). They
   are effectively open to anyone who knows the URL. Consider a shared device
   token, IP allowlist, or rate limiting before treating the API as public.

4. **Default secrets.** `JWT_SECRET` defaults to a known string and
   `ADMIN_REGISTER_SECRET` defaults to empty. Ensure both are set to strong random
   values in production (doc 06). Rotate after handoff.

5. **CORS.** `CORS_ORIGINS` must be pinned to the real frontend origin in prod;
   don't widen it to `*`.

---

## 🟠 Operational tech debt

- **Ephemeral logs on Fly.** Log files in `logs/` reset on every redeploy/restart.
  Use `fly logs`, or ship logs externally if you need durable history (doc 07).
- **Single Fly machine, 512 MB.** `min_machines_running = 1`, 1 shared CPU. Fine
  for a single school; revisit if scaling to multiple sites.
- **No automated tests / CI.** There is no test suite or CI pipeline. Changes are
  validated manually. Adding even smoke tests around scan classification and auth
  would reduce regression risk.
- **No database migration tool.** Migrations are hand-run SQL files in the Supabase
  SQL Editor. There is no version tracking — order and idempotency are managed by
  convention (doc 04). Consider adopting a migration runner.
- **Manual admin password reset.** No self-service reset flow (doc 07).

---

## 🟡 Documentation drift

- Root `README.md` is essentially empty (just a title); the real README is
  `school-attendance/README.md`. This Handoff folder supersedes both for
  onboarding.
- `school-attendance/README.md` references mock-data scripts under `scripts/`, but
  they live at the `school-attendance/` root (`generate_mock_data.py`,
  `load_mock_data.py`).
- `README.md` API table predates many endpoints (teachers, groups, holidays,
  fraud, analytics). Use [05 — API Reference](05_API_REFERENCE.md) instead.
- `schema.sql` / `school-attendance/schema.sql` are older; `migrations/full_schema.sql`
  is the current source of truth.

---

## ✅ Suggested first-week roadmap for the new owner

1. Transfer all third-party accounts (doc 09) and rotate secrets (doc 06).
2. Reconcile the uncommitted working tree — commit the real new code, delete scratch files.
3. Fix the Twilio→D7 documentation/`.env.example` mismatch.
4. Verify a clean local setup from scratch following doc 02 (catches missing migration steps).
5. Confirm a full backend + frontend deploy works end-to-end (doc 03).
6. Add a `.gitignore` entry for stray CSVs and a basic backup routine for Supabase.
7. (Stretch) Add smoke tests + a simple CI check on push.
