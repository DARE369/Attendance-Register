# Staff Mobile Sign-in: Repo Audit and Plan Amendments

Audit date: 2026-10-14. Compares `docs/staff-signin-plan.md` with the code on disk (including uncommitted work on `main`). Where this file and the plan disagree, this file wins.

## 1. Corrections to the plan

| Plan says | Reality | Amendment |
| --- | --- | --- |
| WhatsApp via Twilio | D7 Networks (`services/whatsapp_service.py`). WhatsApp business messages need a Meta-approved template. | Reminders use D7. Submit a `staff_signin_reminder` template for approval **now**; approval can take days and blocks Session 8 rollout, not the build. |
| New `app_settings` table | `school_settings` (key TEXT, value TEXT) already exists with an admin UI and `get_school_settings` / `upsert_school_setting` helpers. | Store accuracy default, wait time etc. in `school_settings` (values as text). Migration adds 7 tables, not 8. |
| Dashboard is "ten tabs in one bar" | Uncommitted `AppShell.jsx` already gives a collapsible sidebar with groups and a mobile drawer; the dashboard has 16 sections. No URLs yet. | Session 5 shrinks to: regroup into the plan's groups, add real URLs per section, keep mount-on-first-visit. |
| Set `TZ=Africa/Lagos` (Session 0) | Already in `fly.toml`; `services/tz.py` pins WAT (UTC+1) explicitly and every scan path uses it. | Done. Dockerfile now also sets it. |
| Holidays respect `applies_to` | Column existed but was ignored; `/api/scan` checked the day before knowing student vs staff. | Fixed in Session 0 (see section 3). |
| `X-Install-Id` header on every staff request | CORS only allows `Content-Type, Authorization` (`app.py`). | Session 2/3: add `X-Install-Id` to `allow_headers`. |
| Dates in replies like `07:12:04+01:00` | Times are stored as naive Lagos time in `TIMESTAMPTZ` columns, so Postgres records them as if UTC. All existing reads assume this. | Keep the existing convention for writes (`tz.now().isoformat()`); format replies from it. Do not mix in aware datetimes, or mobile and gate records will be an hour apart. |

## 2. Risks found that the plan doesn't cover

| Risk | Detail | Recommendation |
| --- | --- | --- |
| **`/api/test-scan` open in production** | No auth, accepts any `?time=`: anyone could write staff check-ins at any time. | **Fixed in Session 0**: returns 404 unless `FLASK_DEBUG=1`. |
| `/api/scan` had no auth | Anyone who knew a teacher's barcode could check them in with curl. | **Fixed**: login required, scanner tokens last 18 h (section 5). |
| Cold starts | `fly.toml` has `auto_stop_machines = "suspend"`, `min_machines_running = 0`. First sign-in of the morning waits for the machine. | The 15-minute reminder job from 06:00 keeps it warm on school days. Make the cron start 05:45. |
| GitHub Actions cron drift | Scheduled workflows can run 5–30 min late under load. | Fine for reminders; never use it for anything timing-critical. |
| `JWT_SECRET` default | Falls back to a literal dev string if unset. Same for the new `STAFF_JWT_SECRET`. | Confirm both are set in Fly secrets (`fly secrets list`). Consider refusing to start when `FLASK_DEBUG=0` and either is the default. |
| No tests before Session 0 | | pytest added (`tests/`, `requirements-dev.txt`). Keep the DB faked. |

## 3. Session 0 status (done, uncommitted)

- `CLAUDE.md` at repo root.
- `TZ=Africa/Lagos` in Dockerfile (fly.toml already had it).
- `config.py` / `.env.example`: `STAFF_JWT_SECRET`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `CRON_SECRET`; stale Twilio vars replaced with D7.
- `routes/auth.py`: `token_required` rejects `typ: staff`.
- Holidays: `get_holiday_by_date(date, audience)`, `get_student_day_status` / `get_staff_day_status`, `is_school_day_for_students` / `_for_staff`. `/api/scan` and `/api/scan/confirm` check the day for the person actually scanned. Unknown barcodes keep the old "any holiday closes" behaviour. The admin calendar (`/scan-day-status`) is unchanged.
- `services/staff_attendance_rules.py`: timing rules, `next_action`, and `record()` extracted. `process_teacher_scan` is now a thin adapter with identical response shapes. Two race guards added: a concurrent check-in hits the unique constraint and returns "already checked in" (was "Database error"); check-out only writes if `check_out_time` is still empty (`update_teacher_log_if_open`).
- `/api/test-scan` closed outside debug.
- `/api/scan` and `/api/scan/confirm` require login; scanner tokens last 18 h.
- 34 tests passing.

## 3b. Session 1 status (database)

