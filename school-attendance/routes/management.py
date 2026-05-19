"""
CRUD management endpoints for students, teachers, staff types, and audit logs.
All routes require JWT. Mutations are audit-logged in daemon threads.
"""
import logging
import re
import threading
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request

from routes.auth import token_required
from services import supabase_client as db
from services import csv_service
from services.audit_service import log_audit

management_bp = Blueprint("management", __name__)
logger = logging.getLogger("scan")

_VALID_STAFF_TYPES = None  # soft cache; refreshed per-request if None
_TIME_RE = re.compile(r"^\d{2}:\d{2}(:\d{2})?$")


def _normalize_time(value):
    value = (value or "").strip()
    if not _TIME_RE.match(value):
        return None
    parts = value.split(":")
    hour = int(parts[0])
    minute = int(parts[1])
    second = int(parts[2]) if len(parts) == 3 else 0
    if hour > 23 or minute > 59 or second > 59:
        return None
    return f"{hour:02d}:{minute:02d}:{second:02d}"


def _time_minutes(value):
    hour, minute = value.split(":")[:2]
    return int(hour) * 60 + int(minute)


def _audit(admin_id, action, table_name, record_id=None, old_value=None, new_value=None, description=None):
    threading.Thread(
        target=log_audit,
        args=(admin_id, action),
        kwargs=dict(
            table_name=table_name,
            record_id=record_id,
            old_value=old_value,
            new_value=new_value,
            description=description,
        ),
        daemon=True,
    ).start()


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

