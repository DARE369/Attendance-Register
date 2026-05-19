from flask import Blueprint, jsonify, request, g

from routes.auth import token_required
from services import supabase_client as db

settings_bp = Blueprint("settings", __name__)

_ALLOWED_KEYS = frozenset({
    "email_enabled",
    "whatsapp_enabled",
    "notify_late_arrivals",
    "notify_non_arrivals",
    "notify_non_departures",
})

_DEFAULTS = {
    "email_enabled":         True,
    "whatsapp_enabled":      True,
    "notify_late_arrivals":  True,
    "notify_non_arrivals":   True,
    "notify_non_departures": True,
}


@settings_bp.get("/settings")
@token_required
def get_settings():
    existing = db.get_notification_settings(g.admin_id)
    if not existing:
        return jsonify(_DEFAULTS)
    # Strip DB-internal fields before returning
    return jsonify({k: existing[k] for k in _ALLOWED_KEYS if k in existing})


@settings_bp.post("/settings")
@token_required
def save_settings():
    body = request.get_json(silent=True) or {}
    updates = {k: bool(v) for k, v in body.items() if k in _ALLOWED_KEYS}

    if not updates:
        return jsonify({"error": "No valid settings keys provided"}), 400

    result = db.update_notification_settings(g.admin_id, updates)
    return jsonify({
        "message":  "Settings saved",
        "settings": {k: result[k] for k in _ALLOWED_KEYS if k in result},
    })
