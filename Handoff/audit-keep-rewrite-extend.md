# Technical Audit: Peculiar Register (school-attendance) → Multi-Tenant School-Ops Platform

Audit date: 2026-08-09. Scope: `school-attendance/` as it exists on `main` today. All findings below are from reading the actual code (migrations, routes, services, frontend), not inferred.

---

## 1. Stack

**Backend**: Flask 3.0.0, Python (Docker image `python:3.12-slim`), gunicorn (2 workers) behind Fly.io (`fly.toml`, region `jnb`, single 512MB shared-CPU VM, always-on). No ORM — `services/supabase_client.py` is a hand-rolled REST wrapper around Supabase's PostgREST API using `requests`, authenticated with the **service-role key** (bypasses RLS entirely). Auth via PyJWT + bcrypt. PDF export via `fpdf2`. No lockfile beyond `requirements.txt`'s pinned `==` versions.

**Database**: Supabase-hosted Postgres. No migration tool (no Alembic) — schema lives in hand-written, manually-pasted SQL files under `migrations/`, run directly against the Supabase SQL editor. RLS is explicitly **disabled on every table** (`migrations/full_schema.sql:280-297`) with a comment stating the API layer is the security boundary.

**Frontend**: React 18.2, Vite 5, React Router 6, Tailwind 3, Axios, react-hot-toast. Deployed separately to Vercel; backend to Fly.io. No test script defined.

**How it runs today**: two independently deployed services (Vercel frontend, Fly.io/Docker backend) talking over HTTPS to a shared Supabase Postgres instance.

---

## 2. Architecture: single-tenant, no multi-tenant scaffolding

Confirmed by a repo-wide search: **zero** occurrences of `school_id`, `tenant_id`, `organization`, or anything similar, in any `.py`, `.sql`, `.jsx`, or `.js` file. Every table — `students`, `admins`, `attendance_logs`, `teachers`, `teacher_attendance_logs`, `holidays`, `fraud_alerts`, `audit_logs`, `message_templates`, `report_templates`, `scan_day_overrides`, `school_settings`, `student_groups` — is global, with no tenant-scoping column. `SCHOOL_NAME` is a single env var (`config.py:29`). RLS being off means there is no DB-enforced isolation mechanism to even repurpose — everything currently assumes one school, one Supabase project, one set of admins.

This is a real architectural fact, not a config toggle: every query in `supabase_client.py`, every unique constraint (e.g., `admins.username UNIQUE`, `teachers.barcode_id UNIQUE`, `students.student_id` as the PK with no tenant qualifier), and every route handler assumes a single global namespace.

---

## 3. Offline support: none

`hooks/usePersistentScans.js` writes to `localStorage`, but it's a **display cache of already-successful scans** (last 50, today only) for the scanner operator's UI — not a queue. The actual scan write is a synchronous `POST /api/scan` call; there is no retry, no `navigator.onLine` check, and no queue-and-replay logic anywhere in the frontend. No service worker, no IndexedDB, anywhere in the repo. If a scan fails at the network layer today, it's just lost. This is a fully online-only app.

---

## 4. Auth & RBAC

JWT (PyJWT, HS256, 8-hour expiry, bcrypt-hashed passwords). Three roles enforced via a DB CHECK constraint: `super_admin`, `admin`, `scanner`. Enforcement is **server-side and real** — `require_role()` decorators gate nearly every route in `admin.py`, `management.py`, `admin_management.py`, `settings.py`, `import_csv.py`, `reports.py`, `holidays.py`, `fraud_alerts.py`, `templates.py`. Admin-user management (`GET/POST /admins`, `DELETE /admins/<id>`) is correctly locked to `super_admin` only. Frontend `PrivateRoute` in `App.jsx` is a UX convenience layer on top of that, not the actual boundary.

One deliberate exception: `routes/scan.py` (`/api/scan`, `/api/scan/confirm`, `/api/test-scan`) has **no auth at all** — by design, per the README, since the scanning device isn't expected to hold admin credentials. `/api/test-scan` is documented as "dev only" but has no actual environment gating in code — it's live in production.

Risk to flag: `JWT_SECRET` defaults to the literal string `"dev-secret-change-in-production"` if the env var isn't set (`config.py:13`). Verify this is actually set in the Fly.io secrets — if not, tokens are forgeable today.

---

## 5. Notifications

