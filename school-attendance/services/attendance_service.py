import logging
from datetime import datetime, date, time, timezone
from threading import Lock
from typing import Optional

from services import supabase_client as db

logger = logging.getLogger("attendance")

# ---------------------------------------------------------------------------
# Duplicate-scan guard  (in-memory; resets on server restart)
# ---------------------------------------------------------------------------
_last_scan_times: dict[str, datetime] = {}
_lock = Lock()
DUPLICATE_WINDOW_SECONDS = 5

# ---------------------------------------------------------------------------
# Time-window definitions
# Each tuple: (window_start, window_end, comment_value)
# Arrival windows use local wall-clock time of the scan.
# ---------------------------------------------------------------------------
_ARRIVAL_WINDOWS: list[tuple[time, time, Optional[str]]] = [
    (time(5, 0),  time(9, 0),  "early"),   # 05:00 – 08:59 → arrived early
    (time(9, 0),  time(10, 0), None),       # 09:00 – 09:59 → on time (no comment)
    (time(10, 0), time(12, 0), "late"),     # 10:00 – 11:59 → arrived late
]

_DEPARTURE_WINDOWS: list[tuple[time, time, Optional[str]]] = [
    (time(14, 0), time(19, 0), None),       # 14:00 – 18:59 → normal departure
]


def _classify_time(windows: list[tuple[time, time, Optional[str]]], t: time) -> Optional[str]:
    for start, end, comment in windows:
        if start <= t < end:
            return comment
    return "invalid_time"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _last_log_today(student_id: str) -> Optional[dict]:
    today = date.today().isoformat()
    logs = db.get_attendance_logs(date=today, student_id=student_id) or []
    return logs[0] if logs else None


def _check_duplicate(student_id: str) -> bool:
    """Returns True if scan should be rejected as a duplicate."""
    with _lock:
        last = _last_scan_times.get(student_id)
        now = datetime.now(timezone.utc)
        if last is not None:
            delta = (now - last).total_seconds()
            if delta < DUPLICATE_WINDOW_SECONDS:
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
        logger.warning("[DUPLICATE] %s — scanned too quickly", student_id)
        return {
            "status": "error",
            "action": None,
            "error": "Duplicate scan detected",
            "message": "Please wait 5 seconds between scans",
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

    # 4 — Time-window classification
    local_t = scan_timestamp.time()
    windows = _ARRIVAL_WINDOWS if action == "arrival" else _DEPARTURE_WINDOWS
    comments = _classify_time(windows, local_t)

    # 5 — Persist log
    #     "invalid_time" is surfaced in the API response but stored as null in
    #     the DB so the record is safe against the check constraint on older
    #     schema versions.  Run the ALTER in schema.sql if you want it stored.
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
