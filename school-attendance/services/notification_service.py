"""
Central notification dispatcher.
Called in a background thread after each successful scan — never blocks the HTTP response.
"""
import logging
import time
from typing import Optional

from services import supabase_client as db
from services import email_service, whatsapp_service
from config import Config

logger = logging.getLogger("notification")

# Default settings used when an admin has no notification_settings row yet
_DEFAULTS = {
    "email_enabled":         True,
    "whatsapp_enabled":      True,
    "notify_late_arrivals":  True,
    "notify_non_arrivals":   True,
    "notify_non_departures": True,
}

# ---------------------------------------------------------------------------
# Template system
# ---------------------------------------------------------------------------

# Hardcoded fallbacks used when the message_templates table doesn't exist yet
_BUILTIN_TEMPLATES: dict[str, dict] = {
    "parent_arrival_email": {
        "channel": "email",
        "subject": "Your child has arrived at school",
        "body":    "Dear Parent/Guardian,\n\nYour child {student_name} ({class}) has arrived at school today at {arrival_time}.\n\nYour child is safe. Have a great day!\n\n{school_name}",
    },
    "parent_arrival_whatsapp": {
        "channel": "whatsapp",
        "body":    "Hi! Your child *{student_name}* has arrived at {school_name} at *{arrival_time}*. They are safe!\n- {school_name}",
    },
    "parent_departure_email": {
        "channel": "email",
        "subject": "Your child has left school",
        "body":    "Dear Parent/Guardian,\n\nYour child {student_name} has left school today at {departure_time}.\n\nPlease ensure someone is available to receive them.\n\n{school_name}",
    },
    "parent_departure_whatsapp": {
        "channel": "whatsapp",
        "body":    "Hi! Your child *{student_name}* has left {school_name} at *{departure_time}*. Please be ready!\n- {school_name}",
    },
    "admin_late_arrival_email": {
        "channel": "email",
        "subject": "Late Arrival: {student_name}",
        "body":    "Hello Admin,\n\nStudent {student_name} ({class}) arrived LATE at {arrival_time}.\n\nStandard arrival time is 9:00 AM. Please follow up if needed.\n\n{school_name}",
    },
    "admin_non_arrival_email": {
        "channel": "email",
        "subject": "Non-Arrival: {student_name}",
        "body":    "Hello Admin,\n\nStudent {student_name} ({class}) has NOT arrived as of {time}.\n\nPlease contact the parent immediately.\n\n{school_name}",
    },
    "admin_non_departure_email": {
        "channel": "email",
        "subject": "Student Still at School: {student_name}",
        "body":    "Hello Admin,\n\nStudent {student_name} ({class}) has NOT departed as of {time}.\n\nPlease check on their status immediately.\n\n{school_name}",
    },
}

_template_cache: dict[str, dict] = {}
_cache_loaded_at: float = 0.0
_CACHE_TTL = 60.0  # seconds


def _load_templates() -> None:
    global _template_cache, _cache_loaded_at
    try:
        rows = db.get_all_templates()
        _template_cache = {r["template_key"]: r for r in rows}
        _cache_loaded_at = time.monotonic()
    except Exception as exc:
        logger.warning("[NOTIFY] Could not load templates from DB (%s) — using built-in defaults", exc)
        _cache_loaded_at = time.monotonic()  # prevent hammering DB on every notification


def _get_template(key: str) -> dict:
    if time.monotonic() - _cache_loaded_at > _CACHE_TTL:
        _load_templates()
    return _template_cache.get(key) or _BUILTIN_TEMPLATES.get(key, {})


def _fmt(body: str, variables: dict) -> str:
    """Replace {key} placeholders with values from the variables dict."""
    for k, v in variables.items():
        body = body.replace(f"{{{k}}}", str(v or ""))
    return body


# ---------------------------------------------------------------------------
# Logic helpers
# ---------------------------------------------------------------------------

def should_notify_parent(log_type: str, comments: Optional[str]) -> bool:
    """Always notify parents on every arrival/departure scan."""
    return log_type in ("arrival", "departure")