@management_bp.get("/students")
@token_required
def list_students():
    try:
        students = db.get_all_students()
        return jsonify({"students": students, "total": len(students)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@management_bp.post("/students")
@token_required
def add_student():
    from flask import g
    body = request.get_json(silent=True) or {}

    student_id  = (body.get("student_id") or "").strip().upper()
    full_name   = (body.get("full_name") or "").strip()
    class_name  = (body.get("class") or "").strip()

    if not student_id or not full_name or not class_name:
        return jsonify({"error": "student_id, full_name, and class are required"}), 400

    if db.get_student(student_id):
        return jsonify({"error": f"Student ID '{student_id}' is already registered"}), 409

    student = {
        "student_id":    student_id,
        "full_name":     full_name,
        "class":         class_name,
        "parent_phone":  (body.get("parent_phone") or "").strip() or None,
        "parent_email":  (body.get("parent_email") or "").strip() or None,
    }

    try:
        result = db.insert_student(student)
    except Exception as exc:
        msg = str(exc)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return jsonify({"error": f"Student ID '{student_id}' already exists"}), 409
        return jsonify({"error": msg}), 500

    _audit(g.admin_id, "add_student", "students", record_id=student_id,
           new_value=result, description=f"Added student {full_name} ({student_id})")
    return jsonify(result), 201


@management_bp.put("/students/<student_id>")
@token_required
def update_student(student_id: str):
    from flask import g
    student_id = student_id.upper()
    body = request.get_json(silent=True) or {}

    existing = db.get_student(student_id)
    if not existing:
        return jsonify({"error": f"Student '{student_id}' not found"}), 404

    updates = {}
    for field in ("full_name", "class", "parent_phone", "parent_email"):
        if field in body:
            updates[field] = (body[field] or "").strip() or None

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        result = db.update_student(student_id, updates)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    _audit(g.admin_id, "edit_student", "students", record_id=student_id,
           old_value=existing, new_value=result,
           description=f"Edited student {student_id}")
    return jsonify(result)


@management_bp.delete("/students/<student_id>")
@token_required
def delete_student(student_id: str):
    from flask import g
    student_id = student_id.upper()

    existing = db.get_student(student_id)
    if not existing:
        return jsonify({"error": f"Student '{student_id}' not found"}), 404

    try:
        db.delete_student(student_id)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    _audit(g.admin_id, "delete_student", "students", record_id=student_id,
           old_value=existing, description=f"Deleted student {existing['full_name']} ({student_id})")
    return jsonify({"message": f"Student '{student_id}' deleted"}), 200


# ---------------------------------------------------------------------------
# Teachers
# ---------------------------------------------------------------------------

@management_bp.get("/teachers")
@token_required
def list_teachers():
    try:
        teachers = db.get_all_teachers()
        return jsonify({"teachers": teachers, "total": len(teachers)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@management_bp.post("/teachers")
@token_required
def add_teacher():
    from flask import g
    body = request.get_json(silent=True) or {}

    full_name  = (body.get("full_name") or "").strip()
    staff_type = (body.get("staff_type") or "").strip()
    barcode_id = (body.get("barcode_id") or "").strip().upper()

    if not full_name or not staff_type or not barcode_id:
        return jsonify({"error": "full_name, staff_type, and barcode_id are required"}), 400

    if db.get_teacher_by_barcode(barcode_id):
        return jsonify({"error": f"Barcode ID '{barcode_id}' is already assigned to another staff member"}), 409

    # Validate that the staff_type exists and is active
    config = db.get_staff_type(staff_type)
    if not config:
        return jsonify({"error": f"Staff type '{staff_type}' not found or inactive"}), 400

    teacher = {
        "teacher_id": str(uuid.uuid4()),
        "full_name":  full_name,
        "staff_type": staff_type,
        "barcode_id": barcode_id,
        "phone":      (body.get("phone") or "").strip() or None,
        "email":      (body.get("email") or "").strip() or None,
        "is_active":  True,
    }

    try:
        result = db.insert_teacher(teacher)
    except Exception as exc:
        msg = str(exc)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return jsonify({"error": f"Barcode '{barcode_id}' is already assigned to another teacher"}), 409
        return jsonify({"error": msg}), 500

    _audit(g.admin_id, "add_teacher", "teachers", record_id=teacher["teacher_id"],
           new_value=result, description=f"Added teacher {full_name} ({staff_type})")
    return jsonify(result), 201


@management_bp.put("/teachers/<teacher_id>")
@token_required
def update_teacher(teacher_id: str):
    from flask import g
    body = request.get_json(silent=True) or {}

    teachers = db.get_all_teachers()
    existing = next((t for t in teachers if t["teacher_id"] == teacher_id), None)
    if not existing:
        return jsonify({"error": f"Teacher '{teacher_id}' not found"}), 404

    updates = {}
    for field in ("full_name", "phone", "email", "is_active"):
        if field in body:
            updates[field] = body[field]

    if "staff_type" in body:
        staff_type = (body["staff_type"] or "").strip()
        config = db.get_staff_type(staff_type)
        if not config:
            return jsonify({"error": f"Staff type '{staff_type}' not found or inactive"}), 400
        updates["staff_type"] = staff_type

    if "barcode_id" in body:
        updates["barcode_id"] = (body["barcode_id"] or "").strip().upper()

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        result = db.update_teacher(teacher_id, updates)
    except Exception as exc:
        msg = str(exc)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return jsonify({"error": "Barcode ID is already assigned to another teacher"}), 409
        return jsonify({"error": msg}), 500

    _audit(g.admin_id, "edit_teacher", "teachers", record_id=teacher_id,
           old_value=existing, new_value=result,
           description=f"Edited teacher {existing['full_name']}")
    return jsonify(result)


@management_bp.delete("/teachers/<teacher_id>")
@token_required
def delete_teacher(teacher_id: str):
    from flask import g
    teachers = db.get_all_teachers()
    existing = next((t for t in teachers if t["teacher_id"] == teacher_id), None)
    if not existing:
        return jsonify({"error": f"Teacher '{teacher_id}' not found"}), 404

    try:
        db.delete_teacher(teacher_id)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    _audit(g.admin_id, "delete_teacher", "teachers", record_id=teacher_id,
           old_value=existing, description=f"Deleted teacher {existing['full_name']}")
    return jsonify({"message": f"Teacher '{existing['full_name']}' deleted"}), 200


@management_bp.post("/teachers/import")
@token_required
def import_teachers_csv():
    from flask import g

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are accepted (.csv)"}), 400

    file_bytes = file.read()

    try:
        rows = csv_service.parse_teacher_csv_file(file_bytes)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not rows:
        return jsonify({"error": "CSV has no data rows"}), 400

    result = csv_service.batch_insert_teachers(rows)

    if result["inserted"] > 0:
        _audit(g.admin_id, "add_teacher", "teachers",
               description=f"Bulk imported {result['inserted']} teacher(s) via CSV")

    return jsonify(result)


# ---------------------------------------------------------------------------
# Staff type configuration
# ---------------------------------------------------------------------------

@management_bp.get("/staff-types")
@token_required
def list_staff_types():
    try:
        configs = db.get_all_staff_types()
        return jsonify({"staff_types": configs, "total": len(configs)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@management_bp.post("/staff-types")
@token_required
def add_staff_type():
    from flask import g
    body = request.get_json(silent=True) or {}

    staff_type      = (body.get("staff_type") or "").strip()
    check_in_start  = _normalize_time(body.get("check_in_start"))
    check_in_end    = _normalize_time(body.get("check_in_end"))
    check_out_time  = _normalize_time(body.get("check_out_time"))
    check_out_end   = _normalize_time(body.get("check_out_end") or body.get("check_out_time"))

    if not staff_type or not check_in_start or not check_in_end or not check_out_time or not check_out_end:
        return jsonify({
            "error": "staff_type, check_in_start, check_in_end, check_out_time, and check_out_end are required"
        }), 400

    if _time_minutes(check_out_end) < _time_minutes(check_out_time):
        return jsonify({"error": "check_out_end must be the same as or later than check_out_time"}), 400

    try:
        grace_period_minutes = int(body.get("grace_period_minutes") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "grace_period_minutes must be a number"}), 400

    config = {
        "config_id":             str(uuid.uuid4()),
        "staff_type":            staff_type,
        "check_in_start":        check_in_start,
        "check_in_end":          check_in_end,
        "check_out_time":        check_out_time,
        "check_out_end":         check_out_end,
        "grace_period_minutes":  grace_period_minutes,
        "is_active":             True,
    }

    try:
        result = db.insert_staff_type(config)
    except Exception as exc:
        msg = str(exc)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return jsonify({"error": f"Staff type '{staff_type}' already exists"}), 409
        return jsonify({"error": msg}), 500

    _audit(g.admin_id, "add_staff_type", "staff_type_config", record_id=config["config_id"],
           new_value=result, description=f"Added staff type '{staff_type}'")
    return jsonify(result), 201


@management_bp.put("/staff-types/<config_id>")
@token_required
def update_staff_type(config_id: str):
    from flask import g
    configs = db.get_all_staff_types()
    existing = next((c for c in configs if c["config_id"] == config_id), None)
    if not existing:
        return jsonify({"error": f"Staff type config '{config_id}' not found"}), 404

    body = request.get_json(silent=True) or {}
    updates = {}
    for field in ("check_in_start", "check_in_end", "check_out_time", "check_out_end"):
        if field in body:
            value = _normalize_time(body[field])
            if not value:
                return jsonify({"error": f"{field} must be a valid time in HH:MM format"}), 400
            updates[field] = value
    if "is_active" in body:
        updates["is_active"] = body["is_active"]
    if "grace_period_minutes" in body:
        try:
            updates["grace_period_minutes"] = int(body["grace_period_minutes"] or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "grace_period_minutes must be a number"}), 400

    check_out_time = updates.get("check_out_time") or existing.get("check_out_time")
    check_out_end = updates.get("check_out_end") or existing.get("check_out_end") or check_out_time
    if check_out_time and check_out_end and _time_minutes(check_out_end) < _time_minutes(check_out_time):
        return jsonify({"error": "check_out_end must be the same as or later than check_out_time"}), 400

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        result = db.update_staff_type(config_id, updates)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    _audit(g.admin_id, "edit_staff_type", "staff_type_config", record_id=config_id,
           old_value=existing, new_value=result,
           description=f"Edited staff type '{existing['staff_type']}'")
    return jsonify(result)


@management_bp.delete("/staff-types/<config_id>")
@token_required
def delete_staff_type(config_id: str):
    from flask import g
    configs = db.get_all_staff_types()
    existing = next((c for c in configs if c["config_id"] == config_id), None)
    if not existing:
        return jsonify({"error": "Staff type not found"}), 404

    try:
        db.delete_staff_type(config_id)
    except Exception as exc:
        msg = str(exc)
        if "23503" in msg or "foreign key" in msg.lower():
            return jsonify({
                "error": f"Cannot delete '{existing['staff_type']}' — staff members are assigned to it. "
                         "Reassign or remove those staff members first."
            }), 409
        return jsonify({"error": msg}), 500

    _audit(g.admin_id, "delete_staff_type", "staff_type_config", record_id=config_id,
           description=f"Deleted staff type '{existing['staff_type']}'")
    return jsonify({"message": f"Staff type '{existing['staff_type']}' deleted"}), 200


# ---------------------------------------------------------------------------
# Teacher attendance logs (read-only)
# ---------------------------------------------------------------------------

@management_bp.get("/teacher-logs")
@token_required
def get_teacher_logs():
    try:
        date       = request.args.get("date")
        teacher_id = request.args.get("teacher_id")
        logs = db.get_teacher_logs(date=date, teacher_id=teacher_id)
        return jsonify({"logs": logs, "total": len(logs)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@management_bp.get("/audit-logs")
@token_required
def get_audit_logs():
    try:
        limit  = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
        limit  = min(max(limit, 1), 200)
        logs   = db.get_audit_logs(limit=limit, offset=offset)
        return jsonify({"logs": logs, "limit": limit, "offset": offset})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
