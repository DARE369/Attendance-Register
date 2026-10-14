# 05 — API Reference

Base URL (production): `https://peculiar-register.fly.dev`
Base URL (local): `http://localhost:5000`

**Auth:** Send `Authorization: Bearer <JWT>` for protected endpoints. Tokens come
from `POST /auth/login` and expire after 8 hours. A 401 response causes the
frontend to auto-logout. Role checks (`admin` vs `scanner`) are enforced
server-side via `require_role()`.

> This reference is derived from `frontend/src/services/api.js` (the client) and
> the route blueprints in `school-attendance/routes/`. For exact request/response
> shapes, read the corresponding route file.

---

## Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Liveness check → `{"status":"ok"}` |

## Auth — `routes/auth.py` (prefix `/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | none | Login → `{ token, admin }` |
| POST | `/auth/register` | register_secret | Create admin (requires `register_secret` matching `ADMIN_REGISTER_SECRET`) |
| GET | `/auth/me` | JWT | Current admin profile |

## Scan — `routes/scan.py` (prefix `/api`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/scan` | none* | Process a barcode scan (`{ barcode, entry_point }`) |
| POST | `/api/scan/confirm` | none* | Confirm ambiguous scan (`{ barcode, person_type, entry_point }`) |

\* Scan endpoints are open so the scanner kiosk works without per-request auth;
the scanner page itself is behind login. Review before exposing publicly (doc 08).

## Admin dashboard / export — `routes/admin.py` (prefix `/api/admin`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | JWT | Live dashboard data (polled every 3s) |
| GET | `/api/admin/attendance-log` | JWT | Attendance log with filters |
| GET | `/api/admin/export-csv` | JWT | Download attendance CSV (blob) |

## Admin user management & profile — `routes/admin_management.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/profile` | JWT | Get own profile |
| PATCH | `/api/admin/profile` | JWT | Update own profile |
| POST | `/api/admin/change-password` | JWT | Change own password |
| GET | `/api/admin/admins` | JWT (super_admin) | List admins |
| POST | `/api/admin/admins` | JWT (super_admin) | Create admin |
| DELETE | `/api/admin/admins/{id}` | JWT (super_admin) | Delete admin |

## Notification settings — `routes/settings.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/settings` | JWT | Get notification settings |
| POST | `/api/admin/settings` | JWT | Save notification settings |
| POST | `/api/admin/settings/test-whatsapp` | JWT | Send a test WhatsApp (`{ phone }`) |

## CSV import — `routes/import_csv.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/import-csv` | JWT | Bulk import students (multipart) |
| POST | `/api/admin/teachers/import` | JWT | Bulk import teachers (multipart) |

## Message templates — `routes/templates.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/templates` | JWT | List message templates |
| POST | `/api/admin/templates/{key}` | JWT | Update a template |

## Management (students / teachers / staff-types / groups / school-settings) — `routes/management.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST | `/api/admin/students` | JWT | List / create student |
| PUT/DELETE | `/api/admin/students/{student_id}` | JWT | Update / delete student |
| GET/POST | `/api/admin/teachers` | JWT | List / create teacher |
| PUT/DELETE | `/api/admin/teachers/{teacher_id}` | JWT | Update / delete teacher |
| GET/POST | `/api/admin/staff-types` | JWT | List / create staff type |
| PUT/DELETE | `/api/admin/staff-types/{config_id}` | JWT | Update / delete staff type |
| GET | `/api/admin/teacher-logs` | JWT | Teacher attendance logs |
| GET/POST | `/api/admin/student-groups` | JWT | List / create student group |
| PUT/DELETE | `/api/admin/student-groups/{id}` | JWT | Update / delete group |
| GET | `/api/admin/school-settings` | JWT | Get configurable time windows |
| PUT | `/api/admin/school-settings` | JWT | Update time windows |

## Holidays & scan-day overrides — `routes/holidays.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST | `/api/admin/holidays` | JWT | List / add holiday |
| PATCH/DELETE | `/api/admin/holidays/{id}` | JWT | Update / delete holiday |
| GET/POST | `/api/admin/scan-overrides` | JWT | List / upsert scan-day override |
| DELETE | `/api/admin/scan-overrides/{date}` | JWT | Delete override for date |
| GET | `/api/admin/scan-day-status` | JWT | Whether a given date allows scanning |

## Fraud alerts — `routes/fraud_alerts.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/fraud-alerts` | JWT | List alerts (filters) |
| PATCH | `/api/admin/fraud-alerts/{id}` | JWT | Resolve / annotate alert |

## Reports & analytics — `routes/reports.py`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/audit-logs` | JWT | Audit log entries |
| GET | `/api/admin/analytics` | JWT | Aggregate analytics (`start`,`end`) |
| GET | `/api/admin/staff-analytics/{teacher_id}` | JWT | Per-staff analytics |

> Some reports endpoints also produce PDFs (`services/pdf_service.py`). Check
> `routes/reports.py` for the exact PDF/report-generation paths and query params.

---

## CSV import format (students)
```csv
student_id,full_name,parent_phone,parent_email
STU001,John Doe,+2348012345678,john@parents.com
```
- Phone in E.164 (`+countrycode...`)
- Duplicate student IDs are **skipped**, not overwritten
- Max file size 5 MB