def should_notify_admin(
    log_type: str,
    comments: Optional[str],
    admin_settings: dict,
) -> tuple[bool, str]:
    """
    Returns (should_notify, notification_type).
    Only scan-triggered condition: late arrival.
    Non-arrival / non-departure are checked by a scheduled job (see check_non_arrivals /
    check_non_departures below) — they cannot be detected from a single scan.
    """
    settings = {**_DEFAULTS, **admin_settings}

    if log_type == "arrival" and comments == "late" and settings["notify_late_arrivals"]:
        return True, "late_arrival"

    return False, ""


# ---------------------------------------------------------------------------
# Main dispatcher  (run in a daemon thread from routes/scan.py)
# ---------------------------------------------------------------------------

def process_attendance_notification(
    student_id: str,
    log_type: str,
    comments: Optional[str],
    scan_timestamp: str,
) -> None:
    """
    1. Fetch student details from DB.
    2. Send parent email + WhatsApp (always).
    3. Send admin email + WhatsApp if conditions are met.
    """
    try:
        student = db.get_student(student_id)
        if not student:
            logger.warning("[NOTIFY] Student %s not found — skipping notification", student_id)
            return

        parent_email  = student.get("parent_email")  or ""
        parent_phone  = student.get("parent_phone")  or ""
        student_name  = student["full_name"]
        student_class = student["class"]

        # Format timestamp → "08:30 AM"
        time_str = _fmt_time(scan_timestamp)

        base_vars = {
            "student_name": student_name,
            "class":        student_class,
            "school_name":  Config.SCHOOL_NAME,
        }

        # ── Parent notifications ──────────────────────────────────────────────
        if should_notify_parent(log_type, comments):
            if log_type == "arrival":
                vars_ = {**base_vars, "arrival_time": time_str}
                _send_parent_email(parent_email, "parent_arrival_email", vars_)
                _send_parent_whatsapp(parent_phone, "parent_arrival_whatsapp", vars_)
            else:
                vars_ = {**base_vars, "departure_time": time_str}
                _send_parent_email(parent_email, "parent_departure_email", vars_)
                _send_parent_whatsapp(parent_phone, "parent_departure_whatsapp", vars_)

        # ── Admin notifications ───────────────────────────────────────────────
        all_settings = db.get_all_admin_settings() or []
        for row in all_settings:
            notify, ntype = should_notify_admin(log_type, comments, row)
            if not notify:
                continue

            admin_info  = row.get("admins") or {}
            admin_email = admin_info.get("email", "")
            tmpl_key    = f"admin_{ntype}_email"
            vars_       = {**base_vars, "arrival_time": time_str}

            if row.get("email_enabled", True) and admin_email:
                _send_admin_email(admin_email, tmpl_key, vars_, ntype)

    except Exception as exc:
        logger.error("[NOTIFY] Unhandled error for %s: %s", student_id, exc)


# ---------------------------------------------------------------------------
# Scheduled checks (call from a cron / APScheduler job)
# ---------------------------------------------------------------------------

def check_non_arrivals(cutoff_time: str = "12:00") -> None:
    """
    Notify admins about students who have NOT arrived by cutoff_time.
    Should be triggered by a scheduled job at 12:00 PM on school days.
    """
    from datetime import date

    try:
        today    = date.today().isoformat()
        students = db.get_all_students() or []
        logs     = db.get_attendance_logs(date=today) or []

        arrived_ids = {l["student_id"] for l in logs if l["log_type"] == "arrival"}
        pending     = [s for s in students if s["student_id"] not in arrived_ids]

        if not pending:
            logger.info("[NOTIFY] Non-arrival check: all students have arrived.")
            return

        logger.info("[NOTIFY] Non-arrival check: %d student(s) not yet arrived.", len(pending))

        all_settings = db.get_all_admin_settings() or []
        for row in all_settings:
            if not row.get("notify_non_arrivals", True):
                continue

            admin_info  = row.get("admins") or {}
            admin_email = admin_info.get("email", "")

            for stu in pending:
                vars_ = {
                    "student_name": stu["full_name"],
                    "class":        stu["class"],
                    "time":         cutoff_time,
                    "school_name":  Config.SCHOOL_NAME,
                }
                if row.get("email_enabled", True) and admin_email:
                    _send_admin_email(admin_email, "admin_non_arrival_email", vars_, "non_arrival")

    except Exception as exc:
        logger.error("[NOTIFY] check_non_arrivals error: %s", exc)