Two real channels, both fully implemented: **Email** (Gmail SMTP, synchronous/blocking send) and **WhatsApp via D7 Networks' REST API** (not Twilio, not Meta Cloud API directly — despite the README and `.env.example` both still referencing Twilio, which is stale documentation; there is no `twilio` package dependency anywhere). WhatsApp requires pre-approved message templates (`parent_arrival`, `parent_departure`, `admin_late_arrival`) per Meta/D7's business-messaging rules. Both channels no-op silently (log + skip) if their env vars aren't configured, rather than erroring.

Dispatch is fire-and-forget from a background thread after each scan (`routes/scan.py`), driven by a DB-backed template system (`message_templates` table) with a hardcoded fallback dict. Two functions — `check_non_arrivals`, `check_non_departures` — exist fully implemented in `notification_service.py` but are **not wired to any scheduler**; nothing in the repo calls them. No SMS channel exists.

---

## 6. Attendance data model: gap analysis against your target fields

Actual `attendance_logs` schema (`migrations/full_schema.sql:73-89`):

```
log_id UUID PK · student_id TEXT FK · scan_timestamp TIMESTAMPTZ
log_type TEXT CHECK IN ('arrival','departure') · comments TEXT ('early'|'late'|NULL)
entry_point TEXT · is_holiday BOOLEAN · created_at TIMESTAMPTZ
```

| You need | Exists today? |
|---|---|
| `studentId` | `student_id` — present, different casing, fine |
| `type` (IN/OUT) | `log_type` (`arrival`/`departure`) — present, different vocabulary, trivial rename/map |
| `scannedAt` | `scan_timestamp` — present |
| `deviceId` | **Absent.** `entry_point` is a free-text gate/location label, not a device identity |
| `syncStatus` | **Absent entirely.** No concept of sync state anywhere, consistent with no offline queue existing |
| `notificationSentAt` | **Absent entirely.** Notifications are fire-and-forget with no persisted record of send time/status on the log row (or anywhere) |

So half your target fields exist under different names (cheap), and half don't exist at all because the two features that would need them (offline sync, notification tracking) were never built.

---

## 7. Code health

