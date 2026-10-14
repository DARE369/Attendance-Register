# 07 — Operations Runbook

Day-to-day operation, monitoring, and incident response.

---

## Logs

The backend writes structured logs to `school-attendance/logs/` (created on
startup by `app.py`):

| File | Contents |
|------|----------|
| `attendance.log` | All application logs |
| `scan_logs.txt` | Scan events only |
| `notification_logs.txt` | Email / WhatsApp send events |
| `import_logs.txt` | CSV import events |
| `error_logs.txt` | All errors (any category) |

On **Fly.io**, these files live inside the (ephemeral) machine. For live logs use:

```bash
fly logs                    # streaming
fly logs | Select-String "ERROR"   # filter (PowerShell)
fly ssh console             # then read logs/ inside the container
```

> ⚠️ Fly machine storage is ephemeral — log files reset on redeploy/restart. If
> you need durable logs, ship them to an external service or rely on `fly logs`
> retention. See doc 08.

---

## Health & monitoring

- Liveness: `GET https://peculiar-register.fly.dev/health` → `{"status":"ok"}`.
- `fly status` shows machine health; `min_machines_running = 1` keeps it always on.
- The frontend dashboard polls `/api/admin/dashboard` every 3s — a good real
  signal that the full stack is healthy.

---

## Routine tasks

### Add / reset an admin
- Create: `POST /auth/register` with the `register_secret` (doc 02 §6) or via the
  Admin Management UI (super_admin only).
- Password reset: there is no self-service reset flow. A super_admin can use the
  admin management UI, or update the `password_hash` directly (bcrypt) in Supabase.

### Bulk import students / teachers
- Use the dashboard import panel, or `POST /api/admin/import-csv` /
  `/api/admin/teachers/import`. Format in doc 05. Duplicates are skipped.

### Adjust attendance time windows
- Edit the `school_settings` rows via the dashboard (School Settings panel) or the
  `PUT /api/admin/school-settings` endpoint. No redeploy needed.

### Block / open scanning on a date (holidays, exam days)
- Holidays: Holiday Manager UI → `holidays` table.
- One-off force allow/block: Scan-day overrides UI → `scan_day_overrides`.

### Configure who gets notified
- Notification Settings panel: per-channel (email/WhatsApp), per-event, and
  per-transport-mode toggles. Test WhatsApp delivery with the "test" button
  (`POST /api/admin/settings/test-whatsapp`).

---

## Common incidents

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Frontend can't reach API (CORS error) | `CORS_ORIGINS` doesn't include the Vercel origin | `fly secrets set CORS_ORIGINS=...`, redeploy |
| 401 on every request | Expired JWT (8h) or `JWT_SECRET` changed | Re-login; if secret rotated this is expected |
| Admin writes fail with 401/permission | `SUPABASE_SERVICE_ROLE_KEY` missing/wrong | Set the service-role key, redeploy |
| Emails not sending | Bad/expired Gmail App Password | Regenerate App Password, update `SMTP_PASSWORD` |
| WhatsApp not sending | D7 token/sender wrong, or number unverified | Check `D7_API_TOKEN`/`D7_WHATSAPP_FROM`; check `notification_logs.txt` |
| Dashboard slow / first load times out | Supabase cold start | The client already uses 60s timeout for dashboard; retry |
| Supabase 406 in logs | Single-row "not found" lookup | Benign — handled as `None` |
| Scanner ignores barcode input | Hidden input lost focus | Click anywhere on the scanner page |
| Scans recorded as "invalid time" | Current time outside configured windows, or wrong server TZ | Check `school_settings` and `TZ=Africa/Lagos` |

---

## Backups

- **Database:** Supabase → Database → Backups. Free tier has limited retention —
  consider scheduled `pg_dump` exports for anything important before destructive
  migrations.
- **Config:** keep the production `.env` / Fly secrets recorded in a secure
  password manager (not in git).

---

## Deploy checklist (quick)

1. `cd school-attendance && fly deploy` (backend)
2. Push to Vercel-connected branch or `vercel --prod` (frontend)
3. Run any new SQL migration in Supabase
4. Smoke test: `/health` → login → test scan → dashboard updates