def check_non_departures(cutoff_time: str = "18:00") -> None:
    """
    Notify admins about students still on premises past cutoff_time.
    Should be triggered by a scheduled job at 6:00 PM on school days.
    """
    from datetime import date

    try:
        today    = date.today().isoformat()
        logs     = db.get_attendance_logs(date=today) or []

        # Students whose LAST log is an arrival (still on premises)
        last_log: dict[str, dict] = {}
        for log in reversed(logs):   # logs are newest-first, reversed = oldest-first
            last_log[log["student_id"]] = log

        still_here = [
            l for l in last_log.values() if l["log_type"] == "arrival"
        ]

        if not still_here:
            logger.info("[NOTIFY] Non-departure check: no students still on premises.")
            return

        logger.info("[NOTIFY] Non-departure check: %d student(s) still on premises.", len(still_here))

        all_settings = db.get_all_admin_settings() or []
        for row in all_settings:
            if not row.get("notify_non_departures", True):
                continue

            admin_info  = row.get("admins") or {}
            admin_email = admin_info.get("email", "")

            for log in still_here:
                stu  = db.get_student(log["student_id"]) or {}
                vars_ = {
                    "student_name": stu.get("full_name", log["student_id"]),
                    "class":        stu.get("class", ""),
                    "time":         cutoff_time,
                    "school_name":  Config.SCHOOL_NAME,
                }
                if row.get("email_enabled", True) and admin_email:
                    _send_admin_email(admin_email, "admin_non_departure_email", vars_, "non_departure")

    except Exception as exc:
        logger.error("[NOTIFY] check_non_departures error: %s", exc)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _send_parent_email(email: str, tmpl_key: str, vars_: dict) -> None:
    if not email:
        return
    tmpl = _get_template(tmpl_key)
    if not tmpl:
        return
    subject = _fmt(tmpl.get("subject", "School Notification"), vars_)
    body    = _fmt(tmpl.get("body", ""), vars_)
    email_service.send_templated_email(email, subject, body)


def _send_parent_whatsapp(phone: str, tmpl_key: str, vars_: dict) -> None:
    if not phone:
        return
    tmpl = _get_template(tmpl_key)
    if not tmpl:
        return
    body = _fmt(tmpl.get("body", ""), vars_)
    whatsapp_service.send_templated_whatsapp(phone, body)


def _send_admin_email(email: str, tmpl_key: str, vars_: dict, fallback_type: str) -> None:
    """Try template first; fall back to the rich HTML admin notification."""
    if not email:
        return
    tmpl = _get_template(tmpl_key)
    if tmpl and tmpl.get("body"):
        subject = _fmt(tmpl.get("subject", "Admin Alert"), vars_)
        body    = _fmt(tmpl.get("body", ""), vars_)
        email_service.send_templated_email(email, subject, body)
    else:
        details = {
            "student_name": vars_.get("student_name", ""),
            "class":        vars_.get("class", ""),
            "time":         vars_.get("arrival_time") or vars_.get("time", "—"),
            "message":      f"{vars_.get('student_name')} — {fallback_type.replace('_', ' ')}",
        }
        email_service.send_admin_notification(email, fallback_type, details)


def _fmt_time(ts: Optional[str]) -> str:
    if not ts:
        return "—"
    try:
        clean = ts.replace("T", " ").split("+")[0].split(".")[0]
        h, m  = clean.split(" ")[1].split(":")[:2]
        hour  = int(h)
        return f"{hour % 12 or 12}:{m} {'PM' if hour >= 12 else 'AM'}"
    except (ValueError, IndexError, AttributeError):
        return ts
