import logging

from flask import Blueprint, request, jsonify

from routes.auth import token_required
from services import supabase_client as db

templates_bp = Blueprint("templates", __name__)
logger       = logging.getLogger("notification")

_ALLOWED_FIELDS = {"subject", "body", "updated_at"}


@templates_bp.get("/templates")
@token_required
def get_templates():
    """Return all message templates as a dict keyed by template_key."""
    rows = db.get_all_templates()
    return jsonify({r["template_key"]: r for r in rows})


@templates_bp.post("/templates/<key>")
@token_required
def update_template(key: str):
    """
    Upsert a single template.
    Body: { "subject": "...", "body": "..." }
    """
    body = request.get_json(silent=True) or {}
    updates = {k: v for k, v in body.items() if k in _ALLOWED_FIELDS and v is not None}

    if "body" not in updates:
        return jsonify({"error": "Template body is required"}), 400

    result = db.upsert_template(key, updates)
    logger.info("[TEMPLATE] Updated template: %s", key)
    return jsonify({"message": "Template saved", "template": result})
