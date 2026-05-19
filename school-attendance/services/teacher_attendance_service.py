"""
Teacher check-in / check-out service.
Uses staff_type_config to validate time windows — no SDK, pure PostgREST HTTP.
"""
import logging
from datetime import datetime, date

from services import supabase_client as db

logger = logging.getLogger("scan")


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def _parse_hm(time_str: str) -> tuple[int, int]:
    """'07:15:00' or '07:15' → (7, 15)"""
    parts = time_str.split(":")
    return int(parts[0]), int(parts[1])


def _total_minutes(h: int, m: int) -> int:
    return h * 60 + m


def _determine_check_in_status(scan_time: datetime, config: dict) -> tuple[str, str]:
    """
    Compare scan time against (check_in_end + grace_period_minutes).
    Returns (status, comment).
    """
    grace   = config.get("grace_period_minutes") or 0
    end_h, end_m = _parse_hm(config["check_in_end"])
    limit   = _total_minutes(end_h, end_m) + grace
    scanned = _total_minutes(scan_time.hour, scan_time.minute)

    if scanned <= limit:
        return "on_time", "On time"
    late = scanned - limit
    return "late", f"Late by {late} minute{'s' if late != 1 else ''}"


def _determine_check_out_status(scan_time: datetime, config: dict) -> tuple[str, str]:
    """
    Compare scan time against the configured check-out window.
    Returns (status, comment).
    """
    start_h, start_m = _parse_hm(config["check_out_time"])
    end_h, end_m = _parse_hm(config.get("check_out_end") or config["check_out_time"])
    start = _total_minutes(start_h, start_m)
    end = _total_minutes(end_h, end_m)
    scanned = _total_minutes(scan_time.hour, scan_time.minute)

    if scanned < start:
        early = start - scanned
        return "early_departure", f"Left {early} minute{'s' if early != 1 else ''} early"
    if scanned <= end:
        return "on_time", "On-time departure"
    late = scanned - end
    return "late_checkout", f"Checked out {late} minute{'s' if late != 1 else ''} after window"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_teacher_scan(barcode_id: str, scan_time: datetime, teacher: dict | None = None) -> dict:
    """
    Process a teacher barcode scan. Automatically determines check-in vs check-out.

    Returns the same shape as the student scan response so the frontend scanner
    works without changes:
      { status, action, student_name, comments, timestamp, message, record_type }
    """
    if teacher is None:
        teacher = db.get_teacher_by_barcode(barcode_id)
    if not teacher:
        return {
            "status":  "error",
            "error":   f"Staff member not found ({barcode_id})",
            "message": "Unknown staff barcode. Please contact admin.",
        }

    config = db.get_staff_type(teacher["staff_type"])
    if not config:
        return {
            "status":  "error",
            "error":   f"No config for staff type: {teacher['staff_type']}",
            "message": "Configuration missing. Contact admin.",
        }

    today_log = db.get_teacher_log_by_date(teacher["teacher_id"], date.today().isoformat())

    if today_log is None or not today_log.get("check_in_time"):
        # ── CHECK-IN ────────────────────────────────────────────────────────
        status, comment = _determine_check_in_status(scan_time, config)
        try:
            db.insert_teacher_log({
                "teacher_id":       teacher["teacher_id"],
                "scan_date":        date.today().isoformat(),
                "check_in_time":    scan_time.isoformat(),
                "check_in_status":  status,
                "check_in_comments": comment,
            })
        except Exception as exc:
            logger.error("[TEACHER-SCAN] DB error on check-in: %s", exc)
            return {"status": "error", "error": str(exc), "message": "Database error. Try again."}

        logger.info("[TEACHER-SCAN] CHECK-IN %s (%s) — %s", teacher["full_name"], teacher["staff_type"], comment)
        return {
            "status":      "success",
            "action":      "check_in",
            "student_name": teacher["full_name"],   # reuse field so ScanLog renders the name
            "teacher_id":  teacher["teacher_id"],
            "staff_type":  teacher["staff_type"],
            "comments":    status,                  # "on_time" | "late" — drives badge colour
            "timestamp":   scan_time.isoformat(),
            "record_type": "teacher",
            "message":     f"{teacher['full_name']} checked in at {scan_time.strftime('%H:%M')} ({comment})",
        }

    elif not today_log.get("check_out_time"):
        # ── CHECK-OUT ───────────────────────────────────────────────────────
        status, comment = _determine_check_out_status(scan_time, config)
        try:
            db.update_teacher_log(today_log["log_id"], {
                "check_out_time":    scan_time.isoformat(),
                "check_out_status":  status,
                "check_out_comments": comment,
            })
        except Exception as exc:
            logger.error("[TEACHER-SCAN] DB error on check-out: %s", exc)
            return {"status": "error", "error": str(exc), "message": "Database error. Try again."}

        logger.info("[TEACHER-SCAN] CHECK-OUT %s (%s) — %s", teacher["full_name"], teacher["staff_type"], comment)
        return {
            "status":      "success",
            "action":      "check_out",
            "student_name": teacher["full_name"],
            "teacher_id":  teacher["teacher_id"],
            "staff_type":  teacher["staff_type"],
            "comments":    status,
            "timestamp":   scan_time.isoformat(),
            "record_type": "teacher",
            "message":     f"{teacher['full_name']} checked out at {scan_time.strftime('%H:%M')} ({comment})",
        }

    else:
        # Already fully logged today
        return {
            "status":  "error",
            "error":   "Already completed for today",
            "message": f"{teacher['full_name']} has already checked in and out today.",
        }
