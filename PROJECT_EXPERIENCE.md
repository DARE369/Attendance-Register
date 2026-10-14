# Peculiar Register — Complete Engineering Experience Documentation

**Project:** Peculiar Register — School Attendance & Safeguarding System
**Client / Deployment:** Lekki Peculiar School (Lagos, Nigeria) — live production system
**Role:** Sole full-stack engineer (architecture, backend, frontend, database, DevOps, UX, docs, handover)
**Duration of work documented here:** May 2026 – August 2026
**Status:** Deployed and running in production; formally documented and handed over
**Repository:** `Peculiar Register/` (application in `school-attendance/`)

> **Purpose of this document.** This is a complete, evidence-based record of everything
> built, decided, debugged, deployed and documented on this project — written so it can be
> mined directly for a CV, a portfolio page, a technical interview, or a client proposal.
> Every claim below is traceable to code, migrations, commits, or config in this repository.
> Section 20 contains ready-to-paste CV bullets at three lengths.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem — Domain, Context and Constraints](#2-the-problem--domain-context-and-constraints)
3. [The Solution — Product Definition](#3-the-solution--product-definition)
4. [Complete Technology Stack](#4-complete-technology-stack)
5. [System Architecture](#5-system-architecture)
6. [Data Model & Database Engineering](#6-data-model--database-engineering)
7. [API Design & Full Endpoint Catalogue](#7-api-design--full-endpoint-catalogue)
8. [Feature-by-Feature Engineering Breakdown](#8-feature-by-feature-engineering-breakdown)
9. [Problem-Solving Strategy — Method](#9-problem-solving-strategy--method)
10. [Problem-Solving Case Studies — Real Bugs, Real Fixes](#10-problem-solving-case-studies--real-bugs-real-fixes)
11. [Performance Engineering](#11-performance-engineering)
12. [Reliability, Fault Tolerance & Graceful Degradation](#12-reliability-fault-tolerance--graceful-degradation)
13. [Security Engineering](#13-security-engineering)
14. [Frontend Architecture & UI/UX Practices](#14-frontend-architecture--uiux-practices)
15. [Third-Party Integrations](#15-third-party-integrations)
16. [DevOps, Deployment & Release Process](#16-devops-deployment--release-process)
17. [Observability & Operations](#17-observability--operations)
18. [Documentation, Handover & Client Communication](#18-documentation-handover--client-communication)
19. [Technical Audit & Forward Architecture (Multi-Tenant SaaS Path)](#19-technical-audit--forward-architecture-multi-tenant-saas-path)
20. [CV Bullets — Ready to Paste](#20-cv-bullets--ready-to-paste)
21. [Skills Matrix — Keyword Inventory](#21-skills-matrix--keyword-inventory)
22. [Interview Talking Points (STAR Format)](#22-interview-talking-points-star-format)
23. [Honest Gaps & What I'd Do Next](#23-honest-gaps--what-id-do-next)
24. [Transferable Workflows Companies Can Adopt](#24-transferable-workflows-companies-can-adopt)

---

## 1. Executive Summary

Peculiar Register is a production full-stack attendance and child-safeguarding platform built
for a Nigerian private school. Students and staff scan barcoded ID cards at the school gate.
Each scan is classified in real time as an arrival or departure against configurable time
windows, persisted to a PostgreSQL database, and — where enabled — triggers an automated
email and/or WhatsApp notification to the parent or guardian, all within the HTTP request
lifecycle without blocking the scanning operator.

Administrators operate the school from a single React dashboard with sixteen functional
areas: live attendance, analytics, PDF reporting, student and staff CRUD, CSV bulk import,
staff-type time configuration, holiday and scan-day control, fraud alerts, audit logs,
message templates, configurable time windows, notification routing, student groups,
multi-admin role management and profile settings.

**Scale of the artefact**
- ~14,000 lines of first-party application code (excluding dependencies)
- 11 Flask blueprints, 12 backend service modules, 3 model modules
- 22 React components + 10 route-level pages + 1 custom hook + 1 API client layer
- 16 database tables, 10 SQL migration files, 9 indexes
- 60+ documented HTTP endpoints
- 9 documents of formal handover material + 1 forward-looking technical audit
- 3 independently deployed platforms (Vercel, Fly.io, Supabase) + 2 external messaging providers

**Positioning statement (one sentence for a CV header):**
> Designed, built, deployed and handed over a production full-stack attendance and parent-
> notification platform (React + Flask + PostgreSQL, deployed on Vercel/Fly.io/Supabase) used
> daily at a Lagos school, covering real-time barcode scanning, multi-channel notifications,
> role-based access control, PDF reporting and CSV data migration.

---

## 2. The Problem — Domain, Context and Constraints

### 2.1 The core problem

A private school in Lagos was running attendance on paper registers. This produced four
distinct failures, each with a different stakeholder and a different cost:

| # | Failure | Who suffers | Cost |
|---|---------|-------------|------|
| 1 | **Parents have no idea when their child actually arrived or left.** | Parents / guardians | Anxiety; no ability to act on a child who never reached school; safeguarding blind spot |
| 2 | **The school cannot detect a non-arrival until someone happens to notice.** | School / child | A child who leaves home but never reaches school is invisible for hours — the single highest-severity scenario in the domain |
| 3 | **Attendance data is trapped on paper.** | Administration | No analytics, no punctuality trends, no term reports, no evidence for parent meetings or inspections |
| 4 | **Staff punctuality is unmeasured and unenforceable.** | Management | No objective record of teacher check-in/check-out; disputes are word-against-word |

The unifying insight: **this is not an "attendance app", it is a child-safety notification
system that happens to keep an attendance ledger.** That framing drove nearly every technical
decision below — particularly the decision that notification dispatch must never fail the scan,
and that the scan must never fail because a notification provider is down.

### 2.2 Environmental constraints that shaped the design

These are the constraints that make this project non-trivial and are worth naming explicitly
in an interview, because each one forced a design decision:

- **Gate throughput.** Hundreds of children arrive inside a ~30-minute window. A scan must
  complete in well under a second, with unmistakable visual feedback for a non-technical
  operator. Anything that queues at the gate fails the product.
- **The operator is not a computer user.** The person on the gate is a security officer, not
  an administrator. The interface must have effectively zero learning curve and no way to get
  into a broken state.
- **Hardware barcode scanners emit keystrokes, not events.** A USB/Bluetooth barcode scanner
  behaves as a keyboard that types the code and (sometimes) an Enter key. There is no scan API
  to subscribe to. This dictated the entire input architecture (§10.1).
- **Nigerian connectivity is unreliable.** Requests time out, DNS blips, providers rate-limit.
  Every outbound call needed retry, timeout and degradation policy.
- **Nigeria is UTC+1 with no daylight saving,** but the container base image (`python:3.12-slim`)
  ships without tzdata. Getting the wrong hour by one silently misclassifies every "late"
  arrival — a correctness bug with real consequences for a parent conversation.
- **WhatsApp is the real communication channel in Nigeria, not email.** But WhatsApp Business
  messaging is template-gated by Meta: you cannot send free-form business-initiated messages
  outside a 24-hour conversation window. This is a regulatory constraint on the messaging design,
  not a technical preference.
- **Budget is a single school's budget.** No Kubernetes, no managed queue, no observability SaaS.
  The architecture had to be genuinely cheap: one small always-on VM, a free-tier database,
  and a static frontend CDN.
- **Data is children's location data.** Cross-contamination or leakage is a safeguarding and
  (under Nigeria's NDPA) a compliance failure, not merely a bug.

### 2.3 Success criteria agreed up front

1. A scan is recorded and visually confirmed in under one second.
2. A parent receives a notification within seconds of their child's scan.
3. The gate keeps working when email/WhatsApp providers are down.
4. Administrators can migrate existing student records in bulk, not by typing.
5. Administration can produce a printable report without an engineer's involvement.
6. Attendance rules (times, holidays, notification policy) are changeable by the school,
   without a code deploy.

Criterion 6 became the defining architectural commitment: **configuration lives in the database,
not in code.** It is why `school_settings`, `staff_type_config`, `message_templates`,
`report_templates`, `holidays`, `scan_day_overrides`, `student_groups` and
`notification_settings` all exist as tables rather than constants.

---

## 3. The Solution — Product Definition

### 3.1 The scan pipeline (the heart of the product)

```
Barcode scanner (keyboard emulation)
   → hidden auto-focused input captures keystrokes
   → 50ms silence debounce auto-submits (no Enter key required)
   → client-side 2s cooldown rejects double-fire
   → POST /api/scan { barcode, entry_point }
        → regex validation of barcode shape
        → is scanning permitted today? (override > weekend > holiday > open)
        → single parallel lookup: is this a teacher or a student?
             → both?  → return "ambiguous", operator disambiguates in a modal
             → teacher → staff check-in/check-out path (grace periods, per-staff-type windows)
             → student → student arrival/departure path
        → server-side duplicate guard (configurable cooldown, in-memory, thread-safe)
        → determine arrival vs departure from today's last log
        → classify against DB-configured time windows (early / on time / late / invalid)
        → persist attendance log
        → spawn daemon thread → notification dispatch (never blocks the response)
   → JSON response
   → colour + icon visual state change, toast, local scan log entry
```

### 3.2 The three user roles

| Role | Scope | Where enforced |
|------|-------|----------------|
| `super_admin` | Everything, plus creating/deleting other admin accounts | Server-side `require_role('super_admin')` on admin-management endpoints |
| `admin` | Full operational dashboard: students, staff, settings, reports, imports, alerts | Server-side `require_role('admin','super_admin')` on every admin blueprint |
| `scanner` | The gate scanner page only — cannot reach the dashboard at all | Frontend route guard redirects; backend role checks are the real boundary |

The `scanner` role exists precisely because the gate device is a shared, physically exposed
terminal. It holds credentials that can do nothing but scan.

### 3.3 Complete feature inventory

**Scanning & attendance**
- Hardware barcode scanning with auto-submit and no keyboard interaction required
- Combined student + staff scanning on one device, with ambiguity resolution
- Arrival/departure inference from the day's log history (no operator mode-switching)
- Configurable time-window classification: early / on-time / late / invalid-time
- Staff check-in and check-out with per-staff-type windows and grace periods
- Duplicate-scan protection on both client and server
- Local persistent scan history (today only, capped at 50) surviving page reloads
- Live gate KPIs: arrivals, departures, errors

**Notifications**
- Parent arrival and departure notifications by email and WhatsApp
- Admin late-arrival alerts
- Non-arrival and non-departure sweep logic (implemented; scheduler not yet wired — see §23)
- Per-channel toggles (email on/off, WhatsApp on/off)
- Per-event toggles (late arrivals, non-arrivals, non-departures)
- Per-transport-mode routing (parent drop-off / school bus / self-transport) so bus children
  don't spam parents who already know
- Class-teacher notification on any scan of a student in their assigned class
- Admin-editable message templates with `{variable}` substitution, DB-stored, hot-reloaded
  every 60 seconds, with hardcoded fallbacks so template outage never causes notification outage

**Administration**
- Live dashboard polling with "updated Xs ago" freshness indicator
- Student CRUD + class filtering + search
- Teacher/staff CRUD with staff types
- Staff-type time configuration (check-in window, check-out window, grace period)
- CSV bulk import for students and teachers with per-row validation reporting
- Student groups with transport-mode semantics
- Holidays: single-day and date-range, scoped to students / staff / both
- Scan-day overrides: force-open a Saturday, force-close a school day
- School settings: every attendance time window editable from the UI
- Multi-admin management with role assignment (super_admin only)
- Profile editing and password change
- Audit logs of administrative actions
- Fraud alerts with severity, evidence payload, resolution workflow and admin notes

**Reporting & analytics**
- Aggregate analytics over an arbitrary date range
- Per-staff-member analytics (attendance rate, punctuality rate, monthly breakdown)
- CSV export of attendance
- Server-generated branded PDF reports in three templates:
  - **Daily Summary** — one school day, class breakdown, staff summary
  - **Period Report** — multi-day trend, class breakdown, most-frequent absentees
  - **Staff Report** — period attendance and punctuality per staff member
- Report template customisation: school name, colour scheme, sections, custom notes

---

## 4. Complete Technology Stack

### 4.1 Languages

| Language | Where used |
|----------|-----------|
| **Python 3.12** | Entire backend: API, business logic, integrations, PDF generation, CSV pipeline, diagnostics |
| **JavaScript (ES2022+, ESM)** | Entire frontend: React components, hooks, API client, build tooling config |
| **SQL (PostgreSQL dialect)** | 16-table schema, 10 migration files, indexes, constraints, seeds, RLS statements |
| **JSX** | React component markup |
| **HTML5 / CSS3** | SPA entry document; Tailwind layer directives, CSS custom properties, keyframe animations |
| **Bash / PowerShell** | Local dev workflow, deployment, log filtering, container shell operations |
| **Dockerfile** | Backend container definition |
| **TOML / JSON** | `fly.toml`, `vercel.json`, `package.json`, `.env` |

### 4.2 Backend stack (exact, pinned versions)

| Package | Version | Role |
|---------|---------|------|
| Flask | 3.0.0 | HTTP framework, application-factory pattern, blueprints |
| flask-cors | 4.0.0 | CORS policy with env-driven origin allowlist |
| python-dotenv | 1.0.0 | Environment loading via `find_dotenv()` |
| PyJWT | 2.10.1 | HS256 stateless auth tokens |
| bcrypt | 4.1.2 | Password hashing with per-password salt |
| python-dateutil | 2.8.2 | Date parsing helpers |
| requests | 2.31.0 | All outbound HTTP: PostgREST, D7 Networks |
| gunicorn | 21.2.0 | Production WSGI server, 2 workers, 120s timeout |
| fpdf2 | 2.8.1 | Server-side PDF report generation |

Standard library used deliberately rather than adding dependencies: `smtplib` + `email.mime`
(email), `csv` + `io` (import/export), `threading` (background dispatch, locks), `logging`
(multi-channel structured logs), `re` (input validation), `datetime`/`timezone` (time logic),
`functools.wraps` (decorators), `uuid`, `json`.

**Deliberate non-choices, and why:**
- **No ORM (no SQLAlchemy, no Django ORM).** Access goes through a hand-written PostgREST
  client. Rationale: Supabase exposes PostgREST over HTTPS; adding an ORM would have meant
  holding a direct Postgres connection pool from an ephemeral single-VM container, for no
  gain on a workload that is almost entirely simple filtered reads and single-row writes.
  The trade-off (losing migration tooling and type safety) is stated openly in §23.
- **No Celery/Redis/RQ.** Notification dispatch is a daemon thread. On a single always-on VM
  serving one school, a broker would have been more moving parts than the problem justified.
  The cost — no retry, no persistence across restart — is documented as known debt.
- **No Twilio.** Migrated to D7 Networks (§10.4).

### 4.3 Frontend stack

| Package | Version | Role |
|---------|---------|------|
| React | 18.2 | UI runtime; function components + hooks only, zero class components |
| React Router | 6.21 | SPA routing with role-aware route guards |
| Vite | 5.0 | Dev server with API proxying, production bundler |
| Tailwind CSS | 3.4 | Utility-first styling with an extended design-token theme |
| axios | 1.6 | HTTP client with request/response interceptors |
| react-hot-toast | 2.4 | Non-blocking operator feedback |
| PostCSS + autoprefixer | 8.4 / 10.4 | CSS pipeline |

**State management: none added deliberately.** No Redux, Zustand, or React Query. State is
local component state plus `localStorage` for the auth session and the scan cache. The app's
data is server-owned and polled; introducing a client cache layer would have added invalidation
complexity to solve a problem the 5-second server cache already solved.

### 4.4 Infrastructure & services

| Service | Role | Configuration |
|---------|------|---------------|
| **Supabase (PostgreSQL + PostgREST)** | Managed database, accessed over REST | 16 tables, service-role authentication |
| **Fly.io** | Backend hosting | App `peculiar-register`, region `jnb` (Johannesburg — closest to Lagos), 1 shared vCPU / 512 MB, `min_machines_running = 1`, forced HTTPS, `TZ=Africa/Lagos` |
| **Vercel** | Frontend hosting | Root `school-attendance/frontend`, SPA rewrite, build-time env injection, git-triggered deploys |
| **Docker** | Backend container | `python:3.12-slim`, layer-ordered for dependency caching |
| **Gmail SMTP** | Email delivery | STARTTLS on 587, App Password auth |
| **D7 Networks** | WhatsApp Business delivery | Meta-approved templates, bearer-token REST API |
| **Git / GitHub** | Version control | Descriptive commits with rationale in the body |

---

## 5. System Architecture

### 5.1 Topology

```
┌────────────────────────┐        HTTPS / JSON        ┌────────────────────────┐
│  React SPA (Vercel)    │ ─────────────────────────► │  Flask API (Fly.io)    │
│  Vite build → static   │   axios + Bearer JWT       │  gunicorn, 2 workers   │
│  CDN-delivered         │ ◄───────────────────────── │  11 blueprints         │
└────────────────────────┘                            └───────────┬────────────┘
                                                                  │ PostgREST/HTTPS
                                                                  │ service-role key
                                                                  ▼
                                                      ┌────────────────────────┐
                                                      │ Supabase PostgreSQL    │
                                                      └────────────────────────┘
                        ┌──────────────────────┐                  ▲
   background thread ──►│ Gmail SMTP           │                  │
                        │ D7 Networks WhatsApp │──────────────────┘
                        └──────────────────────┘
```

### 5.2 Architectural principles applied

1. **The browser never touches the database.** Supabase credentials exist only server-side.
   The API is the sole security boundary. This is stated explicitly in the schema file and is
   the justification for the RLS decision (§13.4).
2. **Layered separation with a single direction of dependency.**
   `routes/` (HTTP concerns: parsing, status codes, auth decorators)
   → `services/` (business logic, integrations)
   → `supabase_client.py` (the only module that knows what a database is).
   Nothing calls upward. One database access module means one place to change if the
   persistence layer is ever swapped.
3. **Application-factory pattern.** `create_app()` builds and configures the app; `wsgi.py`
   exposes `application` for gunicorn; `app.py` runs it directly in development. This makes
   the app testable and deployable through the same code path.
4. **Blueprint-per-domain.** Eleven blueprints, each a bounded functional area, all mounted
   under coherent URL prefixes by a single `register_blueprints()` function. Adding a feature
   area means adding one file and one line.
5. **Configuration in the database, not in code.** Any rule the school might want to change —
   time windows, holidays, notification policy, message wording, report branding — is a row,
   not a constant. A schedule change requires no engineer and no deploy.
6. **Notifications are never on the critical path.** The scan response is returned before the
   notification is attempted. Provider outage degrades to a log line.
7. **Graceful degradation everywhere, by default.** Missing template → built-in fallback.
   Unreachable settings table → in-process defaults. Unconfigured WhatsApp credentials → log
   and skip, not crash. The gate keeps working.

### 5.3 Backend module map

```
app.py                     application factory, multi-channel logging setup, CORS, /health
wsgi.py                    gunicorn entrypoint
config.py                  typed config surface over environment variables

routes/                    HTTP layer — 11 blueprints
  __init__.py              blueprint registration and URL prefixing
  auth.py                  login, register, /me, token_required, require_role decorators
  scan.py                  scan, scan/confirm, test-scan; day-status gate; notification launch
  admin.py                 dashboard aggregation (+5s cache), attendance log, CSV export
  admin_management.py      admin CRUD (super_admin only), profile, password change
  management.py            students, teachers, staff types, groups, school settings
  settings.py              notification settings, WhatsApp test send
  import_csv.py            student and teacher CSV upload endpoints
  templates.py             message template read/update
  holidays.py              holidays, scan-day overrides, scan-day status
  fraud_alerts.py          alert listing and resolution
  reports.py               report templates, PDF generation, analytics, audit logs

services/                  business logic — 12 modules
  supabase_client.py       the ONLY database module: PostgREST wrapper, retries, error mapping
  auth_service.py          bcrypt hashing, JWT issue/decode, authenticate, register
  attendance_service.py    student scan classification, settings cache, duplicate guard
  teacher_attendance_service.py  staff check-in/out state machine, grace periods
  notification_service.py  dispatch orchestration, template engine, routing policy, sweeps
  email_service.py         SMTP transport, templated + rich HTML admin notifications
  whatsapp_service.py      D7 Networks transport, Meta template messages, phone normalisation
  holiday_service.py       day-status resolution with documented precedence order
  audit_service.py         non-blocking administrative action logging
  csv_service.py           three-phase import pipeline: validate → dedupe → batch insert
  pdf_service.py           branded PDF engine: headers, footers, KPI rows, tables, 3 templates
  tz.py                    fixed-offset WAT time source (documented rationale)

models/                    lightweight record shapes: student, admin, attendance_log
migrations/                10 SQL files, idempotent, ordered
```

---

## 6. Data Model & Database Engineering

### 6.1 Tables (16)

| Table | Grain | Notable engineering |
|-------|-------|---------------------|
| `students` | One row per student | PK is the **barcode value itself** — the scan is a primary-key lookup, the fastest possible read. Indexed on `class`. Carries `transport_mode` and `group_tag` for notification routing |
| `admins` | One row per admin user | UUID PK, bcrypt `password_hash`, `role` CHECK-constrained to `super_admin`/`admin`/`scanner`, JSONB `permissions` reserved for future granularity, `is_active` flag. The **oldest admin is auto-promoted to super_admin** by migration — a bootstrap solution to "who grants the first grant?" |
| `attendance_logs` | One row per scan event | Correct event-sourced grain: append-only, never mutated. Three indexes: `student_id`, `scan_timestamp DESC`, `log_type`. Cascade delete from students |
| `teachers` | One row per staff member | `barcode_id` UNIQUE, `staff_type` FK to config, `assigned_class` + `notify_on_scan` for class-teacher notifications |
| `teacher_attendance_logs` | One row per (teacher, date) — UNIQUE constraint | Deliberately a **different grain from students**: a staff day is a single record mutated from check-in to check-out, because a staff member has exactly one in and one out. The uniqueness constraint makes double check-in impossible at the database level |
| `staff_type_config` | One row per staff type | Per-role time windows and grace period. Seeded with Teacher / Admin Staff / Support Staff |
| `school_settings` | Key/value | The de-hardcoding table. 9 seeded keys covering every arrival, departure and cutoff boundary plus duplicate cooldown |
| `holidays` | One row per holiday or range | `holiday_date` → `holiday_end_date` supports ranges; `holiday_type` and `applies_to` (students/staff/both) |
| `scan_day_overrides` | One row per overridden date | UNIQUE on date; `allow`/`block` semantics that beat weekend and holiday rules |
| `student_groups` | One row per named group | Carries `transport_mode`; seeded with Bus Group A/B, Parent Drop-off, Walkers |
| `notification_settings` | One row per admin | Per-channel, per-event and per-transport-mode toggles |
| `message_templates` | One row per template key | Subject, plaintext body, HTML body, channel, active flag |
| `report_templates` | One row per report type | School name, logo, colour scheme, JSONB `sections`, custom notes |
| `fraud_alerts` | One row per detected pattern | `severity`, `involved_ids[]` array, JSONB `evidence`, resolution workflow with admin notes. Indexed on severity, resolved, date |
| `audit_logs` | One row per admin action | Before/after JSONB values, action verb, table, record id, description |

### 6.2 Schema engineering decisions worth naming

- **Idempotent migrations by discipline.** Every statement is `CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, or a guarded `DROP CONSTRAINT IF EXISTS`.
  Any migration can be re-run against a live database without damage. Without a migration
  runner, idempotency *is* the safety mechanism — a deliberate compensating control.
- **A consolidated `full_schema.sql`.** After ten incremental migrations, I collapsed the
  complete state into one idempotent file that provisions a blank database in a single paste.
  This turns "clone the repo and follow 10 steps in order" into one step, and eliminates an
  entire category of onboarding error.
- **CHECK constraints as domain enforcement.** `log_type IN ('arrival','departure')`,
  `role IN ('super_admin','admin','scanner')`, `transport_mode IN (...)`,
  `severity IN ('low','medium','high')`. Invalid states are unrepresentable at the storage
  layer, not merely validated in Python.
- **Indexes chosen from actual query shapes**, not speculatively: `students(class)` because
  the dashboard groups by class; `attendance_logs(scan_timestamp DESC)` because every read is
  "today, newest first"; `attendance_logs(log_type)` because arrival/departure filtering is
  the most common predicate; three indexes on `fraud_alerts` matching its three filters.
- **PostgREST embedded resource selection** (`select=*,students(full_name,class)`) to join
  student names into log queries in a single round trip, avoiding an N+1 pattern across HTTP.

### 6.3 The PostgREST client — engineering a data layer without an ORM

`services/supabase_client.py` (629 lines) is the single point of database contact. It implements:

- **A generic `_request()` core** handling method, table, query params, body, and single-row mode
- **Retry with linear backoff**: 3 attempts, 1s then 2s, on transport-level exceptions only
  (never on HTTP errors — retrying a 400 is pointless and retrying a 500 write risks duplication)
- **30-second timeouts** on every call — no unbounded hangs
- **HTTP 406 → `None`.** PostgREST returns 406 for "single row requested, none found." The client
  maps that to `None` rather than an exception, because *not finding a student is normal
  business flow, not an error.* This one decision removes exception handling from every caller.
- **Actionable error translation.** A 401/403 on a write doesn't surface as "HTTP 403" — it
  raises with the message *"Supabase rejected this write. Set SUPABASE_SERVICE_ROLE_KEY in the
  server .env or add the required insert/update RLS policy for this table."* The error tells
  the operator what to do. This is a deliberate practice: **errors are documentation delivered
  at the moment of failure.**
- **Upsert support** via `on_conflict` params and `Prefer: resolution=merge-duplicates`
- **Batch operations** — `batch_upsert_students()` inserts an entire CSV in one HTTP call
- **Typed helpers** — `_eq()`, `_in()` build PostgREST filter syntax in one place

---

## 7. API Design & Full Endpoint Catalogue

### 7.1 Design conventions applied consistently

- **Resource-oriented URLs** with domain-grouped prefixes (`/auth`, `/api/scan`, `/api/admin/*`)
- **HTTP verbs used semantically**: GET read, POST create, PUT full replace, PATCH partial
  update, DELETE remove
- **Consistent envelopes.** Every scan response has the same shape — `status`, `action`,
  `message` — whether it succeeded, failed, was ambiguous, or was blocked by a holiday. The
  frontend renders one code path.
- **The staff scan response deliberately reuses the student field names** (`student_name`
  carries a teacher's name) so a single `ScanLog` component renders both without branching.
  A pragmatic contract decision, documented in the code where it is made.
- **Status codes chosen to mean something:** 400 validation, 401 unauthenticated, 403 wrong
  role or bad register secret, 404 not found, 409 conflict on duplicate ID creation with
  inline field errors, 500 server. **Holiday closure returns 200**, not an error — the request
  succeeded, the answer is "we're closed" (this had a real bug consequence; see §10.5).
- **Whitelisted update fields.** PATCH handlers filter the incoming body against an explicit
  `allowed` set before touching the database — no mass-assignment vulnerability.
- **Human-readable `message` alongside machine-readable `error`** on every failure, so the UI
  can show the message and the log can record the error.

### 7.2 Full endpoint catalogue (60+)

**Health**
| Method | Path | Auth |
|---|---|---|
| GET | `/health` | none |

**Auth — `routes/auth.py`**
| Method | Path | Auth |
|---|---|---|
| POST | `/auth/login` | none → returns `{token, admin}` |
| POST | `/auth/register` | shared registration secret |
| GET | `/auth/me` | JWT |

**Scan — `routes/scan.py`**
| Method | Path | Auth |
|---|---|---|
| POST | `/api/scan` | none (kiosk device) |
| POST | `/api/scan/confirm` | none (kiosk device) |
| GET | `/api/test-scan` | none — supports `?time=HH:MM` to simulate any clock time |

**Dashboard & export — `routes/admin.py`**
| Method | Path | Auth |
|---|---|---|
| GET | `/api/admin/dashboard` | admin |
| GET | `/api/admin/students/<class_name>` | admin |
| GET | `/api/admin/attendance-log` | admin |
| GET | `/api/admin/export-csv` | admin |

**Admin users & profile — `routes/admin_management.py`**
| Method | Path | Auth |
|---|---|---|
| GET / PATCH | `/api/admin/profile` | admin |
| POST | `/api/admin/change-password` | admin |
| GET / POST | `/api/admin/admins` | **super_admin** |
| DELETE | `/api/admin/admins/{id}` | **super_admin** |

**Notification settings — `routes/settings.py`**
| Method | Path | Auth |
|---|---|---|
| GET / POST | `/api/admin/settings` | admin |
| POST | `/api/admin/settings/test-whatsapp` | admin |

**Bulk import — `routes/import_csv.py`**
| Method | Path | Auth |
|---|---|---|
| POST | `/api/admin/import-csv` | admin (multipart) |
| POST | `/api/admin/teachers/import` | admin (multipart) |

**Message templates — `routes/templates.py`**
| Method | Path | Auth |
|---|---|---|
| GET | `/api/admin/templates` | admin |
| POST | `/api/admin/templates/{key}` | admin |

**Management — `routes/management.py`**
| Method | Path | Auth |
|---|---|---|
| GET / POST | `/api/admin/students` | admin |
| PUT / DELETE | `/api/admin/students/{student_id}` | admin |
| GET / POST | `/api/admin/teachers` | admin |
| PUT / DELETE | `/api/admin/teachers/{teacher_id}` | admin |
| GET / POST | `/api/admin/staff-types` | admin |
| PUT / DELETE | `/api/admin/staff-types/{config_id}` | admin |
| GET | `/api/admin/teacher-logs` | admin |
| GET / POST | `/api/admin/student-groups` | admin |
| PUT / DELETE | `/api/admin/student-groups/{id}` | admin |
| GET / PUT | `/api/admin/school-settings` | admin |

**Holidays & scan control — `routes/holidays.py`**
| Method | Path | Auth |
|---|---|---|
| GET / POST | `/api/admin/holidays` | admin |
| PATCH / DELETE | `/api/admin/holidays/{id}` | admin |
| GET / POST | `/api/admin/scan-overrides` | admin |
| DELETE | `/api/admin/scan-overrides/{date}` | admin |
| GET | `/api/admin/scan-day-status` | admin |

**Fraud alerts — `routes/fraud_alerts.py`**
| Method | Path | Auth |
|---|---|---|
| GET | `/api/admin/fraud-alerts?resolved=` | admin |
| PATCH | `/api/admin/fraud-alerts/{id}` | admin |

**Reports & analytics — `routes/reports.py`**
| Method | Path | Auth |
|---|---|---|
| GET | `/api/admin/reports/templates` | admin |
| PATCH | `/api/admin/reports/templates/{key}` | admin |
| POST | `/api/admin/reports/generate` | admin — returns PDF bytes |
| GET | `/api/admin/analytics?start=&end=` | admin |
| GET | `/api/admin/staff-analytics/{teacher_id}` | admin |
| GET | `/api/admin/audit-logs` | admin |

### 7.3 API client architecture (frontend)

`services/api.js` is a single module wrapping axios:

- **One configured instance** with base URL from build-time env and a 10-second default timeout
- **Request interceptor** attaches the JWT from `localStorage` to every outbound call — no call
  site ever handles auth
- **Response interceptor** intercepts any 401, clears the session and hard-redirects to login —
  session expiry is handled once, globally, rather than in 40 components
- **Per-endpoint timeout overrides tuned to reality:** 60s for the dashboard (Supabase free-tier
  cold start), 120s for CSV imports (large files), 30s for analytics, 10s default
- **Blob handling for CSV export**: builds an object URL, triggers a synthetic download, and
  **revokes the object URL** — no memory leak
- **Every endpoint exported as a named function**, so the entire server contract is readable in
  one 166-line file. This file doubled as the source of truth when writing the API reference doc.

---

## 8. Feature-by-Feature Engineering Breakdown

### 8.1 Scan classification engine (`attendance_service.py`)

A six-stage pipeline with an explicit failure response at every stage:

1. **Duplicate guard** — thread-safe in-memory map of last-scan times, cooldown read from DB
2. **Student lookup** — skipped entirely if the caller already fetched the record (see §11)
3. **Arrival vs departure inference** — reads today's most recent log; no log or last log was a
   departure → this is an arrival; otherwise a departure. The operator never selects a mode.
4. **Time-window classification** — windows loaded from the database, cached 60 seconds
5. **Persistence** — with `early`/`late` normalised for storage, `invalid_time` stored as NULL
   but still surfaced as a warning in the response
6. **Response assembly** — including a human sentence the operator can read at a glance

The window model is a list of `(start, end, comment)` tuples evaluated with half-open intervals
`start <= t < end`, so boundaries can never double-classify. Adding a new window category is
adding a tuple.

### 8.2 Staff attendance state machine (`teacher_attendance_service.py`)

A three-state machine on the day's single record:
- **No record, or record without check-in** → check-in path
- **Record with check-in, no check-out** → check-out path
- **Both present** → "already completed for today"

Status determination is arithmetic in total minutes (avoiding `datetime` comparison pitfalls),
and produces human comments: *"Late by 7 minutes"*, *"Left 23 minutes early"*, *"Checked out 15
minutes after window"* — with correct singular/plural. The grace period is added to the window
end, not subtracted from lateness, so "5-minute grace" means exactly what a head teacher expects.

### 8.3 Notification dispatch (`notification_service.py`)

- Launched in a **daemon thread** from the route, wrapped in its own try/except so a thread
  crash cannot take the process down
- **Template engine**: DB templates cached 60s → built-in fallback dict → skip. Note the cache
  timestamp is updated even on a *failed* DB read, specifically to prevent hammering a broken
  database once per notification.
- **Variable substitution** by simple `{key}` replacement with `None`-safe coercion
- **Routing policy** in `should_notify_parent()`: transport-mode aware, with different defaults
  per mode (school bus defaults **off**, parent drop and self-transport default **on**) —
  encoding the real-world observation that bus parents already know the bus arrived
- **Class-teacher notification** looks up teachers with `notify_on_scan` for the student's class
  and messages them, wrapped in its own try/except so a teacher-notification failure cannot
  break the parent notification
- **Admin alerting** iterates every admin's settings row independently
- **Sweep functions** `check_non_arrivals()` and `check_non_departures()` implement the highest-
  safeguarding-value feature (a child who never arrived) by set-differencing enrolled students
  against today's arrival logs, and by finding students whose most recent log is an arrival

### 8.4 CSV import pipeline (`csv_service.py`)

A three-phase design chosen specifically to make a 500-row import a **two-HTTP-call operation**
rather than 1,000:

1. **Validate all rows in memory** — regex on ID shape, required fields, E.164 phone format,
   email shape. Collect per-row errors with the reason, don't abort the batch.
2. **Check duplicates in ONE query** — collect all candidate IDs and issue a single
   `student_id=in.(...)` request, rather than a `SELECT` per row.
3. **Batch insert** the new rows in one call with `on_conflict` protection.

Handles UTF-8 BOM (`utf-8-sig`) because real school CSVs come out of Excel. Normalises headers
(strip + lowercase) because real spreadsheets have `Student_ID ` with a trailing space. Enforces
a 5 MB cap. Returns a structured report — total, inserted, skipped, errors, and a per-row
detail list — which the UI renders as a reviewable table rather than a bare success message.

### 8.5 PDF report engine (`pdf_service.py`)

A subclassed `FPDF` base providing a reusable document system:
- Branded header band drawn on every page, page-numbered footer
- `section_title()`, `kpi_row()`, `table_header()` composable primitives
- **Semantic colour coding**: attendance ≥80% green, ≥60% orange, below red — the same
  thresholds used in the dashboard, so a printed report and the screen agree
- Three templates built from those primitives
- Server-side generation returning bytes, streamed to the browser as a download
- A 90-day range cap on report generation to bound memory and generation time

### 8.6 Day-status resolution (`holiday_service.py`)

A small module whose value is entirely in having an **explicitly documented precedence order**:

```
1. Admin override (allow / block)   ← always wins
2. Weekend rule
3. Holiday rule
4. Otherwise: open
```

This is written into the docstring because "why did scanning work on that Saturday?" is a
question someone will ask in two years. Both database lookups are individually wrapped so that
a database failure **fails open to a normal school day** rather than closing the gate — the
correct failure direction for this domain.

### 8.7 Fraud alerts

A review workflow rather than an enforcement mechanism, by design: patterns are surfaced with
a severity, the involved parties, and a JSONB evidence payload; an administrator resolves the
alert with notes. The system never auto-punishes; a human is always in the loop on an accusation.

---

## 9. Problem-Solving Strategy — Method

This section describes *how* problems were approached, not just what was fixed. It is the part
of the work most transferable to another codebase.

### 9.1 The debugging method used consistently

1. **Reproduce with the narrowest possible input.** Which barcodes fail — all, or only some?
   (§10.2 was solved the moment the answer turned out to be "only multi-word staff types".)
2. **Bisect the layer.** Frontend, network, backend, or database? Check the shape of the actual
   HTTP payload before theorising.
3. **Read the wire, not the abstraction.** The double-encoding bug was invisible in Python and
   obvious in the raw query string.
4. **Ask what changed.** New feature, new dependency, new data, or new environment?
5. **Fix the cause at the correct layer.** The URL-encoding bug was fixed in the one place that
   builds filters, not patched at eleven call sites.
6. **Encode the lesson.** Add a comment explaining *why*, and write the commit body so the next
   person understands the reasoning, not just the diff.

### 9.2 Production diagnosis under constraint

When the deployed backend returned 500s that could not be reproduced locally, I wrote
`diagnose.py` — a self-contained probe run inside the live Fly.io container via `fly ssh console`
that checked, in order:

1. Do the new modules import cleanly? (catches deploy-time import errors)
2. Does the `admins` table actually have the new columns? (catches "code deployed, migration didn't")
3. Does the `report_templates` table exist?
4. Can a minimal PDF actually generate with synthetic data? (isolates the library from the data)

Each check prints a full traceback rather than a summary. This is a **layered elimination probe**:
it distinguishes a code problem from a schema problem from a data problem in a single run, on
the machine that actually has the problem. It found the real cause — schema drift between the
deployed code and the database — in one pass.

I also wrote `full_sync.py`, a hot-patch utility that pulls changed files from GitHub directly
into the running container and signals gunicorn to reload — a deliberate, documented emergency
tool for iterating on a production 500 without a full container rebuild cycle. Naming it as an
emergency tool rather than pretending it is a deployment mechanism is part of the practice.

### 9.3 The "make it configurable" reflex

The repeated pattern across this project: when a stakeholder asks to change a number, the answer
is not to change the number. It is to ask **"will they want to change it again?"** and, if yes,
move it into the database with a UI. This is why arrival windows, holiday rules, notification
policy, message wording, report branding and staff grace periods are all data.

The engineering cost is a table, an endpoint, a settings panel and a cache. The payoff is that
the school never needs an engineer to change a school rule — which is the difference between a
system that is maintained and a system that is abandoned.

### 9.4 Failure-direction analysis

For every failure mode, I asked which way it should fail:

| Component | Fails toward | Reasoning |
|---|---|---|
| Holiday/day-status check | **Open** (scanning allowed) | A missed holiday logs harmless extra rows; a false closure blocks every child at the gate |
| Template loading | **Built-in defaults** | A missing template must never mean a parent gets no message |
| School-settings load | **Cached, then hardcoded defaults** | Classification must always produce an answer |
| WhatsApp/email unconfigured | **Log and skip** | The gate must not depend on a messaging provider |
| Duplicate guard | **Reject the second scan** | A false duplicate costs 5 seconds; a double log corrupts the record |
| Notification thread crash | **Caught, logged, discarded** | Never take down the API process |
| Supabase transport error | **Retry 3x, then a clear error** | Transient network is the common case in this environment |

This table is the design. Stating it explicitly is what makes the behaviour intentional rather
than accidental.

### 9.5 Reading the actual code before deciding

The forward-looking technical audit in this repository (`Handoff/audit-keep-rewrite-extend.md`)
was produced by reading migrations, routes, services and frontend directly — including
repo-wide searches to *prove* negatives ("zero occurrences of `school_id`, `tenant_id`, or
`organization` in any file"). It separates verified findings from decisions the owner must make,
and explicitly labels which conclusions are code-read facts versus judgement calls. That
discipline — never asserting an architectural fact you have not verified — is the habit worth
carrying into any codebase.

---

## 10. Problem-Solving Case Studies — Real Bugs, Real Fixes

Each of these is a genuine defect from this project's history, with the diagnosis and the fix.
These are the strongest interview material in this document.

### 10.1 Building a scanner interface for hardware that isn't a scanner API

**Problem.** A USB barcode scanner is a keyboard. It types characters extremely fast and may or
may not send Enter, depending on the model and its configuration. There is no event to listen
for. The operator must not have to click anything, and the input must not be visible or
editable — a visible text box invites someone to type in it.

**Solution — a four-part input architecture:**
1. **An invisible, always-focused input.** `opacity-0`, one pixel, `pointer-events-none`,
   `tabIndex={-1}`. Global `click` and `keydown` listeners refocus it continuously, so the field
   cannot lose focus by any user action.
2. **Silence-based auto-submit.** Once four or more characters are present, a 50 ms timer starts
   and resets on every keystroke. A human types slower than 50 ms between characters; a barcode
   scanner is far faster. When the burst stops, submission fires — no Enter key required, and it
   works with scanners that don't send one.
3. **A ref mirroring the state value.** `barcodeRef` shadows the `barcode` state because the
   timeout callback closes over a stale value. Before submitting, the timer verifies
   `barcodeRef.current === value` — confirming nothing arrived during the window.
4. **A client-side 2-second cooldown** independent of the server's guard, so a slow network can't
   produce a double submission.

**Accessibility footnote.** The invisible input was originally `aria-hidden="true"`. That is
invalid per WAI-ARIA — an element that receives focus must not be hidden from assistive
technology — so it was changed to a descriptive `aria-label`. Fixing accessibility on an
*invisible* element is exactly the kind of correctness that gets skipped; it was fixed and
committed with the spec reasoning in the message.

### 10.2 The double URL-encoding bug (the best diagnostic story)

**Symptom.** Staff-type lookups worked for `Receptionist` but silently returned nothing for
`Teaching Staff`, `Part-Time Teaching Staff` and `Facility Manager`. No error, no exception —
just an empty result, which surfaced downstream as "Configuration missing. Contact admin."

**Diagnosis.** The distinguishing variable was not the staff type but the **space**. Every
failing value was multi-word. The filter helper `_eq()` was calling `quote()` on the value to
build `eq.Teaching Staff` into `eq.Teaching%20Staff`. Then `requests` — correctly — percent-encoded
the parameter again on the way out, turning `%20` into `%2520`. PostgREST received the literal
string `Teaching%20Staff`, matched nothing, and returned an empty array. Empty is not an error,
so nothing was logged.

**Fix.** Remove the manual `quote()` and let `requests` own encoding entirely — one layer of
encoding, one owner. Fixed in `_eq()`, which is the single place filters are built, so all
eleven call sites were fixed at once.

**The transferable lesson:** when two layers both "helpfully" handle encoding, you get corruption
that looks like missing data. Establish exactly one owner for any transformation, and be
suspicious of silent empty results — they hide bugs that exceptions would have surfaced.

### 10.3 FPDFUnicodeEncodingException in production PDF generation

**Symptom.** Daily Summary reports generated fine. Every Period Report and Staff Report crashed.

**Diagnosis.** fpdf2's built-in Helvetica is a Latin-1 font. The period header and the teacher
check-in fallback string contained an em-dash (U+2014) — a character I'd used freely elsewhere
because it renders fine in HTML, logs and the terminal. It has no Latin-1 codepoint.

**Fix.** Replace em-dashes with ASCII hyphen-minus in PDF-bound strings.

**The lesson:** a character set that is safe in one output medium is not safe in all of them.
Output-medium encoding constraints must be checked per medium, and the failure only appears on
the code paths that use the affected string — which is why only two of three templates broke.

### 10.4 Migrating the WhatsApp provider from Twilio to D7 Networks

**Problem.** The system was initially specified against Twilio, but Twilio's WhatsApp path was
not workable for this deployment's region and requirements. The channel matters more than the
provider — WhatsApp is *the* communication medium for Nigerian parents; email is secondary.

**Work done.** Rewrote `whatsapp_service.py` (209 lines changed) against D7 Networks' REST API:
- Bearer-token authentication, D7's nested `messages[].content` payload structure
- **Meta-approved template messages** (`parent_arrival`, `parent_departure`, `admin_late_arrival`)
  with positional `body_parameter_values`, because business-initiated WhatsApp messages outside
  a 24-hour conversation window *must* be templates — a platform policy constraint, not a
  technical one. The code documents this at the call site.
- A separate free-form text path used only where a conversation window exists (teacher
  notifications, admin test sends)
- **Phone normalisation** handling the `whatsapp:` prefix left over from Twilio and enforcing
  a leading `+`, so historical data in either format keeps working
- **Configuration-gated no-op**: if credentials are absent, log and return rather than raise
- **Error handling that logs the provider's response body**, not just the status code — because
  D7's diagnostics are in the body
- A **setup checklist written into the module docstring**: register the number, create the
  templates, submit for Meta approval, set the Fly secrets. The runbook lives next to the code.

**The lesson:** integrating a messaging provider is 20% HTTP and 80% understanding the platform's
policy model. Encoding that policy knowledge in comments is what stops the next engineer from
"simplifying" the templates into free text and silently breaking delivery.

### 10.5 The holiday response that displayed as "undefined"

**Symptom.** Scanning on a closed day showed a green success toast reading `undefined -`.

**Diagnosis.** The backend deliberately returns **HTTP 200** for a holiday closure — the request
succeeded, the answer is "we are closed." But the frontend treated any 200 as a successful scan
and read `data.student_name`, which doesn't exist on that payload.

**Fix.** Branch on the `status` field rather than on the HTTP status code, handling `holiday` and
`ambiguous` as distinct outcomes before the success path, plus a fallback to `data.message` when
`student_name` is absent.

**The lesson:** HTTP status describes the transport; the payload describes the business outcome.
A client that infers business meaning from the status code will eventually be wrong. This also
demonstrates why the consistent response envelope (§7.1) matters — the fix was possible in one
place because every response carries `status`.

### 10.6 Role escalation through the UI

**Symptom.** A `scanner`-role account could reach the admin dashboard by typing the URL.

**Fix — in both layers, deliberately:**
- **Backend (the real boundary):** every admin blueprint gained
  `require_role('admin','super_admin')`; admin-user management gained `require_role('super_admin')`.
  The role travels in the JWT claim and is checked server-side on every request.
- **Frontend (UX only):** `PrivateRoute` gained an `adminOnly` prop; the default redirect routes
  by role; login navigates by role instead of a hardcoded path; the Dashboard link is hidden
  from scanner accounts.

**The lesson, stated explicitly in the code comments:** the frontend guard is a convenience so
users don't see doors they can't open. It is not security. Security is the server-side decorator.
Both were implemented, and which one is which is documented.

### 10.7 Sequential lookups on the hot path

**Symptom.** Every scan issued a teacher lookup, waited, then a student lookup — two sequential
round trips to Supabase on the single most latency-sensitive operation in the product.

**Fix.** `get_both_by_barcode()` performs the two lookups concurrently with a `ThreadPoolExecutor`,
returning `(teacher, student)`. Roughly halves scan lookup latency. It also enabled a feature
that didn't exist before: because both results are now available, the system can **detect that a
barcode matches both a teacher and a student** and return an `ambiguous` response, prompting the
operator to disambiguate — turning a silent data-integrity problem into a handled UX flow.

**The lesson:** a performance fix that reveals a correctness problem is worth more than the
milliseconds. The parallel fetch is faster *and* strictly more correct.

### 10.8 Duplicate record creation returning an unusable error

**Symptom.** Creating a student with an existing ID surfaced a raw database constraint error.

**Fix.** Explicit pre-check returning **409 Conflict** with field-level error information, which
the frontend renders inline against the offending form field rather than as a generic toast.

**The lesson:** a database constraint is a last line of defence, not a user-facing error message.
The API should translate storage-layer violations into application-layer meaning.

### 10.9 Timezone correctness without tzdata

**Problem.** `python:3.12-slim` has no tzdata. `TZ=Africa/Lagos` in `fly.toml` is not reliably
sufficient, and adding `pytz`/`tzdata` adds a dependency and image weight for one fixed offset.
Getting this wrong by one hour silently misclassifies every borderline arrival as late or on time.

**Fix.** `services/tz.py` — a 25-line module using `timezone(timedelta(hours=1))` directly, with
the rationale documented in the module docstring: **WAT is a fixed UTC+1 offset with no DST**, so
a fixed-offset timezone is not a shortcut, it is the correct model. `now()` returns a naive
datetime with tzinfo stripped for consistent database storage; `today()` and `today_str()` give
a single source of truth for "what day is it in Lagos" used by every service.

**The lesson:** the right timezone abstraction depends on the jurisdiction. Reaching for a full
tz database when the region has no DST adds a dependency, an image-size cost and a failure mode,
for zero correctness benefit. But the reasoning must be written down — otherwise it looks like
a naive hardcode, and someone will "fix" it.

### 10.10 The bootstrap paradox in role-based access control

**Problem.** Introducing a `super_admin` role into a system with existing admins raises the
question: who grants the first grant? Nobody has permission to create the first super_admin.

**Fix.** The migration promotes the **oldest admin account by `created_at`** to `super_admin`.
Deterministic, idempotent, requires no manual intervention, and correctly identifies the school's
original account.

**The lesson:** every permission system has a bootstrap problem. Solving it in the migration
means it is solved identically on every environment, forever, with no runbook step to forget.

---

## 11. Performance Engineering

| Technique | Where | Effect |
|---|---|---|
| **Parallel lookups** (`ThreadPoolExecutor`) | Barcode to teacher/student resolution | ~2x faster on the hottest path; enabled ambiguity detection |
| **Pre-fetch pass-through** | Route fetches the record once and passes it into `process_scan(student=...)` | Eliminates a redundant duplicate query per scan |
| **5-second server-side dashboard cache** | `routes/admin.py`, lock-protected, keyed by date | Multiple admins polling simultaneously collapse to one database read per 5s window |
| **60-second settings cache** | `attendance_service.py` | Time-window classification does not hit the database per scan, while still picking up admin changes within a minute |
| **60-second template cache** | `notification_service.py` | Same for message templates; cache timestamp updated even on DB failure to prevent hammering a broken database |
| **Two-call bulk import** | `csv_service.py` | A 500-row import is 1 duplicate-check + 1 batch insert, not 1,000 round trips |
| **Batch upsert with `on_conflict`** | `supabase_client.py` | Database-level duplicate handling instead of application loops |
| **PostgREST embedded selects** | `select=*,students(full_name,class)` | Joins student names into log queries in one round trip — no N+1 over HTTP |
| **Targeted indexes** | 9 indexes matching real query predicates | Class grouping, newest-first time ordering, log-type filtering, fraud filters |
| **PK-as-barcode** | `students.student_id` is the scanned value | Every scan lookup is a primary-key hit |
| **Exponential backoff polling** | `AdminDashboard.jsx` | On failure, retry delay doubles to a 30s ceiling — a down backend is not hammered by every open dashboard |
| **Lazy tab mounting** | `mountedTabs` ref set | Dashboard tabs mount on first visit and stay mounted; 16 panels never all mount at once, and revisits keep their state |
| **Per-request timeout tuning** | `api.js` | 10s default / 30s analytics / 60s dashboard / 120s import — each matched to its real distribution instead of one global compromise |
| **Docker layer ordering** | `requirements.txt` copied and installed before app code | Code-only changes reuse the cached dependency layer |
| **Report range cap** | 90 days max | Bounds memory and generation time on a 512 MB VM |
| **Scan history cap** | 50 entries, today only | Bounded `localStorage`, self-pruning |

---

## 12. Reliability, Fault Tolerance & Graceful Degradation

- **Retry with backoff** on all Supabase transport errors (3 attempts, 1s/2s), and deliberately
  *not* on HTTP error statuses.
- **Timeouts on every outbound call** — 30s Supabase, 15s D7. No unbounded waits.
- **Background threads for all non-critical work** (notifications, audit logging), each with its
  own exception boundary.
- **Layered fallbacks**: DB template to built-in template to skip; DB settings to cache to
  hardcoded defaults; service-role key to anon key.
- **Fail-open on the day check** so a database blip cannot close the school gate.
- **Configuration-gated integrations**: unconfigured email or WhatsApp logs a warning and
  returns; it never raises into the request path.
- **Client-side resilience**: exponential backoff polling, retry counters surfaced in the UI, and
  a scan log persisted in `localStorage` that survives a browser reload or crash.
- **Idempotent migrations** so a re-run during an incident cannot corrupt schema state.
- **Database-level integrity**: cascade deletes, unique constraints (one staff record per day),
  and CHECK constraints on enumerated values.
- **`min_machines_running = 1`** — no cold-start on the first scan of the morning.
- **Health endpoint** for liveness checks and smoke tests.

---

## 13. Security Engineering

### 13.1 Authentication
- **bcrypt** password hashing with per-password salt (`gensalt()`); plaintext passwords are never
  stored, logged, or returned.
- **Stateless JWT (HS256)** carrying `sub`, `username`, `role`, `iat`, `exp`; 8-hour expiry
  matching a school day plus margin.
- **Distinct handling of expired vs invalid tokens** in `decode_token()`, both returning `None`
  so no information leaks to the caller about *why* a token failed.
- **Registration gated by a shared secret** (`ADMIN_REGISTER_SECRET`) so the register endpoint
  cannot be used to mint admin accounts.
- **Generic login failure message** — "Invalid credentials" for both unknown user and wrong
  password, preventing username enumeration.

### 13.2 Authorisation
- **`require_role(*roles)` decorator** composed on top of `token_required`, so authorisation
  cannot be applied without authentication — the composition makes the mistake structurally
  impossible.
- Applied to **every** admin blueprint; admin-user management restricted to `super_admin`.
- Role travels in the signed token; the client cannot alter it.
- Frontend guards documented explicitly as UX, not security (§10.6).

### 13.3 Input validation
- **Barcode regex** applied at the route boundary before any lookup (alphanumeric, hyphen and
  underscore, max 20 characters).
- **CSV validation**: ID shape, required fields, E.164 phone regex, email regex, 5 MB size cap.
- **Whitelisted mutable fields** on PATCH endpoints — no mass assignment.
- **Date parsing with explicit `ValueError` handling** and a 90-day report range cap.
- **Normalisation at the boundary**: barcodes uppercased and trimmed once, so casing can never
  cause a lookup miss downstream.

### 13.4 Data-layer posture (and the honest trade-off)

Row Level Security is **disabled on every table**, and the backend authenticates with the
service-role key. This is a deliberate, documented decision with a stated precondition:
*the database is reachable only through the Flask API, never from a browser.* The API is the
security boundary. The schema file carries this reasoning as a comment, and the handover
documentation states in bold that **exposing the Supabase anon key to the browser without first
re-enabling RLS and writing policies would be a breach**. Documenting the precondition of a
security decision is what makes it a decision rather than an oversight.

### 13.5 Transport & configuration security
- **`force_https = true`** at the Fly.io edge.
- **CORS as an explicit env-driven allowlist**, never `*`, with methods and headers pinned and
  `supports_credentials=False`.
- **Secrets never in git** — `.env` gitignored and located outside the app directory;
  production values held in Fly.io secrets.
- **Service-role key never leaves the server**; the frontend has exactly one env var, the API URL.
- **Global 401 handling** clears the session client-side the instant a token is rejected.

### 13.6 Auditability
- `audit_logs` records admin action, table, record id, before/after JSONB values, description and
  timestamp — the evidence trail for who changed what.
- Five separate log channels including an errors-only catch-all.
- `fraud_alerts` retains an evidence payload and requires human resolution with notes.

### 13.7 Risks identified and disclosed rather than hidden

The handover documentation contains a **security section that names every weakness**:
unauthenticated scan endpoints (a deliberate kiosk trade-off, with mitigations proposed —
device token, IP allowlist, rate limiting), the default-value fallbacks for `JWT_SECRET` and
`ADMIN_REGISTER_SECRET`, disabled RLS, CORS discipline, and a `/api/test-scan` endpoint that is
documented as dev-only but has no environment gate in code. Each entry states the risk, why the
decision was made, and what to do about it. **Disclosing your own system's weaknesses in writing,
to the person taking it over, is the security practice most often missing from handovers.**

---

## 14. Frontend Architecture & UI/UX Practices

### 14.1 Component architecture

- **Function components and hooks exclusively** — no class components anywhere.
- **Pages vs components separation**: 10 route-level pages, 22 reusable panel/widget components.
- **Composition over configuration**: `AppShell` accepts `navGroups`, `activeId`, `onNav`,
  `statusSlot` and `children` — the shell knows nothing about attendance, so it is reusable.
- **A custom hook per stateful concern**: `usePersistentScans` (localStorage-backed scan history
  with automatic day-pruning), `useClock` (1-second ticking clock), `useAgo` (relative freshness).
- **A single API module** — no component ever constructs a URL or handles a token.
- **Correct effect hygiene**: every `setInterval`/`setTimeout`/event listener is torn down in the
  effect's cleanup; polling uses a `cancelled` flag so an unmounted component never sets state.
- **`useCallback`/`useMemo`/`useRef` used where they matter** — stabilising the refocus handler,
  memoising the parsed admin object, and mirroring state into refs for timeout closures.

### 14.2 The kiosk interface (the hardest UX problem here)

The scanner page is designed for a security officer holding a scanner gun, standing at a gate,
under time pressure, with children queuing:

- **Zero interaction required.** No buttons to press, no field to click, no mode to select. Scan
  and go.
- **Four unmistakable visual states** — Idle (pulsing blue border), Scanning (blue, spinner),
  Success (green, flash animation, checkmark), Error (red, flash, cross) — each expressed
  simultaneously through **colour, icon, border, background and text**. Never colour alone,
  which matters for colour-blind operators and for a screen viewed at an angle in daylight.
- **A large scan zone with corner brackets**, borrowing the visual language of a camera viewfinder
  so the affordance is intuitive without instruction.
- **Character-count dots** while typing, giving live feedback that keystrokes are landing without
  ever revealing or exposing the ID.
- **A 1.5-second result hold** before returning to idle — long enough to read, short enough not
  to block the queue.
- **A large live clock and full date** in the header — the operator's own confirmation that the
  device is alive and the time is right.
- **Live KPI cards** (arrivals / departures / errors) so the operator has situational awareness
  without opening anything.
- **Toasts positioned top-centre** in the operator's natural gaze line, with distinct durations:
  success 2.5s, errors 4s — errors deserve more reading time.
- **A dedicated disambiguation modal** for the two-people-one-barcode case, showing enough
  identifying detail (name, class or staff type, phone) for the operator to choose correctly.
- **Explicit logout confirmation**, because an accidental logout at a gate is a real operational
  failure.

### 14.3 Error messages written for the person reading them

A `friendlyError()` translator maps technical failures to operator language:

| Technical reality | What the operator sees |
|---|---|
| Duplicate-scan rejection | "Already scanned — please wait 5 seconds" |
| Barcode not in database | "Unknown barcode. Please check and retry." |
| Database exception | "Database error. Please try again." |
| No HTTP response at all | "Connection error. Is the server running?" |

Every message says **what happened and what to do next**. None expose a stack trace, a status
code, or an internal identifier.

### 14.4 Design system

- **Design tokens as CSS custom properties**: brand navy `#1a3a52`, navy-light `#2d5a7a`, accent
  blue, two card shadow elevations, a base transition duration — defined once in `:root`.
- **Tailwind theme extension** rather than arbitrary values: a named `navy` colour scale, the
  Inter font stack with `system-ui` fallback, and six named animations.
- **Six purpose-built keyframe animations**: `pulse-border` (idle attention), `flash-green` /
  `flash-red` (scan outcome), `slide-in` (new log rows), `fade-in` (panel entry), `count-up`
  (KPI changes). Motion is used to communicate state change, never for decoration.
- **Custom utilities in `@layer utilities`** (`.scanner-zone`, `.corner`, `.card-hover`) so
  repeated composite patterns stay consistent.
- **Styled scrollbars** for visual coherence in dense tables.
- **The same brand colour is used in the PDF engine** (`BRAND_COLOR = (26,58,82)` = `#1a3a52`), so
  a printed report and the screen are visibly the same product.
- **Consistent semantic colour**: green = on time / present / good, orange = warning / borderline,
  red = late / error / absent, blue = neutral action — applied identically in the dashboard, the
  scanner and the PDF reports, including the same 80% / 60% thresholds.

### 14.5 Responsive & adaptive design

- **Mobile-first Tailwind breakpoints** throughout (`sm:`, `md:`, `lg:`, `xl:`).
- **A collapsible sidebar that auto-expands above 1280px** and collapses to icons below, with a
  left accent bar marking the active item in collapsed mode.
- **A mobile drawer** replacing the sidebar under `lg`, which auto-closes on resize past the
  breakpoint — preventing the stuck-open-drawer bug that appears when a device is rotated.
- **Progressive disclosure on the scanner**: the scan log is a side panel on desktop and a
  toggled view on mobile, so the small screen is never split.
- **`shrink-0` / `truncate` / `min-w-0` discipline** so long names and classes degrade
  gracefully instead of breaking layout.

### 14.6 Feedback, state and perceived performance

- **Freshness indicator** — "updated just now / 12s ago / 3m ago", so a stale dashboard is
  visibly stale rather than quietly wrong.
- **Loading, empty and error states** designed for every panel, not just the happy path.
- **Optimistic local scan log** — the scan appears instantly in the operator's list.
- **Retry counter surfaced** during backoff so the operator knows the system is trying, not dead.
- **Inline field-level validation errors** on duplicate IDs (409), not generic toasts.
- **Confirmation dialogs on destructive actions.**
- **Structured import results** rendered as a reviewable per-row table.

### 14.7 Accessibility

- `aria-label` on the invisible scanner input (replacing an invalid `aria-hidden` on a focusable
  element — WAI-ARIA compliance fix, §10.1)
- Semantic HTML: `header`, `nav`, `main`, real `button` elements for actions and real links for
  navigation
- `alt` text on all imagery
- State communicated redundantly through colour + icon + text, never colour alone
- Full keyboard operability of the scanner flow (it is keyboard-driven by design)
- `autoComplete`, `autoCorrect` and `spellCheck` disabled on the scan input to stop browser
  interference with machine input

---

## 15. Third-Party Integrations

| Integration | Protocol | Engineering detail |
|---|---|---|
| **Supabase / PostgREST** | REST over HTTPS | Custom client: retries, timeouts, 406-to-None mapping, upserts, embedded selects, batch writes, actionable error translation |
| **Gmail SMTP** | SMTP + STARTTLS (587) | App Password authentication, MIME multipart with plaintext and HTML alternatives, per-send connection lifecycle, configuration-gated |
| **D7 Networks WhatsApp** | REST + Bearer token | Meta-approved template messages with positional parameters, free-form path for in-window conversations, phone normalisation, provider-body error logging, setup runbook in the module docstring |
| **Fly.io** | flyctl / Docker | Secrets management, region pinning, machine sizing, always-on config, `fly ssh console` for live diagnosis, `fly logs` streaming |
| **Vercel** | Git-triggered CI/CD | Monorepo subdirectory root, SPA rewrite rules, build-time environment injection, promote-a-previous-deployment rollback |

---

## 16. DevOps, Deployment & Release Process

### 16.1 Containerisation

```dockerfile
FROM python:3.12-slim          # minimal base — smaller attack surface, faster pulls
WORKDIR /app
COPY requirements.txt .        # dependency layer first
RUN pip install --no-cache-dir -r requirements.txt
COPY . .                       # code layer second — code changes reuse the cached deps layer
RUN mkdir -p logs
EXPOSE 8080
CMD ["gunicorn","wsgi:application","--bind","0.0.0.0:8080","--workers","2","--timeout","120","--access-logfile","-"]
```

Layer ordering, `--no-cache-dir`, access logs to stdout for platform capture, an explicit worker
count and timeout sized for a 512 MB shared-CPU VM, and a `.dockerignore` keeping the venv,
`node_modules` and logs out of the build context.

### 16.2 Platform configuration

- **`fly.toml`**: app name, `primary_region = "jnb"` (Johannesburg — the lowest-latency region
  available to Lagos), `internal_port = 8080`, `force_https = true`, `auto_stop_machines = false`
  with `min_machines_running = 1` (no cold start at 7am), `TZ=Africa/Lagos`, `FLASK_DEBUG=0`,
  1 shared CPU / 512 MB.
- **`vercel.json`**: build command, output directory, and an SPA rewrite sending all routes to
  `index.html` so React Router deep links work on refresh.
- **`vite.config.js`**: dev-server proxy for `/api`, `/auth`, `/admin` and `/health` to
  `localhost:5000`, so development runs same-origin and CORS behaviour is predictable.

### 16.3 Environment strategy

Three tiers, each with a documented source of truth:

| Tier | Local | Production |
|---|---|---|
| Backend config | `.env` at the repo root, discovered via `find_dotenv()` | Fly.io secrets |
| Frontend config | `.env.local` | `.env.production` + Vercel project env, injected at **build time** |
| Database | Supabase project | Same Supabase project |

The build-time nature of `VITE_*` variables is called out explicitly in the documentation,
because "I changed the API URL and nothing happened" is otherwise a guaranteed future incident.

### 16.4 Release procedure (documented and repeatable)

1. Develop and test locally against the real Supabase project.
2. If the schema changed, write an idempotent migration file in `migrations/`.
3. Run the migration in the Supabase SQL editor — **schema before code**, so newly deployed code
   never queries a column that doesn't exist yet (this ordering was learned from a real incident;
   see §9.2).
4. Deploy the backend: `fly deploy`.
5. Deploy the frontend: push to the Vercel-connected branch, or `vercel --prod`.
6. **Smoke test**: `/health`, then login, then a test scan, then confirm the dashboard updates.

### 16.5 Rollback strategy

- **Backend**: `fly releases` then `fly releases rollback`, or redeploy a previous image.
- **Frontend**: promote a previous deployment in the Vercel dashboard — instant, no rebuild.
- **Database**: migrations are forward-only; the documented requirement is to take a backup
  before any destructive change. Stating that a rollback path *doesn't* exist is more useful
  than implying one does.

### 16.6 Version control practice

Commits are descriptive with reasoning in the body, not just the change. Real examples:

> *"Fix double URL-encoding breaking multi-word staff type lookups — `_eq()` was calling
> `quote()` on values, then requests encoded the result again, so spaces became `%2520` instead
> of `%20`. PostgREST received 'Teaching%20Staff' as a literal string and found nothing.
> Single-word types (Receptionist) worked fine; multi-word types all failed."*

> *"Fix FPDFUnicodeEncodingException — Helvetica (built-in fpdf2 font) only supports Latin-1.
> The em-dash U+2014 in period headers and the teacher check-in fallback caused a crash on every
> non-daily-summary report."*

A commit message that records **the symptom, the mechanism and the scope** turns version history
into a searchable incident database. Six months later, `git log --grep` finds the reasoning, not
just the diff.

---

## 17. Observability & Operations

### 17.1 Structured multi-channel logging

Configured in the application factory with five destinations:

| Channel | File | Contents |
|---|---|---|
| root | `logs/attendance.log` | Everything |
| `scan` | `logs/scan_logs.txt` | Scan events only |
| `notification` | `logs/notification_logs.txt` | Email/WhatsApp dispatch |
| `import` | `logs/import_logs.txt` | CSV import activity |
| errors | `logs/error_logs.txt` | ERROR level from any logger |

Plus a stream handler so the platform captures stdout. Named loggers per domain mean an
investigation of "did the parent get the message?" reads one file, not a grep across everything.

**Log content is designed for reading**, with tagged prefixes and column-aligned formatting:

```
[SCAN OK] 2026-05-20 08:31:07 | id=STU042   | Adebayo Johnson       | JSS2       | ARRIVAL   | comment=None
[DUPLICATE] STU042 - scanned too quickly
[AMBIGUOUS] barcode=STF017 matches teacher=... and student=...
[WA] Sent to +234... (request_id: ...)
[IMPORT] Skipped duplicate: STU113
```

Tags (`[SCAN OK]`, `[NOT FOUND]`, `[DB ERROR]`, `[NOTIFY]`, `[AUDIT]`, `[WA]`, `[IMPORT]`) make
the logs greppable by intent. Alignment makes a column of scans scannable by eye.

### 17.2 Monitoring signals

- `GET /health` liveness endpoint
- `fly status` for machine state, `fly logs` for streaming
- The dashboard's own 10-second poll doubles as a continuous end-to-end health signal: if the UI
  says "updated 4s ago", the frontend, backend, database and network are all working

### 17.3 The operations runbook

A dedicated handover document covers routine tasks (add/reset an admin, bulk import, adjust time
windows, block or open a date, configure notification routing), a **symptom to cause to action**
incident table with a dozen real failure modes, log locations and filtering commands, backup
guidance, and a quick deploy checklist. Notably it documents **benign errors** too — Supabase
406s on single-row lookups are normal and handled — so the next operator doesn't waste a day
chasing a non-problem.

---

## 18. Documentation, Handover & Client Communication

This is a differentiating part of the work. Most solo projects are handed over as a repository
and a phone number. This one was handed over as a **nine-document onboarding programme** plus a
forward-looking architecture audit.

| Doc | Covers |
|---|---|
| 00 — Index | Reading order, a 60-second system summary, and the four critical first steps |
| 01 — System Overview | What it does, ASCII architecture diagram, full stack table, repository map, roles, time windows, feature areas |
| 02 — Local Setup | Prerequisites, clone, `.env`, migrations, backend and frontend install, creating the first admin, running both processes, a mock-data path, and a common-local-issues table |
| 03 — Deployment | Fly.io and Vercel configuration, secrets, first-time setup, deploy commands, useful CLI reference, release procedure, rollback |
| 04 — Database Schema | Every table, column, type and note; migration run order; RLS posture; ID-type gotchas |
| 05 — API Reference | Every endpoint with method, path, auth requirement and description; CSV format spec |
| 06 — Environment Variables | Every variable, required/optional, default, purpose, where it lives; a rotation checklist |
| 07 — Operations Runbook | Logs, monitoring, routine tasks, incident table, backups, deploy checklist |
| 08 — Known Issues & Roadmap | Uncommitted working tree, security items, operational debt, documentation drift, a suggested first-week plan |
| 09 — Accounts & Credentials | A tickbox ownership-transfer checklist for all seven third-party services, with per-account steps and a final verification list |
| Audit | Keep / extend / rewrite analysis for evolving into a multi-tenant SaaS |

### 18.1 Documentation practices worth naming

- **Written for a named audience** — "a new developer or maintainer taking over" — with an
  explicit reading order, not an unordered wiki.
- **Documents drift, honestly.** Doc 08 records that the root README is stale, that the README's
  API table predates half the endpoints, that `.env.example` still documents Twilio while the code
  uses D7, and that mock-data scripts are not where the README says. Recording known-wrong
  documentation is more valuable than quietly leaving traps.
- **Documents the uncommitted working tree** — telling the next owner explicitly that deployed
  code and committed code may differ, and exactly which files are affected, before they trust
  `git log`.
- **Symptom-first troubleshooting tables** in both the setup and operations docs, because a new
  maintainer arrives with a symptom, not a cause.
- **A credentials checklist that contains no credentials** — it names what must be transferred
  and instructs that values live in a password manager. It also mandates **rotating every secret
  after transfer**, on the correct reasoning that the previous owner has seen them all.
- **Runbooks next to the code they describe** — the D7 setup checklist lives in the module
  docstring, so it cannot drift away from the implementation it documents.
- **Rationale captured in docstrings**: `tz.py` explains *why* a fixed offset;
  `notification_service.py` states it runs in a background thread and must never block;
  `holiday_service.py` documents the precedence order. The audit specifically noted this
  documentation quality as above average for a project of this size.

---

## 19. Technical Audit & Forward Architecture (Multi-Tenant SaaS Path)

A formal audit was produced to evaluate evolving this single-school system into a multi-tenant,
offline-first, NDPA-compliant school-operations platform. It is included here because
**architectural assessment is a distinct, senior skill** from building.

### 19.1 Method

Every conclusion was derived from reading the actual code — migrations, routes, services,
frontend — not from assumption. Negatives were *proved* by repo-wide search (for example:
zero occurrences of `school_id`, `tenant_id` or `organization` in any `.py`, `.sql`, `.jsx` or
`.js` file, establishing that there is no latent multi-tenant scaffolding to repurpose).
Findings are separated from judgements, and judgement calls are explicitly labelled as the
owner's decision to make.

### 19.2 Findings

- **Architecture**: genuinely single-tenant. Every table is globally scoped; every unique
  constraint is global (`admins.username`, `teachers.barcode_id`); `SCHOOL_NAME` is a single env
  var. Adding tenancy is schema surgery across every table and every query, not a config toggle.
- **Offline support**: none. `usePersistentScans` is a display cache of already-successful scans,
  not a queue — no service worker, no IndexedDB, no retry, no `navigator.onLine` check anywhere.
  A scan that fails at the network layer today is lost. This was stated plainly rather than
  softened.
- **Auth/RBAC**: sound and genuinely server-enforced. Reusable as-is; extend the token payload
  with a tenant claim and add a scope check alongside the role check.
- **Notifications**: both channels fully implemented and reusable; needs parameterising from
  per-school configuration rather than global env values.
- **Attendance schema gap analysis** against a target model: `student_id`, `log_type` and
  `scan_timestamp` map cleanly (rename-level work); `device_id`, `sync_status` and
  `notification_sent_at` are entirely absent — precisely because the two features that would
  need them (offline sync and notification tracking) were never built. The grain of the table is
  already correct, so this is a migration, not a redesign.
- **Licensing review**: no LICENSE file (flagged); full `package-lock.json` licence scan showed
  overwhelmingly MIT/ISC/Apache-2.0/BSD-3 with **zero GPL/AGPL**; flagged `fpdf2` as commonly
  LGPL-3.0 (weak copyleft — does not force open-sourcing, but confirm before shipping
  proprietary). Nothing blocks wholly-owned proprietary use.
- **Code health**: no automated tests of any kind; no TODO/FIXME/HACK markers; backend deps
  exact-pinned, frontend on caret ranges; no Dependabot/Renovate.

### 19.3 Recommendations — a keep / extend / rewrite decision framework

**Keep as-is**: the JWT + bcrypt + `require_role()` auth mechanism; the email service; the
WhatsApp integration pattern; the Fly.io + Vercel + Supabase deployment shape.

**Extend**: auth (add tenant claims and a scope check); notification services (source config
per-school rather than per-env); `attendance_logs` (add `device_id`, `sync_status`,
`notification_sent_at`); every table (add a tenant FK and convert global unique constraints to
per-tenant composites); audit logging.

**Rewrite from scratch**: the frontend scan flow and persistence layer (offline-first with a
local database and background sync is new infrastructure, not an extension of a synchronous POST);
the scanner interface itself (phone-camera QR is a fundamentally different input model from
keyboard-emulating hardware); the multi-tenant isolation strategy (an explicit decision between
API-layer-only isolation and RLS-enforced isolation — with a recommendation toward RLS given that
cross-tenant leakage of children's location data is a compliance failure, not merely a bug);
and guardian consent records, which do not exist in any form.

**The bottom line delivered**: the backend service layer is well-built enough to extend rather
than discard, the data model needs mechanical-but-substantial surgery, and the client-side scan
experience — the thing a new product would differentiate on — has zero reusable code and should
be budgeted as a full rewrite, not discovered in week six.

**The transferable skill here** is producing a decision-support document that gives an owner a
defensible build/extend/replace plan with the reasoning attached, distinguishes verified facts
from judgement, and refuses to hide the parts of your own prior work that should be thrown away.

---

## 20. CV Bullets — Ready to Paste

### 20.1 One-line summary (CV header / LinkedIn headline)

> Full-stack engineer — designed, built, deployed and handed over a production React + Flask +
> PostgreSQL attendance and parent-notification platform serving a Lagos school, covering
> real-time barcode scanning, WhatsApp/email notification pipelines, RBAC, PDF reporting and
> cloud deployment across Vercel, Fly.io and Supabase.

### 20.2 Short form (6 bullets — for a dense CV)

- Designed and shipped a production full-stack school attendance and child-safeguarding platform
  (React 18/Vite/Tailwind + Python Flask + Supabase PostgreSQL) deployed across Vercel, Fly.io
  and Docker; ~14,000 lines across 60+ REST endpoints and 16 database tables.
- Built a sub-second barcode scanning pipeline for hardware scanners with keystroke-debounced
  auto-submit, dual-layer duplicate protection and ambiguity resolution; cut scan lookup latency
  roughly 50% by parallelising queries with `ThreadPoolExecutor`.
- Engineered a non-blocking multi-channel notification system (Gmail SMTP + WhatsApp Business via
  D7 Networks with Meta-approved templates) dispatched on background threads with layered
  fallbacks, so provider outages never block the gate.
- Implemented stateless JWT + bcrypt authentication with three server-enforced roles, decorator-
  based authorisation on every admin endpoint, env-driven CORS allowlisting and full audit logging.
- Made every school rule database-configurable — attendance windows, holidays, notification
  routing, message templates and report branding — eliminating engineer involvement in
  operational changes.
- Produced a nine-document technical handover (setup, deployment, schema, API, environment,
  runbook, known issues, credentials transfer) plus a keep/extend/rewrite architecture audit for
  a multi-tenant SaaS evolution.

### 20.3 Long form (full project entry)

**Peculiar Register — School Attendance & Safeguarding Platform** · *Sole Full-Stack Engineer* · 2026
*React 18 · Vite · Tailwind · Python 3.12 · Flask 3 · PostgreSQL/Supabase · Docker · Fly.io · Vercel*

- Architected and delivered an end-to-end attendance and parent-notification system for a Lagos
  private school, replacing paper registers: barcode scanning at the gate, real-time
  classification against configurable time windows, automated parent notifications, and a
  16-module administrative dashboard.
- Designed a three-layer backend (11 Flask blueprints, 12 service modules, a single PostgREST
  data-access module) using the application-factory pattern, with a strictly one-directional
  dependency graph so persistence can be swapped in one place.
- Hand-built a PostgREST/Supabase client with retry-and-backoff, per-call timeouts, upsert and
  batch support, embedded-resource selects to eliminate N+1 patterns, and error translation that
  returns actionable remediation instructions rather than raw status codes.
- Solved the hardware-barcode-scanner input problem with an invisible always-focused field, a
  50 ms silence debounce for auto-submission without an Enter key, ref-mirrored state to defeat
  stale closures, and independent client and server duplicate guards.
- Built a notification engine with DB-backed editable templates (60s cache plus hardcoded
  fallbacks), per-channel/per-event/per-transport-mode routing policy, class-teacher alerts, and
  Meta-compliant WhatsApp template messaging — all dispatched on daemon threads so a provider
  outage degrades to a log line instead of a failed scan.
- Migrated the WhatsApp channel from Twilio to D7 Networks, rewriting the transport for Meta's
  business-messaging template policy, phone normalisation across legacy formats, and
  provider-body error logging.
- Delivered server-side branded PDF reporting (fpdf2) with three templates, reusable document
  primitives (KPI rows, tables, section headers), semantic colour thresholds shared with the
  dashboard, and admin-customisable branding.
- Engineered a three-phase CSV import pipeline reducing a 500-row import from ~1,000 database
  round trips to two, with per-row validation reporting, BOM and header normalisation, and
  duplicate-safe batch upserts.
- Implemented JWT/bcrypt auth with `super_admin`/`admin`/`scanner` roles enforced server-side via
  composed decorators, plus audit logging with before/after JSONB snapshots and a fraud-alert
  review workflow with human resolution.
- Optimised throughput with parallel lookups, a lock-protected 5s dashboard cache, 60s settings
  and template caches, nine query-shape-matched indexes, exponential-backoff polling, lazy tab
  mounting and per-endpoint timeout tuning.
- Containerised with a cache-optimised Dockerfile, deployed to Fly.io (region-pinned to
  Johannesburg for Lagos latency, always-on, forced HTTPS) with the SPA on Vercel, secrets in
  platform secret stores, and a documented release procedure and rollback path.
- Diagnosed production-only failures by writing an in-container layered elimination probe that
  isolated code, schema, and data problems in a single run — identifying schema drift between
  deployed code and the live database.
- Resolved subtle production defects including a double-URL-encoding bug that silently broke all
  multi-word lookups, a Latin-1 encoding crash in PDF generation, a WAI-ARIA violation on a
  focusable hidden input, and a client that inferred business outcome from HTTP status codes.
- Authored a nine-document handover programme and a forward-looking keep/extend/rewrite audit
  evaluating multi-tenancy, offline-first architecture, RLS isolation strategy and dependency
  licensing for a SaaS evolution.

### 20.4 Bullets by target role

**Backend / Python roles**
- Built a 60+ endpoint Flask 3 REST API using the application-factory pattern and 11
  domain-bounded blueprints, with decorator-composed JWT authentication and role authorisation.
- Wrote a production PostgREST data-access layer with retry/backoff, timeout policy, 406-to-None
  semantics for absent single rows, batch upserts and embedded-resource selects.
- Implemented concurrent I/O with `ThreadPoolExecutor` on the latency-critical path and
  thread-safe in-memory state with explicit locking for duplicate-scan protection.
- Designed background-thread dispatch for all non-critical work with per-thread exception
  boundaries so worker failures cannot affect request handling.

**Frontend / React roles**
- Built a 32-module React 18 SPA (hooks only, zero class components) with role-aware routing,
  a composable application shell, and three custom hooks including a self-pruning
  localStorage-backed scan history.
- Centralised all HTTP in one axios module with request interceptors for auth injection and
  response interceptors for global 401 session handling.
- Implemented exponential-backoff polling with cancellation-safe cleanup, lazy tab mounting, and
  per-endpoint timeout tuning for a real-time dashboard.
- Designed a kiosk interface for non-technical operators: zero-interaction scanning, four
  redundantly-encoded visual states, purpose-built motion, and error messages written as
  operator instructions.

**DevOps / Platform roles**
- Containerised a Python service with cache-optimised layer ordering and deployed to Fly.io with
  region pinning, always-on machines, forced HTTPS and platform-managed secrets.
- Configured Vercel git-triggered CI/CD for a monorepo subdirectory with SPA rewrites and
  build-time environment injection.
- Established a documented release procedure (schema before code), rollback paths for both
  tiers, and a smoke-test checklist.
- Implemented five-channel structured logging with domain loggers and an errors-only catch-all,
  and wrote a symptom-to-action operations runbook.

**Data / Database roles**
- Designed a 16-table PostgreSQL schema with CHECK-constrained domains, cascade deletes,
  composite uniqueness, JSONB evidence and audit payloads, and nine indexes derived from actual
  query shapes.
- Authored ten idempotent SQL migrations and consolidated them into a single re-runnable schema
  file that provisions a blank database in one step.
- Chose distinct table grains per domain — append-only event rows for student scans, one mutable
  row per staff-day enforced by a unique constraint — matching the real-world semantics of each.
- Built a validated, deduplicated, batched CSV ingestion pipeline with structured per-row
  reporting.

---

## 21. Skills Matrix — Keyword Inventory

*(Every item below is demonstrably present in this project. Use for CV keyword coverage and ATS matching.)*

**Languages** Python 3.12 · JavaScript ES2022+ · SQL (PostgreSQL) · JSX · HTML5 · CSS3 · Bash · PowerShell · Dockerfile · TOML · JSON

**Backend** Flask 3 · Blueprints · Application-factory pattern · REST API design · Decorator-based middleware · PyJWT · bcrypt · gunicorn · WSGI · `threading` · `ThreadPoolExecutor` · daemon threads · thread locks · smtplib · MIME multipart · fpdf2 · `csv` · `logging` · `re` · datetime/timezone handling · `functools.wraps`

**Frontend** React 18 · Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`) · custom hooks · React Router 6 · route guards · Vite · Tailwind CSS 3 · PostCSS · axios · interceptors · react-hot-toast · localStorage · Blob/object URLs · CSS custom properties · keyframe animation · responsive design · WAI-ARIA

**Database** PostgreSQL · Supabase · PostgREST · schema design · normalisation · indexing strategy · CHECK constraints · UNIQUE/composite constraints · foreign keys · cascade deletes · JSONB · UUID · TIMESTAMPTZ · idempotent migrations · upsert/`ON CONFLICT` · batch operations · Row Level Security (posture and trade-offs)

**Integrations & APIs** REST client design · retry with backoff · timeout policy · bearer-token auth · SMTP/STARTTLS · WhatsApp Business API · Meta message templates · polling architecture · E.164 phone normalisation · multipart uploads · blob downloads

**Security** JWT (HS256) · bcrypt salting · RBAC · least privilege · input validation · regex sanitisation · mass-assignment prevention · CORS allowlisting · secret management · HTTPS enforcement · username-enumeration prevention · audit logging · threat disclosure and documentation

**DevOps** Docker · layer caching · Fly.io · flyctl · Vercel · CI/CD · environment/secret management · region selection · health checks · rollback strategy · log management · production shell debugging (`fly ssh console`)

**Architecture** Layered architecture · separation of concerns · single-responsibility modules · dependency direction discipline · configuration-as-data · graceful degradation · failure-direction analysis · caching strategy · background processing · event-sourced table grain · multi-tenancy assessment · build/extend/replace decision frameworks

**Practices** Debugging methodology · root-cause analysis · production diagnostics tooling · performance optimisation · technical writing · API documentation · runbook authoring · handover and knowledge transfer · security disclosure · dependency licence review · descriptive commit discipline · stakeholder requirement translation

**Domain** EdTech · attendance systems · child safeguarding · parent communication · barcode/hardware integration · kiosk UX · reporting and analytics · data migration · NDPA/data-protection awareness

---

## 22. Interview Talking Points (STAR Format)

### 22.1 "Tell me about a difficult bug."
**S** — Staff-type configuration lookups were returning empty for some staff types but not others,
with no error anywhere.
**T** — Find why a query returning zero rows was correct-looking but wrong.
**A** — Isolated the distinguishing variable: every failing value contained a space. Inspected the
raw query string rather than the Python. Found that our filter helper was percent-encoding the
value and `requests` was then encoding it again, so `%20` became `%2520` and PostgREST matched a
literal string. Fixed it in the single place filters are built, so all call sites were fixed at once.
**R** — All multi-word lookups restored. The wider lesson I took away: two layers each "helpfully"
handling encoding produces corruption that looks like missing data, and a silently empty result is
more dangerous than an exception because nothing logs it.

### 22.2 "Tell me about a design decision you'd defend."
**S** — Notifications to parents are the product's real value, but they depend on two external
providers over an unreliable network.
**T** — Make notification failure impossible to propagate to the gate.
**A** — Dispatched notifications on a daemon thread launched after the response is assembled,
wrapped in its own exception boundary. Layered fallbacks throughout: DB template to built-in
template to skip; DB settings to cache to defaults; unconfigured provider to log-and-return.
**R** — Provider outages became log lines rather than failed scans. I'd defend this because the
alternative — a queue and broker — would have added operational surface a single-school budget
can't maintain, for reliability the school doesn't need.

### 22.3 "Tell me about optimising something."
**S** — Every scan performed a teacher lookup, then a student lookup, sequentially — two round
trips on the most latency-sensitive path in the product.
**T** — Reduce scan latency at a gate where hundreds of children arrive in half an hour.
**A** — Replaced sequential lookups with a concurrent `ThreadPoolExecutor` fetch returning both
results. Also passed the already-fetched record down into the classification service so it didn't
re-query, and added a 60-second cache on the time-window settings.
**R** — Roughly halved lookup latency. The unexpected win: having both results available let me
detect a barcode that matches both a teacher and a student and return an `ambiguous` response with
an operator disambiguation modal — a data-integrity problem that had previously been silent became
a handled UX flow.

### 22.4 "Tell me about working with a non-technical stakeholder."
**S** — The school kept asking for time-window changes: a new arrival cutoff, a different late
threshold, a Saturday exam day that needed scanning open.
**T** — Stop being the bottleneck for operational decisions.
**A** — Instead of changing constants, I moved every rule into the database with an admin UI:
`school_settings` for time windows, `holidays` with ranges, `scan_day_overrides` with a documented
precedence order that lets an override beat both the weekend and holiday rules, `message_templates`
for wording, `notification_settings` for routing.
**R** — The school changes its own rules with no deploy and no engineer. This is the single change
that most determines whether a small-client system survives after the engineer leaves.

### 22.5 "Tell me about debugging something you couldn't reproduce."
**S** — The deployed backend returned 500s on endpoints that worked perfectly locally.
**T** — Diagnose on a production machine I couldn't attach a debugger to.
**A** — Wrote a self-contained probe script, ran it inside the live container over `fly ssh console`,
and structured it as layered elimination: (1) do the new modules import? (2) does the table
actually have the new columns? (3) does the dependent table exist? (4) can the library produce
output from synthetic data? Each step prints a full traceback.
**R** — One run identified schema drift — the code had deployed but the migration hadn't been run.
It also permanently changed my release procedure: **schema before code, always**, which is now
written into the deployment documentation.

### 22.6 "Tell me about a time you had to say part of your own work should be thrown away."
**S** — The owner wanted to evolve this system into a multi-tenant, offline-first SaaS.
**T** — Give an honest build/extend/replace assessment.
**A** — Read the actual code, proved negatives with repo-wide searches, and separated verified
findings from judgement calls. Concluded that the auth, notification and audit layers were worth
extending — and that the entire client-side scan experience, the part a new product would
differentiate on, had **zero reusable code** and should be budgeted as a full rewrite, because
offline-first with local persistence and background sync is new infrastructure, not an extension
of a synchronous POST.
**R** — The owner got a defensible plan with realistic budget implications rather than an
optimistic one. Being willing to write down that your own code should be replaced is what makes
the rest of the assessment trustworthy.

---

## 23. Honest Gaps & What I'd Do Next

Listing these is deliberate. Interviewers probe for self-awareness, and a documented gap with a
plan reads far better than a gap they discover themselves.

| Gap | Impact | Plan |
|---|---|---|
| **No automated tests, no CI** | Every change validated manually; regression risk on the classification logic | Start with pytest smoke tests around scan classification (window boundaries, arrival/departure inference, grace periods) and auth/role enforcement — the two areas where a silent regression is most costly. Then a GitHub Actions check on push. |
| **No migration runner** | Ordering and idempotency are managed by convention | Adopt a runner with version tracking; the migrations are already idempotent, so the migration path is low-risk |
| **Scheduled sweeps not wired** | `check_non_arrivals()` / `check_non_departures()` are fully implemented but nothing calls them — the highest-safeguarding-value feature is dormant | Wire to a scheduler (APScheduler in-process, or a Fly cron machine) at the configured 12:00 and 18:00 cutoffs — the cutoffs are already in `school_settings` |
| **No offline capability** | A scan that fails at the network layer is lost | Queue-and-replay with a local store and a service worker; add `sync_status` to the log schema (identified in the audit) |
| **Notification delivery not persisted** | No record of whether a parent actually received a message | Add `notification_sent_at` and a delivery-status column; capture the provider's request ID, which is already logged |
| **Ephemeral logs** | Log files reset on every Fly redeploy | Ship to an external sink, or rely on `fly logs` retention with the limitation documented (it is) |
| **Unauthenticated scan endpoints** | Deliberate kiosk trade-off, open to anyone who knows the URL | Device token, IP allowlist, or rate limiting — all three are proposed with trade-offs in the handover docs |
| **`/api/test-scan` live in production** | Documented as dev-only, but not environment-gated in code | Gate on `FLASK_DEBUG` or remove |
| **Single 512 MB machine** | Fine for one school; not for many | Scale vertically first, then revisit when multi-tenancy lands |
| **No LICENSE file** | Ownership ambiguity | Add one; the dependency licence review is already done (§19.2) |
| **Frontend deps on caret ranges** | Non-reproducible builds over time | Pin, and add Renovate/Dependabot |

---

## 24. Transferable Workflows Companies Can Adopt

These are the practices from this project that generalise to any team — the part of the work
that answers "what would you bring to our workflow?"

1. **Configuration-as-data.** Before hardcoding a business rule, ask whether the business will
   want to change it. If yes, it is a row with a UI, not a constant. This is the single highest-
   leverage practice here: it removes the engineer from the operational loop permanently.

2. **Explicit failure-direction analysis.** For every failure mode, decide and document which way
   it should fail. Fail-open on the gate check, fail-closed on the duplicate guard. Writing this
   down as a table converts accidental behaviour into designed behaviour.

3. **Errors as documentation delivered at the moment of failure.** A 403 on a write should not say
   "Forbidden"; it should say "set `SUPABASE_SERVICE_ROLE_KEY` or add the required insert policy
   for this table." The person reading an error is the person who needs the instruction.

4. **Layered elimination probes for production-only bugs.** When you cannot reproduce locally,
   write a script that runs in the failing environment and distinguishes code / schema / data /
   library problems in a single pass, printing full tracebacks. Keep it in the repo.

5. **Commit messages that record symptom, mechanism and scope.** Version history becomes a
   searchable incident database. `git log --grep` should find reasoning, not just diffs.

6. **Idempotency as a compensating control.** Where you lack tooling (a migration runner, a job
   queue), make every operation safe to repeat. Idempotency is what lets you re-run something
   during an incident without making it worse.

7. **Runbooks that live next to the code.** The provider setup checklist belongs in the module
   docstring, not a wiki page that will drift away from the implementation.

8. **Symptom-first troubleshooting tables.** Documentation should be indexed by what the reader is
   experiencing, not by what the author knows. A new maintainer arrives with a symptom.

9. **Document your own system's weaknesses in the handover.** A security section that names every
   trade-off, why it was made, and what to do about it is worth more than a clean-looking document
   that hides them.

10. **Schema before code, always.** Deploying code that queries a column that does not exist yet is
    a self-inflicted outage. Bake the ordering into the release procedure.

11. **One owner per transformation.** Encoding, normalisation, timezone conversion, casing — pick
    exactly one layer that owns each, and make the others hands-off. Double-handling produces
    corruption that looks like missing data.

12. **Separate the security boundary from the UX boundary, and say which is which in the code.**
    Route guards are courtesy. Server-side authorisation is security. Ambiguity here is how
    escalation bugs get shipped.

13. **Prove negatives before asserting them.** When auditing, don't say "there's no tenancy" —
    search for every plausible term across every file type and report the search. Verified facts
    and judgement calls belong in different paragraphs.

14. **Design for the actual operator.** The person using the interface at the gate is not the
    person who commissioned it. Zero-interaction flows, redundant state encoding, and error
    messages phrased as instructions are not polish — they are the difference between a system
    that gets used and one that gets bypassed.

---

*End of document. Compiled from direct inspection of the repository: source code, migrations,
configuration, commit history and handover documentation.*
