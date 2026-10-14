import logging
import time as _time_module
from datetime import datetime, date, time, timezone
from threading import Lock
from typing import Optional

from services import supabase_client as db
from services import tz as _tz

logger = logging.getLogger("attendance")

# ---------------------------------------------------------------------------
# School-settings cache  (refreshed every 60 s)
# ---------------------------------------------------------------------------
_SETTINGS_DEFAULTS = {
    'arrival_early_start':     '05:00',
    'arrival_early_end':       '09:00',
    'arrival_ontime_end':      '10:00',
    'arrival_late_end':        '12:00',
    'departure_start':         '14:00',
    'departure_end':           '19:00',
    'duplicate_scan_cooldown': '5',
}

_settings_cache: dict[str, str] = {}
_settings_cache_at: float = 0.0
_SETTINGS_TTL = 60.0


def _get_settings() -> dict[str, str]:
    global _settings_cache, _settings_cache_at
    if _time_module.monotonic() - _settings_cache_at > _SETTINGS_TTL:
        try:
            _settings_cache = db.get_school_settings()
            _settings_cache_at = _time_module.monotonic()
        except Exception:
            pass  # keep using cached / defaults on DB error
    return {**_SETTINGS_DEFAULTS, **_settings_cache}


def _parse_t(s: str) -> time:
    h, m = s.split(":")[:2]
    return time(int(h), int(m))


def _t(key: str) -> time:
    return _parse_t(_get_settings().get(key, _SETTINGS_DEFAULTS[key]))


def _get_arrival_windows() -> list[tuple[time, time, Optional[str]]]:
    return [
        (_t('arrival_early_start'), _t('arrival_early_end'),  "early"),
        (_t('arrival_early_end'),   _t('arrival_ontime_end'), None),
        (_t('arrival_ontime_end'),  _t('arrival_late_end'),   "late"),
    ]


def _get_departure_windows() -> list[tuple[time, time, Optional[str]]]:
    return [
        (_t('departure_start'), _t('departure_end'), None),
    ]


# ---------------------------------------------------------------------------
# Duplicate-scan guard  (in-memory; resets on server restart)
# ---------------------------------------------------------------------------
_last_scan_times: dict[str, datetime] = {}
_lock = Lock()
DUPLICATE_WINDOW_SECONDS = 5  # fallback default


def _classify_time(windows: list[tuple[time, time, Optional[str]]], t: time) -> Optional[str]:
    for start, end, comment in windows:
        if start <= t < end:
            return comment
    return "invalid_time"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _last_log_today(student_id: str) -> Optional[dict]:
    today = _tz.today_str()
    logs = db.get_attendance_logs(date=today, student_id=student_id) or []
    return logs[0] if logs else None


def _check_duplicate(student_id: str) -> bool:
    """Returns True if scan should be rejected as a duplicate."""
    try:
        cooldown = int(_get_settings().get('duplicate_scan_cooldown', str(DUPLICATE_WINDOW_SECONDS)))
    except (ValueError, TypeError):
        cooldown = DUPLICATE_WINDOW_SECONDS

    with _lock:
        last = _last_scan_times.get(student_id)
        now = datetime.now(timezone.utc)
        if last is not None:
            delta = (now - last).total_seconds()
            if delta < cooldown:
                return True
        _last_scan_times[student_id] = now
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_scan(
    student_id: str,
    scan_timestamp: datetime,
    entry_point: str = "main_gate",
    student: dict | None = None,
) -> dict:
    """
    Core scan processor.

    Returns a dict with keys:
        status      – "success" | "error"
        action      – "arrival" | "departure" | None
        student_name, class, timestamp, comments, message   (on success)
        error, message                                       (on error)
    """
    student_id = student_id.strip().upper()

    # 1 — Duplicate-scan guard
    if _check_duplicate(student_id):
        cooldown = _get_settings().get('duplicate_scan_cooldown', str(DUPLICATE_WINDOW_SECONDS))
        logger.warning("[DUPLICATE] %s — scanned too quickly", student_id)
        return {
            "status": "error",
            "action": None,
            "error": "Duplicate scan detected",
            "message": f"Please wait {cooldown} seconds between scans",
        }

    # 2 — Student lookup (skip DB call if record was pre-fetched by caller)
    if student is None:
        try:
            student = db.get_student(student_id)
        except Exception as exc:
            logger.error("[DB ERROR] get_student(%s): %s", student_id, exc)
            return {
                "status": "error",
                "action": None,
                "error": "Database connection error",
                "message": "Could not reach the database. Please try again.",
            }

    if not student:
        logger.warning("[NOT FOUND] barcode=%s", student_id)
        return {
            "status": "error",
            "action": None,
            "error": f"Student not found ({student_id})",
            "message": "Please check the barcode and try again",
        }

    # 3 — Arrival vs departure
    try:
        last_log = _last_log_today(student_id)
    except Exception as exc:
        logger.error("[DB ERROR] get_attendance_logs(%s): %s", student_id, exc)
        return {
            "status": "error",
            "action": None,
            "error": "Database connection error",
            "message": "Could not read today's logs. Please try again.",
        }

    if last_log is None or last_log["log_type"] == "departure":
        action = "arrival"
    else:
        action = "departure"

    # 4 — Time-window classification (loaded fresh from DB every 60 s)
    local_t = scan_timestamp.time()
    windows = _get_arrival_windows() if action == "arrival" else _get_departure_windows()
    comments = _classify_time(windows, local_t)

    # 5 — Persist log
    db_comments = comments if comments in ("early", "late") else None
    try:
        db.insert_attendance_log(
            student_id=student_id,
            log_type=action,
            timestamp=scan_timestamp,
            comments=db_comments,
            entry_point=entry_point,
        )
    except Exception as exc:
        logger.error("[DB ERROR] insert_attendance_log(%s): %s", student_id, exc)
        return {
            "status": "error",
            "action": None,
            "error": "Database error",
            "message": "Failed to save attendance record. Please try again.",
        }

    # 6 — Build response
    ts_str = scan_timestamp.strftime("%Y-%m-%d %H:%M:%S")
    time_str = scan_timestamp.strftime("%I:%M %p")
    name = student["full_name"]
    cls = student["class"]

    logger.info(
        "[SCAN OK] %s | id=%-8s | %-22s | %-10s | %-9s | comment=%s",
        ts_str, student_id, name, cls, action.upper(), comments,
    )

    if comments == "invalid_time":
        message = (
            f"{name} ({cls}) marked as {action.upper()} at {time_str} "
            f"— WARNING: outside valid time window"
        )
    else:
        message = f"{name} ({cls}) marked as {action.upper()} at {time_str}"

    return {
        "status": "success",
        "action": action,
        "student_name": name,
        "class": cls,
        "timestamp": ts_str,
        "comments": comments,
        "message": message,
    }