No automated tests of any kind — no `tests/` dir, no `pytest`/`jest` config, nothing. No TODO/FIXME/HACK comments anywhere (either genuinely clean, or just never annotated — can't distinguish from grep alone, but zero technical-debt markers is itself notable for a project this size). Documentation is **above average**: most service files carry module-level docstrings explaining intent (e.g., `services/tz.py` explains its WAT/no-DST design rationale, `notification_service.py` explains it runs in a background thread and must never block). Backend deps are exact-pinned; frontend deps use caret ranges. No Dependabot/Renovate. No LICENSE file in the repo.

Net: this is a solo/small-team project built with care and reasonable hygiene, but with zero safety net (no tests) and no production-grade schema migration tooling (manually-pasted SQL).

---

## 8. Ownership / licensing

No LICENSE file exists anywhere in the repo — worth adding regardless of what you decide below. Backend dependencies (Flask, PyJWT, bcrypt, requests, gunicorn, etc.) are the usual MIT/BSD/Apache set, **except `fpdf2`, commonly LGPL-3.0** — weak copyleft, doesn't force you to open-source the app, but confirm the exact license on the pinned `2.8.1` before shipping proprietary. Frontend dependency tree (full `package-lock.json` license scan): overwhelmingly MIT/ISC/Apache-2.0/BSD-3, **zero GPL/AGPL**. One `CC-BY-4.0` entry showed up in the scan but its owning package couldn't be pinned down conclusively — worth a two-minute `npm ls` check, but CC-BY is a content license (fonts/data), not a copyleft code license, so low risk either way. Nothing here blocks wholly-owned proprietary use.

---

## Recommendation, module by module

Your target: offline-first (RxDB/IndexedDB + Workbox), School as root tenant entity, RBAC enforced at the API layer, phone-camera QR as primary interface, NDPA-compliant ConsentRecord per guardian.

### Keep as-is

- **JWT auth mechanism** (`services/auth_service.py`, `routes/auth.py`) — bcrypt + JWT + `require_role()` decorator pattern is sound and already does what you're asking for (server-side RBAC, not just UI hiding). Reuse the pattern; you'll extend the token payload with `school_id`, but the plumbing stays.
- **Email service** (`services/email_service.py`) — fully working Gmail SMTP integration, no reason to touch it.
- **WhatsApp/D7 integration pattern** (`services/whatsapp_service.py`) — the template-based send logic and graceful no-op-when-unconfigured pattern are reusable as-is once it's parameterized per-school (see below).
- **Deployment shape** — Fly.io (backend) + Vercel (frontend) + Supabase (DB) is a reasonable, cheap, low-ops stack. No reason to migrate platforms just because you're adding tenancy or offline support.

### Extend

- **Auth/RBAC → add `school_id` to JWT claims and to the role model.** The `require_role()` decorator becomes `require_role()` + a tenant-scope check (does `g.school_id` match the resource's `school_id`). The mechanism is right; it currently enforces *role* but not *tenant boundary*, because there's no tenant concept yet. This is additive work on solid foundations, not a rewrite.
- **Notification services (email + WhatsApp)** — extend to take school-scoped config (each school's own D7 sender ID / Gmail account / template set) instead of the current single global `Config` values. The send logic itself doesn't need to change, just where it sources its credentials/templates from (per-school row instead of env var).
- **`attendance_logs` schema** — extend with `device_id`, `sync_status`, `notification_sent_at` columns, and rename/map `log_type` values conceptually to IN/OUT if you want that vocabulary. This is a migration, not a redesign — the table's grain (one row per scan event) is already correct for your model.
- **Data model generally** — every existing table needs a `school_id` FK added, plus corresponding unique constraints changed from global (e.g., `admins.username UNIQUE`) to per-school (`UNIQUE(school_id, username)`). Mechanical but touches every table and every query in `supabase_client.py`. Budget real time for this — it's not a one-line change, but it's schema surgery, not a rewrite.
- **Audit logging (`services/audit_service.py`)** — already exists and is reasonably designed; extend with `school_id` for the same reason as above.

### Rewrite from scratch

- **Frontend scan flow and persistence layer.** `usePersistentScans.js` and the synchronous `POST /api/scan` call are architecturally incompatible with offline-first. There's no queue, no conflict resolution, no service worker, no IndexedDB anywhere in this codebase — introducing RxDB + Workbox isn't an extension of what's there, it's new infrastructure replacing the entire scan-submission path (scan → write local → background sync → server reconciliation). Nothing here is salvageable except possibly the visual scan-log UI component as a rough template.
- **Scanner interface itself.** The current scanner (`ScannerInput.jsx`, `ScannerPage.jsx`) is built around a hardware barcode scanner emitting keystrokes into a text input — that's the primary interaction model today, not a fallback. Phone-camera QR scanning (e.g., via a camera-access library, live video decode) is a fundamentally different input mechanism and UI. Treat this as new build, not a modification.
- **Multi-tenant RLS strategy.** Today RLS is deliberately disabled everywhere, with the service-role key doing an end-run around Postgres-level isolation and the Flask API layer as the sole boundary. For a real multi-tenant platform you should decide now — and this is a decision, not a code-read finding — whether to keep "API-layer-only" isolation (extend path, higher risk of a missed `school_id` filter in some query becoming a cross-tenant leak) or move to RLS-enforced isolation using the anon key + per-request JWT claims (more correct, but functionally a rewrite of `supabase_client.py`'s auth model, since every call currently authenticates as the god-mode service role). Given you're building this for NDPA compliance where cross-tenant data leakage of children's attendance/location data is a serious compliance failure — not just a bug — I'd lean toward RLS-enforced isolation, but that's your call to make explicitly, not mine to assume.
- **ConsentRecord / guardian consent tracking.** Does not exist in any form — no consent table, no guardian-vs-parent distinction (only `parent_phone`/`parent_email` flat fields on `students`), no consent timestamp/version/withdrawal tracking. This is net-new schema and net-new UI (consent capture flow, likely at enrollment/onboarding), not an extension of anything present.

### Bottom line

The backend service layer (auth, notifications, audit logging, business logic in `attendance_service.py`) is well-written enough to extend rather than discard — it'll save you real time versus starting from zero on JWT/RBAC/email/WhatsApp plumbing. The data model needs mechanical-but-substantial surgery (tenant FK everywhere, RLS decision). But the entire client-side scan experience — the thing your new product is actually differentiated on (phone-camera QR, offline-first) — has zero reusable code today and should be budgeted as a full rewrite, not week-6 discovery. Also budget time for the ConsentRecord feature as new work; nothing adjacent exists to extend.
