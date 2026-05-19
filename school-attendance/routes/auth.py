from functools import wraps
from flask import Blueprint, request, jsonify, g
from config import Config
from services import auth_service

auth_bp = Blueprint("auth", __name__)


# ---------------------------------------------------------------------------
# Token guard middleware (import and use in other blueprints)
# ---------------------------------------------------------------------------

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        payload = auth_service.decode_token(token)
        if payload is None:
            return jsonify({"error": "Token is invalid or expired"}), 401
        g.admin_id = payload["sub"]
        g.username = payload["username"]
        g.role     = payload.get("role", "admin")
        return f(*args, **kwargs)
    return decorated


def require_role(*roles):
    """Decorator: requires the caller to have one of the given roles."""
    def decorator(f):
        @wraps(f)
        @token_required
        def decorated(*args, **kwargs):
            if g.role not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    admin = auth_service.authenticate(username, password)
    if not admin:
        return jsonify({"error": "Invalid credentials"}), 401

    role  = admin.get("role", "admin")
    token = auth_service.generate_token(admin["admin_id"], admin["username"], role=role)
    return jsonify({
        "token": token,
        "admin": {
            "admin_id":    admin["admin_id"],
            "username":    admin["username"],
            "email":       admin.get("email"),
            "display_name": admin.get("display_name"),
            "role":        role,
        },
    })


@auth_bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    secret = body.get("register_secret", "")

    if secret != Config.ADMIN_REGISTER_SECRET:
        return jsonify({"error": "Invalid registration secret"}), 403

    username = body.get("username", "").strip()
    password = body.get("password", "")
    email = body.get("email", "").strip()

    if not username or not password or not email:
        return jsonify({"error": "username, password, and email are required"}), 400

    try:
        admin = auth_service.register_admin(username, password, email)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 409

    return jsonify({"message": "Admin created", "admin_id": admin["admin_id"]}), 201


@auth_bp.get("/me")
@token_required
def me():
    from services import supabase_client as db
    admin = db.get_admin_by_id(g.admin_id) or {}
    return jsonify({
        "admin_id":    g.admin_id,
        "username":    g.username,
        "role":        g.role,
        "display_name": admin.get("display_name"),
        "email":       admin.get("email"),
        "phone":       admin.get("phone"),
    })
