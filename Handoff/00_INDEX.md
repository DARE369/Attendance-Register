# Peculiar Register — Project Handoff

**Project:** Peculiar Register — School Attendance System
**Prepared:** 2026-05-30
**Repository:** `Peculiar Register/` (app code in `school-attendance/`)

This folder contains everything a new developer or maintainer needs to take over,
run, deploy, and operate the Peculiar Register attendance system.

---

## Read these in order

| # | Document | What it covers |
|---|----------|----------------|
| 01 | [System Overview](01_SYSTEM_OVERVIEW.md) | What the system does, architecture, tech stack, data flow, roles |
| 02 | [Local Setup Guide](02_LOCAL_SETUP.md) | Get the app running on a fresh machine (backend + frontend) |
| 03 | [Deployment Guide](03_DEPLOYMENT.md) | How the live system is hosted (Fly.io + Vercel) and how to redeploy |
| 04 | [Database Schema Reference](04_DATABASE_SCHEMA.md) | All Supabase tables, columns, and migration order |
| 05 | [API Reference](05_API_REFERENCE.md) | Every backend endpoint, auth requirements, and payloads |
| 06 | [Environment Variables](06_ENVIRONMENT_VARIABLES.md) | Every secret/config value, where it lives, what it does |
| 07 | [Operations Runbook](07_OPERATIONS_RUNBOOK.md) | Logs, routine tasks, troubleshooting, common incidents |
| 08 | [Known Issues & Roadmap](08_KNOWN_ISSUES_AND_ROADMAP.md) | Tech debt, inconsistencies, outstanding work |
| 09 | [Accounts & Credentials Checklist](09_ACCOUNTS_AND_CREDENTIALS_CHECKLIST.md) | Ownership transfer checklist for all third-party accounts |

---

## 60-second summary

Peculiar Register is a full-stack school attendance system. Students (and staff)
are scanned by barcode at the school gate. Each scan is classified as an
arrival or departure based on configurable time windows, recorded in a Supabase
(PostgreSQL) database, and can trigger an email and/or WhatsApp notification to a
parent. Administrators use a React dashboard to view live attendance, manage
students/teachers, configure notifications and time windows, run reports, and
review fraud alerts and audit logs.

- **Frontend:** React 18 + Vite + Tailwind — deployed on **Vercel**
- **Backend:** Python Flask (Blueprints) — deployed on **Fly.io** (`peculiar-register.fly.dev`)
- **Database:** **Supabase** (PostgreSQL accessed via PostgREST)
- **Email:** Gmail SMTP · **WhatsApp:** D7 Networks (see note in doc 08)

---

## Critical first steps for the new owner

1. Work through [09 — Accounts & Credentials Checklist](09_ACCOUNTS_AND_CREDENTIALS_CHECKLIST.md)
   to transfer ownership of the Supabase, Fly.io, Vercel, Gmail, and WhatsApp accounts.
2. Rotate all secrets after transfer (JWT secret, Supabase keys, SMTP app password, API tokens).
3. Confirm you can run the app locally (doc 02) before attempting a deploy (doc 03).
4. Read [08 — Known Issues](08_KNOWN_ISSUES_AND_ROADMAP.md) so nothing surprises you.
