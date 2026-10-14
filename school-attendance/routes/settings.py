from flask import Blueprint, jsonify, request, g

from routes.auth import require_role
_admin_required = require_role("admin", "super_admin")
from services import supabase_client as db
from services import whatsapp_service
from config import Config

settings_bp = Blueprint("settings", __name__)

_ALLOWED_KEYS = frozenset({
    "email_enabled",
    "whatsapp_enabled",
    "notify_late_arrivals",
    "notify_non_arrivals",
    "notify_non_departures",
    "notify_parent_drop",
    "notify_self_transport",
    "notify_school_bus",
})

_DEFAULTS = {
    "email_enabled":         True,
    "whatsapp_enabled":      True,
    "notify_late_arrivals":  True,
    "notify_non_arrivals":   True,
    "notify_non_departures": True,
    "notify_parent_drop":    True,
    "notify_self_transport": True,
    "notify_school_bus":     False,
}


@settings_bp.get("/settings")
@_admin_required
def get_settings():
    existing = db.get_notification_settings(g.admin_id)
    if not existing:
        return jsonify(_DEFAULTS)
    # Strip DB-internal fields before returning
    return jsonify({k: existing[k] for k in _ALLOWED_KEYS if k in existing})


@settings_bp.post("/settings")
@_admin_required
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


@settings_bp.post("/settings/test-whatsapp")
@_admin_required
def test_whatsapp():
    body  = request.get_json(silent=True) or {}
    phone = (body.get("phone") or "").strip()

    if not phone:
        return jsonify({"error": "Phone number is required"}), 400

    if not Config.D7_API_TOKEN or not Config.D7_WHATSAPP_FROM:
        return jsonify({"error": "WhatsApp is not configured on the server (D7_API_TOKEN / D7_WHATSAPP_FROM missing)"}), 503

    try:
        # Send a real template message (same path as production parent notifications).
        # This will fail if the 'parent_arrival' template isn't approved in D7 yet —
        # that's the expected error until templates are created and Meta-approved.
        from datetime import datetime
        test_time = datetime.now().strftime("%-I:%M %p") if hasattr(datetime, 'now') else "12:00 PM"
        whatsapp_service.send_whatsapp_arrival(phone, "Test Student", test_time)
        return jsonify({"status": "sent", "to": phone})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
