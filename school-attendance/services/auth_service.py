from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from config import Config
from services import supabase_client as db


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def generate_token(admin_id: str, username: str) -> str:
    payload = {
        "sub": admin_id,
        "username": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=Config.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def authenticate(username: str, password: str) -> Optional[dict]:
    admin = db.get_admin(username)
    if not admin:
        return None
    if not verify_password(password, admin["password_hash"]):
        return None
    return admin


def register_admin(username: str, password: str, email: str) -> dict:
    payload = {
        "username": username,
        "password_hash": hash_password(password),
        "email": email,
    }
    return db.insert_admin(payload)