- `migrations/2026-10_staff_mobile_signin.sql`: 7 new tables (no `app_settings`; settings seeded into `school_settings`), new columns on `teachers` and `teacher_attendance_logs`, review-inbox and rate-limit indexes, RLS on for new tables.
- Database-enforced rules: one active passkey per staff member (partial unique index), accuracy limit 10–100 m, zone radius 20–500 m.
- `full_schema.sql` now also contains the four May 2026 migrations it was missing, so a fresh install works again. The May transport-mode migration used `ADD CONSTRAINT IF NOT EXISTS`, which Postgres rejects; fixed in both files.
- Verified in a throwaway Postgres: fresh install, re-run, and the staff migration on its own all succeed.
- `services/supabase_client.py` helpers for every new table. **All inserts into new tables use `strict_insert=True`.** The client's default `Prefer: resolution=merge-duplicates` turns every POST into an upsert on the primary key, which would silently break reminder de-duplication and let a phone overwrite another staff member's passkey row.
- Email lookup escapes LIKE wildcards and requires an exact match (`a_b@x` must not match `axb@x`).
- Production snapshot (2026-10-14): 18 active staff, 16 with an email (2 need an email added or an admin setup code), 0 staff attendance records, RLS off on every existing table.

## 4. UX amendments (staff app)

The goal is: **open the app, see green, tap, touch the fingerprint sensor. One touch a day.**

1. **One fingerprint, not two.** The plan asks for a fingerprint to open the app *and* another to sign in. Instead: the viewing session lasts 30 days and can only read the staff member's own status and history. Every sign-in or sign-out still needs a fresh fingerprint. If there's no session, that one fingerprint also starts it (passkeys identify the person). Security is unchanged; daily friction halves.
2. **Staff never see the word "Unverified".** It reads as an accusation and will generate complaints. Staff see "✓ Signed in 07:12 · On time". If the location couldn't be confirmed, they also see a soft line: "We couldn't confirm your location this time. Nothing you need to do." Verified/unverified is shown only to admins.
3. **No "passkey" in the main flow.** Say "Use your fingerprint or face". Explain passkeys only in Help.
4. **"Sign in anyway", not "Sign in unverified".** It appears after the wait with a one-tap reason (Indoors / Weak signal / Other); free text only for Other.
5. **The wait is guided, not silent.** A progress ring, and at 15 s a tip: "Step outside or near a window". At 60 s, "Sign in anyway".
6. **Status is one big card**: colour + icon + words, never colour alone. Finding you… / You're outside the school / Weak signal / Ready. The zone diagram sits below it as a secondary detail.
7. **Success is unmistakable.** Full-screen tick, the time in large type, a short vibration (`navigator.vibrate`), then back to Home after 3 s.
8. **Ask for location only after explaining why.** If it's blocked, show phone-specific steps (Android Chrome / iPhone Safari) with a "Try again" button.
9. **Every error says what to do**, in one short sentence. No codes, no "Error 401".
10. **Accessibility:** 18 px base text, 56 px main button, AA contrast, works with system font scaling up to 130%.

Admin-side: the Review inbox defaults to "needs a decision", offers one-click "Approve all weak-signal sign-ins inside the zone", and every card says in plain words why it's there.

## 5. Decisions (made 2026-10-14)

1. **Domain: `peculiar-register.vercel.app`.** The staff app lives at `/staff` on the same domain; the admin dashboard stays at `/dashboard`.
   - Production env: `WEBAUTHN_RP_ID=peculiar-register.vercel.app`, `WEBAUTHN_ORIGIN=https://peculiar-register.vercel.app`. The API stays on Fly; that's fine, because the browser creates passkeys for the page's domain and the server only checks them.
   - `vercel.app` is a public suffix, so the RP ID must be the full host (it is). Passkeys made here will **never** work on any other address. If the school later moves to its own domain, every staff member sets up their phone again (the admin setup-code flow makes that a 1-minute job per person, but it's a whole-staff event).
   - Vercel's per-branch preview URLs can't test passkeys. Give one branch (e.g. `staging`) a fixed Vercel domain such as `peculiar-register-staging.vercel.app` and point a staging API at it with its own RP ID and origin.
2. **The two apps are sealed from each other.** Same domain, but nothing carries over without its own login:
   - Separate signing secrets (`JWT_SECRET` vs `STAFF_JWT_SECRET`); the server rejects an admin token on `/api/staff/*` and a staff token on every admin and scan endpoint (`typ: staff` check, tested).
   - Separate browser storage keys (`token`/`admin` vs `staff_session`) and separate API clients. Staff code never reads the admin keys, and vice versa.
   - Separate redirects: a failed staff request goes to `/staff/welcome`, a failed admin request to `/login`. There are no links from one app to the other.
   - The installed staff app is scoped to `/staff/`; it can't open dashboard pages inside itself.
   - Being logged into one app on a phone gives no access to the other.
3. **`/api/scan` requires login: done.** `/api/scan` and `/api/scan/confirm` need a token of any role (staff-app tokens are refused). Scanner-role tokens last 18 h instead of 8 h, so the gate device logs in once each morning. The scanner page already sent its token, so no frontend change was needed.
4. **UX amendments in section 4: accepted.** They override the plan's Staff authentication and Staff app sections where they differ. In particular the viewing session is 30 days (read-only), and staff never see "Unverified".
