"""
The staff sign-in helpers' safety depends on the exact PostgREST filters they
send (single use, expiry, strict inserts). These tests pin those requests.
"""
import pytest

from services import supabase_client as db


class Calls(list):
    """Recorded _request calls; .responses are returned (or raised) in order."""


@pytest.fixture
def calls(monkeypatch):
    log = Calls()
    responses = []

    def fake_request(method, table, *, params=None, json=None, single=False, strict_insert=False):
        log.append({"method": method, "table": table, "params": dict(params or {}) if not isinstance(params, list) else params,
                    "json": json, "single": single, "strict_insert": strict_insert})
        if responses:
            r = responses.pop(0)
            if isinstance(r, Exception):
                raise r
            return r
        return None

    monkeypatch.setattr(db, "_request", fake_request)
    log.responses = responses
    return log


def test_strict_insert_header_drops_upsert():
    assert "merge-duplicates" in db._headers()["Prefer"]
    assert db._headers(strict_insert=True)["Prefer"] == "return=representation"


@pytest.mark.parametrize("fn, table, arg", [
    (db.insert_passkey, "staff_passkeys", {"credential_id": "c"}),
    (db.insert_login_code, "staff_login_codes", {"teacher_id": "t"}),
    (db.insert_challenge, "staff_challenges", {"challenge": "x"}),
    (db.insert_survey_point, "campus_survey_points", {"lat": 6.4}),
    (db.insert_correction, "attendance_corrections", {"teacher_id": "t"}),
])
def test_new_table_inserts_never_upsert(calls, fn, table, arg):
    calls.responses.append([arg])
    fn(arg)
    assert calls[0]["table"] == table and calls[0]["strict_insert"] is True


def test_consume_challenge_is_single_use_and_scoped(calls):
    calls.responses.append([])          # nothing matched: used, expired or wrong purpose
    assert db.consume_challenge("abc", "sign_in") is None
    p = calls[0]["params"]
    assert calls[0]["method"] == "PATCH"
    assert p["challenge"] == "eq.abc"
    assert p["purpose"] == "eq.sign_in"
    assert p["used_at"] == "is.null"
    assert p["expires_at"].startswith("gt.")
    assert calls[0]["json"]["used_at"]

    calls.responses.append([{"challenge": "abc", "teacher_id": "t"}])
    assert db.consume_challenge("abc", "sign_in") == {"challenge": "abc", "teacher_id": "t"}


def test_consume_login_code_only_once(calls):
    calls.responses.extend([[{"id": "1"}], []])
    assert db.consume_login_code("1") is True
    assert db.consume_login_code("1") is False
    assert calls[0]["params"]["used_at"] == "is.null"


def test_reminder_dedup_on_conflict(calls):
    calls.responses.extend([None, RuntimeError('Supabase 409: {"code":"23505"}')])
    assert db.mark_reminder_sent("t", "2026-10-20", "check_in") is True
    assert db.mark_reminder_sent("t", "2026-10-20", "check_in") is False
    assert all(c["strict_insert"] for c in calls)


def test_reminder_other_errors_raise(calls):
    calls.responses.append(RuntimeError("Supabase 500"))
    with pytest.raises(RuntimeError):
        db.mark_reminder_sent("t", "2026-10-20", "check_in")


def test_email_lookup_escapes_wildcards_and_requires_exact_match(calls):
    # ilike pre-filter returns a near miss; it must not be accepted.
    calls.responses.append([{"teacher_id": "x", "email": "axb@school.ng"}])
    assert db.get_active_teacher_by_email(" A_B@School.ng ") is None
    assert calls[0]["params"]["email"] == "ilike.a\\_b@school.ng"

    calls.responses.append([{"teacher_id": "y", "email": "A_B@school.ng"}])
    assert db.get_active_teacher_by_email("a_b@school.ng")["teacher_id"] == "y"


def test_email_lookup_ambiguous_returns_none(calls):
    calls.responses.append([{"teacher_id": "1", "email": "a@s.ng"}, {"teacher_id": "2", "email": "A@s.ng"}])
    assert db.get_active_teacher_by_email("a@s.ng") is None
    assert db.get_active_teacher_by_email("") is None


def test_active_zones_uses_latest_version(calls):
    calls.responses.extend([[{"version": 3}], [{"zone_id": "z", "version": 3}]])
    assert db.get_active_zones() == [{"zone_id": "z", "version": 3}]
    assert calls[1]["params"]["version"] == "eq.3"


def test_active_zones_empty_when_none_drawn(calls):
    calls.responses.append([])
    assert db.get_active_zones() == []
    assert len(calls) == 1


def test_correction_decided_once(calls):
    calls.responses.append([])
    assert db.update_correction_if_pending("c1", {"status": "approved"}) is None
    assert calls[0]["params"]["status"] == "eq.pending"
