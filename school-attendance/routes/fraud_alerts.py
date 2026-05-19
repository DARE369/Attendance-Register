"""
Fraud alert endpoints — view and resolve alerts.
"""
import logging

from flask import Blueprint, jsonify, request

from routes.auth import token_required
from services import supabase_client as db

fraud_bp = Blueprint("fraud", __name__)
logger = logging.getLogger("fraud")


# GET /api/admin/fraud-alerts?resolved=false
@fraud_bp.get("/fraud-alerts")
@token_required
def list_alerts():
    resolved_param = request.args.get("resolved", "").lower()
    resolved = None
    if resolved_param == "true":
        resolved = True
    elif resolved_param == "false":
        resolved = False

    try:
        rows = db.get_fraud_alerts(resolved=resolved)
        return jsonify({"alerts": rows}), 200
    except Exception as exc:
        logger.error("list_alerts: %s", exc)
        return jsonify({"error": "Failed to load fraud alerts"}), 500


# PATCH /api/admin/fraud-alerts/<alert_id>
@fraud_bp.patch("/fraud-alerts/<alert_id>")
@token_required
def update_alert(alert_id):
    body = request.get_json(silent=True) or {}
    allowed = {"is_resolved", "admin_notes"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return jsonify({"error": "Nothing to update"}), 400
    try:
        row = db.update_fraud_alert(alert_id, updates)
        return jsonify({"alert": row}), 200
    except Exception as exc:
        logger.error("update_alert: %s", exc)
        return jsonify({"error": "Failed to update alert"}), 500
