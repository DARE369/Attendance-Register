"""
Admin profile management and multi-admin creation endpoints.
"""
import logging
import re
from flask import Blueprint, request, jsonify, g

from routes.auth import token_required, require_role
from services import auth_service, supabase_client as db

admin_mgmt_bp = Blueprint("admin_mgmt", __name__)
logger = logging.getLogger("admin_mgmt")

_VALID_ROLES = {"super_admin", "admin", "scanner"}


# ---------------------------------------------------------------------------
# Profile — any authenticated admin can manage their own profile
# ---------------------------------------------------------------------------

@admin_mgmt_bp.get("/profile")
@token_required
def get_profile():
    admin = db.get_admin_by_id(g.admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404
    admin.pop("password_hash", None)
    return jsonify({"admin": admin})


@admin_mgmt_bp.patch("/profile")
@token_required
def update_profile():
    body = request.get_json(silent=True) or {}
    allowed = {"display_name", "email", "phone"}
    updates = {}
    for key in allowed:
        if key in body:
            updates[key] = (body[key] or "").strip() or None

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    if "email" in updates and updates["email"]:
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", updates["email"]):
            return jsonify({"error": "Invalid email address"}), 400

    try:
        result = db.update_admin(g.admin_id, updates)
        result.pop("password_hash", None)
        return jsonify({"admin": result})
    except Exception as exc:
        logger.error("update_profile: %s", exc)
        return jsonify({"error": "Failed to update profile"}), 500


@admin_mgmt_bp.post("/change-password")
@token_required
def change_password():
    body = request.get_json(silent=True) or {}
    current_password = body.get("current_password", "")
    new_password     = body.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400

    admin = db.get_admin_by_id(g.admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404
    if not auth_service.verify_password(current_password, admin["password_hash"]):
        return jsonify({"error": "Current password is incorrect"}), 401

    new_hash = auth_service.hash_password(new_password)
    try:
        db.update_admin(g.admin_id, {"password_hash": new_hash})
        return jsonify({"message": "Password changed successfully"})
    except Exception as exc:
        logger.error("change_password: %s", exc)
        return jsonify({"error": "Failed to change password"}), 500


# ---------------------------------------------------------------------------
# Admin user management — super_admin only
# ---------------------------------------------------------------------------

@admin_mgmt_bp.get("/admins")
@require_role("super_admin")
def list_admins():
    try:
        admins = db.get_all_admins()
        for a in admins:
            a.pop("password_hash", None)
        return jsonify({"admins": admins})
    except Exception as exc:
        logger.error("list_admins: %s", exc)
        return jsonify({"error": "Failed to load admins"}), 500


@admin_mgmt_bp.post("/admins")
@require_role("super_admin")
def create_admin():
    body     = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "")
    email    = (body.get("email") or "").strip()
    role     = (body.get("role") or "admin").strip().lower()

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if role not in _VALID_ROLES:
        return jsonify({"error": f"role must be one of {sorted(_VALID_ROLES)}"}), 400
    if email and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return jsonify({"error": "Invalid email address"}), 400

    if db.get_admin(username):
        return jsonify({"error": f"Username '{username}' is already taken"}), 409

    try:
        admin = auth_service.register_admin(username, password, email=email, role=role)
        admin.pop("password_hash", None)
        return jsonify({"admin": admin, "message": f"Admin '{username}' created with role '{role}'"}), 201
    except Exception as exc:
        logger.error("create_admin: %s", exc)
        return jsonify({"error": "Failed to create admin"}), 500


@admin_mgmt_bp.delete("/admins/<target_id>")
@require_role("super_admin")
def delete_admin(target_id: str):
    if target_id == g.admin_id:
        return jsonify({"error": "You cannot delete your own account"}), 400

    target = db.get_admin_by_id(target_id)
    if not target:
        return jsonify({"error": "Admin not found"}), 404

    try:
        db.update_admin(target_id, {"is_active": False})
        return jsonify({"message": f"Admin '{target['username']}' deactivated"})
    except Exception as exc:
        logger.error("delete_admin: %s", exc)
        return jsonify({"error": "Failed to deactivate admin"}), 500
