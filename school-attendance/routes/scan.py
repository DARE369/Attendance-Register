import logging
import re
import threading
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from datetime import datetime

from flask import Blueprint, request, jsonify

from services.attendance_service import process_scan
from services import notification_service
from services.teacher_attendance_service import process_teacher_scan
from services import supabase_client as db
from services.holiday_service import is_school_day, is_weekend, is_holiday

scan_bp = Blueprint("scan", __name__)
logger = logging.getLogger("scan")

_BARCODE_RE = re.compile(r"^[A-Z0-9\-_]{1,20}$")


def _now() -> datetime:
    return datetime.now()


def _validate_barcode(barcode: str) -> str | None:
    """Returns an error string if invalid, else None."""
    if not barcode:
        return "Barcode is required"
    if not _BARCODE_RE.match(barcode):
        return "Invalid barcode format (alphanumeric, max 20 chars)"
    return None


def _resolve_scan_target(barcode: str) -> tuple[dict | None, bool]:
    """
    Lookup teacher and student records in parallel.
    Returns (record, is_teacher). record is None if barcode matches nothing.
    """
    with ThreadPoolExecutor(max_workers=2) as pool:
        ft = pool.submit(db.get_teacher_by_barcode, barcode)
        fs = pool.submit(db.get_student, barcode)
        teacher = ft.result()
        student = fs.result()
    if teacher:
        return teacher, True
    if student:
        return student, False
    return None, False


# ---------------------------------------------------------------------------
# POST /api/scan
# ---------------------------------------------------------------------------

@scan_bp.post("/scan")
def handle_scan():
    """
    Body:
        { "barcode": "STU001", "entry_point": "main_gate" }

    Returns scan result with action, student details, comments, message.
    No JWT required — the scanner is a trusted on-site device.
    """
    body = request.get_json(silent=True) or {}
    barcode = (body.get("barcode") or "").strip().upper()
    entry_point = (body.get("entry_point") or "main_gate").strip()

    error = _validate_barcode(barcode)
    if error:
        logger.warning("[INVALID] barcode=%r entry_point=%s — %s", barcode, entry_point, error)
        return jsonify({
            "status": "error",
            "error": error,
            "message": "Please provide a valid barcode",
        }), 400

    # Weekend / holiday guard
    today = _now().strftime("%Y-%m-%d")
    if is_weekend(today):
        return jsonify({
            "status": "holiday",
            "message": "School is closed today (weekend). Scan not recorded.",
        }), 200
    if is_holiday(today):
        return jsonify({
            "status": "holiday",
            "message": "School is closed today (public holiday). Scan not recorded.",
        }), 200

    logger.info("[REQUEST] barcode=%s entry_point=%s", barcode, entry_point)

    record, is_teacher = _resolve_scan_target(barcode)
    now = _now()
    if is_teacher:
        result = process_teacher_scan(barcode, now, teacher=record)
    elif record is not None:
        result = process_scan(barcode, now, entry_point, student=record)
        if result["status"] == "success":
            threading.Thread(
                target=_fire_notifications,
                args=(barcode, result["action"], result.get("comments"), result["timestamp"]),
                daemon=True,
            ).start()
    else:
        result = {
            "status": "error",
            "action": None,
            "error": f"ID not found ({barcode})",
            "message": "Barcode not recognised. Please check the ID and try again.",
        }

    status_code = 200 if result["status"] == "success" else 400
    return jsonify(result), status_code


def _fire_notifications(student_id: str, log_type: str, comments, timestamp: str) -> None:
    try:
        notification_service.process_attendance_notification(
            student_id, log_type, comments, timestamp
        )
    except Exception as exc:
        logger.error("[NOTIFY-THREAD] %s", exc)


# ---------------------------------------------------------------------------
# GET /api/test-scan?barcode=STU001
# ---------------------------------------------------------------------------

@scan_bp.get("/test-scan")
def test_scan():
    """
    Convenience endpoint for testing without a physical scanner.
    Accepts an optional ?time=HH:MM parameter to simulate different clock times.

    Examples:
        GET /api/test-scan?barcode=STU001
        GET /api/test-scan?barcode=STU001&time=08:30   → forces 08:30 today
        GET /api/test-scan?barcode=STU001&time=14:00   → forces 14:00 today
    """
    barcode = (request.args.get("barcode") or "").strip().upper()
    error = _validate_barcode(barcode)
    if error:
        return jsonify({"status": "error", "error": error}), 400

    # Optional clock override for testing time windows
    time_override = request.args.get("time", "").strip()
    if time_override:
        try:
            h, m = map(int, time_override.split(":"))
            now = _now().replace(hour=h, minute=m, second=0, microsecond=0)
        except ValueError:
            return jsonify({
                "status": "error",
                "error": "Invalid ?time= format. Use HH:MM (e.g. 08:30)",
            }), 400
    else:
        now = _now()

    entry_point = request.args.get("entry_point", "test").strip()
    logger.info("[TEST-SCAN] barcode=%s time=%s", barcode, now.strftime("%H:%M"))

    record, is_teacher = _resolve_scan_target(barcode)
    if is_teacher:
        result = process_teacher_scan(barcode, now, teacher=record)
    elif record is not None:
        result = process_scan(barcode, now, entry_point, student=record)
    else:
        result = {
            "status": "error",
            "action": None,
            "error": f"ID not found ({barcode})",
            "message": "Barcode not recognised. Please check the ID and try again.",
        }

    status_code = 200 if result["status"] == "success" else 400
    return jsonify(result), status_code
