"""
Teacher check-in / check-out via the gate barcode scanner.
Timing and recording rules live in services.staff_attendance_rules; this module
only adapts them to the scanner's response shape.
"""
import logging
from datetime import datetime

from services import supabase_client as db
from services import staff_attendance_rules as rules

logger = logging.getLogger("scan")


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

    result = rules.record(teacher, config, scan_time)

    if result["ok"]:
        action, status, comment = result["action"], result["status"], result["comment"]
        verb = "checked in" if action == rules.ACTION_CHECK_IN else "checked out"
        logger.info("[TEACHER-SCAN] %s %s (%s) — %s",
                    action.upper().replace("_", "-"), teacher["full_name"], teacher["staff_type"], comment)
        return {
            "status":      "success",
            "action":      action,
            "student_name": teacher["full_name"],   # reuse field so ScanLog renders the name
            "teacher_id":  teacher["teacher_id"],
            "staff_type":  teacher["staff_type"],
            "comments":    status,                  # drives badge colour
            "timestamp":   scan_time.isoformat(),
            "record_type": "teacher",
            "message":     f"{teacher['full_name']} {verb} at {scan_time.strftime('%H:%M')} ({comment})",
        }

    if result["reason"] == "db_error":
        return {"status": "error", "error": result["error"], "message": "Database error. Try again."}

    if result["reason"] == "already_checked_in":
        return {
            "status":  "error",
            "error":   "Already checked in",
            "message": f"{teacher['full_name']} has already checked in today.",
        }

    # Already fully logged today
    return {
        "status":  "error",
        "error":   "Already completed for today",
        "message": f"{teacher['full_name']} has already checked in and out today.",
    }
