import logging
import re
import threading
from datetime import datetime

from flask import Blueprint, request, jsonify

from services.attendance_service import process_scan
from services import notification_service
from services.teacher_attendance_service import process_teacher_scan
from services import supabase_client as db
from services.holiday_service import (
    get_day_scan_status, STATUS_WEEKEND, STATUS_HOLIDAY, STATUS_BLOCKED,
    AUDIENCE_STUDENTS, AUDIENCE_STAFF,
)
from services import tz as _tz
from config import Config
from routes.auth import require_role

scan_bp = Blueprint("scan", __name__)
logger = logging.getLogger("scan")

_BARCODE_RE = re.compile(r"^[A-Z0-9\-_]{1,20}$")


def _now() -> datetime:
    return _tz.now()


def _validate_barcode(barcode: str) -> str | None:
    if not barcode:
        return "Barcode is required"
    if not _BARCODE_RE.match(barcode):
        return "Invalid barcode format (alphanumeric, max 20 chars)"
    return None


def _check_day_status(audience: str | None = None) -> dict | None:
    """
    Returns a ready-made error response if scanning is blocked today, else None.
    audience limits holidays to those that apply to students or staff.
    """
    today = _now().strftime("%Y-%m-%d")
    day_status = get_day_scan_status(today, audience)
    if day_status == STATUS_WEEKEND:
        return {"status": "holiday", "message": "School is closed today (weekend). Scan not recorded."}
    if day_status == STATUS_HOLIDAY:
        return {"status": "holiday", "message": "School is closed today (public holiday). Scan not recorded."}
    if day_status == STATUS_BLOCKED:
        return {"status": "holiday", "message": "Scanning has been disabled by admin for today. Scan not recorded."}
    return None


def _person_summary(record: dict, person_type: str) -> dict:
    """Produce a compact dict for disambiguation display."""
    if person_type == "teacher":
        return {
            "type":       "teacher",
            "id":         record.get("teacher_id"),
            "barcode":    record.get("barcode_id"),
            "name":       record.get("full_name", "Unknown"),
            "staff_type": record.get("staff_type", ""),
            "phone":      record.get("phone", ""),
        }
    return {
        "type":         "student",
        "id":           record.get("student_id"),
        "barcode":      record.get("student_id"),
        "name":         record.get("full_name", "Unknown"),
        "class_name":   record.get("class", ""),
        "parent_phone": record.get("parent_phone", ""),
    }


# ---------------------------------------------------------------------------
# POST /api/scan
# ---------------------------------------------------------------------------

# Every role may scan; the gate device logs in with the scanner role.
_scanner_required = require_role("super_admin", "admin", "scanner")


@scan_bp.post("/scan")
@_scanner_required
def handle_scan():
    body = request.get_json(silent=True) or {}
    barcode = (body.get("barcode") or "").strip().upper()
    entry_point = (body.get("entry_point") or "main_gate").strip()

    error = _validate_barcode(barcode)
    if error:
        logger.warning("[INVALID] barcode=%r — %s", barcode, error)
        return jsonify({"status": "error", "error": error, "message": "Please provide a valid barcode"}), 400

    logger.info("[REQUEST] barcode=%s entry_point=%s", barcode, entry_point)

    teacher, student = db.get_both_by_barcode(barcode)

    # Holidays can apply to students only or staff only, so the day check
    # waits until we know who this is. Ambiguous scans are checked on confirm.
    if not (teacher and student):
        audience = AUDIENCE_STAFF if teacher else AUDIENCE_STUDENTS if student else None
        blocked = _check_day_status(audience)
        if blocked:
            return jsonify(blocked), 200

    now = _now()

    # Conflict — both a teacher and a student share this barcode
    if teacher and student:
        logger.warning("[AMBIGUOUS] barcode=%s matches teacher=%s and student=%s",
                       barcode, teacher.get("name"), student.get("name"))
        return jsonify({
            "status": "ambiguous",
            "message": "This ID belongs to two people. Please select the correct person.",
            "matches": [
                _person_summary(teacher, "teacher"),
                _person_summary(student, "student"),
            ],
        }), 200

    if teacher:
        result = process_teacher_scan(barcode, now, teacher=teacher)
    elif student:
        result = process_scan(barcode, now, entry_point, student=student)
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


