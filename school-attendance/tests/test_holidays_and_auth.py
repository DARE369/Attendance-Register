from datetime import datetime, timedelta, timezone

import jwt
import pytest

from config import Config
from services import holiday_service as hs
from services import supabase_client as db

MONDAY = "2026-10-19"
SATURDAY = "2026-10-24"


@pytest.fixture
def holidays(monkeypatch):
    """A students-only holiday on MONDAY; no overrides."""
    seen = []

    def get_holiday_by_date(date_str, audience=None):
        seen.append(audience)
        if date_str == MONDAY and audience in (None, "students"):
            return {"holiday_name": "Mid-term (students)", "applies_to": "students"}
        return None

    monkeypatch.setattr(db, "get_holiday_by_date", get_holiday_by_date)
    monkeypatch.setattr(db, "get_scan_override", lambda d: None)
    return seen


def test_students_only_holiday_still_expects_staff(holidays):
    assert hs.get_student_day_status(MONDAY) == hs.STATUS_HOLIDAY
    assert hs.get_staff_day_status(MONDAY) == hs.STATUS_OPEN
    assert hs.is_school_day_for_staff(MONDAY) is True
    assert hs.is_school_day_for_students(MONDAY) is False
    assert holidays == ["students", "staff", "staff", "students"]


def test_no_audience_keeps_old_behaviour(holidays):
    assert hs.get_day_scan_status(MONDAY) == hs.STATUS_HOLIDAY


def test_weekend_closed_for_staff(holidays):
    assert hs.get_staff_day_status(SATURDAY) == hs.STATUS_WEEKEND


def test_override_beats_holiday(monkeypatch):
    monkeypatch.setattr(db, "get_scan_override", lambda d: {"override_type": "allow"})
    monkeypatch.setattr(db, "get_holiday_by_date", lambda d, a=None: {"holiday_name": "x"})
    assert hs.get_staff_day_status(MONDAY) == hs.STATUS_OVERRIDE


# ── Admin endpoints refuse staff tokens; test-scan is closed in production ──

@pytest.fixture
def client():
    from app import create_app
    return create_app().test_client()


def _token(secret, **claims):
    payload = {
        "sub": "x", "username": "u", "role": "super_admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1), **claims,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_admin_endpoint_rejects_staff_typ(client):
    token = _token(Config.JWT_SECRET, typ="staff")
    res = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_admin_endpoint_rejects_staff_secret(client):
    token = _token(Config.STAFF_JWT_SECRET, typ="staff")
    res = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_test_scan_closed_outside_debug(client, monkeypatch):
    monkeypatch.setattr(Config, "DEBUG", False)
    assert client.get("/api/test-scan?barcode=TCH001&time=07:00").status_code == 404


# ── Scan endpoints require login ─────────────────────────────────────────────

@pytest.mark.parametrize("path", ["/api/scan", "/api/scan/confirm"])
def test_scan_requires_login(client, path):
    assert client.post(path, json={"barcode": "TCH001"}).status_code == 401


@pytest.mark.parametrize("path", ["/api/scan", "/api/scan/confirm"])
def test_scan_rejects_staff_session(client, path):
    token = _token(Config.STAFF_JWT_SECRET, typ="staff")
    res = client.post(path, json={"barcode": "TCH001"}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_scanner_role_passes_auth(client):
    # An empty barcode fails validation (400) only after auth succeeds; no DB call.
    token = _token(Config.JWT_SECRET, role="scanner")
    res = client.post("/api/scan", json={"barcode": ""}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400


def test_scanner_token_lasts_the_school_day():
    from services import auth_service
    scanner = jwt.decode(auth_service.generate_token("a", "gate", role="scanner"),
                         Config.JWT_SECRET, algorithms=["HS256"])
    admin = jwt.decode(auth_service.generate_token("b", "boss", role="admin"),
                       Config.JWT_SECRET, algorithms=["HS256"])
    assert scanner["exp"] - scanner["iat"] == 18 * 3600
    assert admin["exp"] - admin["iat"] == 8 * 3600
