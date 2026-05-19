"""
Holiday management endpoints.
All routes require JWT admin auth.
"""
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request

from routes.auth import token_required
from services import supabase_client as db

holidays_bp = Blueprint("holidays", __name__)
logger = logging.getLogger("holidays")

_VALID_TYPES   = {"national", "state", "custom"}
_VALID_APPLIES = {"students", "staff", "both"}


def _validate_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# GET /api/admin/holidays
# ---------------------------------------------------------------------------

@holidays_bp.get("/holidays")
@token_required
def list_holidays():
    try:
        rows = db.get_holidays(active_only=False)
        return jsonify({"holidays": rows}), 200
    except Exception as exc:
        logger.error("list_holidays: %s", exc)
        return jsonify({"error": "Failed to load holidays"}), 500


# ---------------------------------------------------------------------------
# POST /api/admin/holidays
# ---------------------------------------------------------------------------

@holidays_bp.post("/holidays")
@token_required
def add_holiday():
    body = request.get_json(silent=True) or {}
    name        = (body.get("holiday_name") or "").strip()
    date_str    = (body.get("holiday_date") or "").strip()
    htype       = (body.get("holiday_type") or "custom").strip().lower()
    applies_to  = (body.get("applies_to")   or "both").strip().lower()
    description = (body.get("description")  or "").strip()

    if not name:
        return jsonify({"error": "holiday_name is required"}), 400
    if not _validate_date(date_str):
        return jsonify({"error": "holiday_date must be YYYY-MM-DD"}), 400
    if htype not in _VALID_TYPES:
        return jsonify({"error": f"holiday_type must be one of {_VALID_TYPES}"}), 400
    if applies_to not in _VALID_APPLIES:
        return jsonify({"error": f"applies_to must be one of {_VALID_APPLIES}"}), 400

    try:
        row = db.insert_holiday({
            "holiday_name": name,
            "holiday_date": date_str,
            "holiday_type": htype,
            "applies_to":   applies_to,
            "description":  description or None,
            "is_active":    True,
        })
        return jsonify({"holiday": row}), 201
    except Exception as exc:
        logger.error("add_holiday: %s", exc)
        if "unique" in str(exc).lower():
            return jsonify({"error": "A holiday of this type already exists on that date"}), 409
        return jsonify({"error": "Failed to add holiday"}), 500


# ---------------------------------------------------------------------------
# PATCH /api/admin/holidays/<holiday_id>  (toggle active)
# ---------------------------------------------------------------------------

@holidays_bp.patch("/holidays/<holiday_id>")
@token_required
def update_holiday(holiday_id):
    body = request.get_json(silent=True) or {}
    allowed = {"is_active", "holiday_name", "description"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return jsonify({"error": "Nothing to update"}), 400
    try:
        row = db.update_holiday(holiday_id, updates)
        return jsonify({"holiday": row}), 200
    except Exception as exc:
        logger.error("update_holiday: %s", exc)
        return jsonify({"error": "Failed to update holiday"}), 500


# ---------------------------------------------------------------------------
# DELETE /api/admin/holidays/<holiday_id>
# ---------------------------------------------------------------------------

@holidays_bp.delete("/holidays/<holiday_id>")
@token_required
def delete_holiday(holiday_id):
    try:
        db.delete_holiday(holiday_id)
        return jsonify({"message": "Holiday deleted"}), 200
    except Exception as exc:
        logger.error("delete_holiday: %s", exc)
        return jsonify({"error": "Failed to delete holiday"}), 500