# ---------------------------------------------------------------------------
# POST /api/scan/confirm  — operator has chosen which person this barcode is
# ---------------------------------------------------------------------------

@scan_bp.post("/scan/confirm")
@_scanner_required
def confirm_scan():
    """
    Body:
        { "barcode": "STU042", "person_type": "student" | "teacher", "entry_point": "main_gate" }

    Called after the disambiguation modal — processes the chosen record.
    """
    body = request.get_json(silent=True) or {}
    barcode      = (body.get("barcode") or "").strip().upper()
    person_type  = (body.get("person_type") or "").strip().lower()
    entry_point  = (body.get("entry_point") or "main_gate").strip()

    error = _validate_barcode(barcode)
    if error:
        return jsonify({"status": "error", "error": error}), 400

    if person_type not in ("student", "teacher"):
        return jsonify({"status": "error", "error": "person_type must be 'student' or 'teacher'"}), 400

    blocked = _check_day_status(AUDIENCE_STAFF if person_type == "teacher" else AUDIENCE_STUDENTS)
    if blocked:
        return jsonify(blocked), 200

    now = _now()
    logger.info("[CONFIRM] barcode=%s person_type=%s entry_point=%s", barcode, person_type, entry_point)

    if person_type == "teacher":
        teacher = db.get_teacher_by_barcode(barcode)
        if not teacher:
            return jsonify({"status": "error", "message": "Teacher record not found"}), 404
        result = process_teacher_scan(barcode, now, teacher=teacher)
    else:
        student = db.get_student(barcode)
        if not student:
            return jsonify({"status": "error", "message": "Student record not found"}), 404
        result = process_scan(barcode, now, entry_point, student=student)
        if result["status"] == "success":
            threading.Thread(
                target=_fire_notifications,
                args=(barcode, result["action"], result.get("comments"), result["timestamp"]),
                daemon=True,
            ).start()

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
    # Unauthenticated and accepts any ?time=, so it must never write real
    # records in production.
    if not Config.DEBUG:
        return jsonify({"status": "error", "error": "Not found"}), 404

    barcode = (request.args.get("barcode") or "").strip().upper()
    error = _validate_barcode(barcode)
    if error:
        return jsonify({"status": "error", "error": error}), 400

    time_override = request.args.get("time", "").strip()
    if time_override:
        try:
            h, m = map(int, time_override.split(":"))
            now = _now().replace(hour=h, minute=m, second=0, microsecond=0)
        except ValueError:
            return jsonify({"status": "error", "error": "Invalid ?time= format. Use HH:MM"}), 400
    else:
        now = _now()

    entry_point = request.args.get("entry_point", "test").strip()
    logger.info("[TEST-SCAN] barcode=%s time=%s", barcode, now.strftime("%H:%M"))

    teacher, student = db.get_both_by_barcode(barcode)

    if teacher and student:
        return jsonify({
            "status": "ambiguous",
            "message": "This ID belongs to two people. Please select the correct person.",
            "matches": [
                _person_summary(teacher, "teacher"),
                _person_summary(student, "student"),
            ],
        }), 200

    if teacher:
        result = process_teacher_scan(barcode, now, teacher=teacher)
    elif student:
        result = process_scan(barcode, now, entry_point, student=student)
    else:
        result = {
            "status": "error",
            "action": None,
            "error": f"ID not found ({barcode})",
            "message": "Barcode not recognised. Please check the ID and try again.",
        }

    status_code = 200 if result["status"] == "success" else 400
    return jsonify(result), status_code
