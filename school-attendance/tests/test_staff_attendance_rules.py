from datetime import datetime

import pytest

from services import staff_attendance_rules as rules
from services import supabase_client as db
from services.teacher_attendance_service import process_teacher_scan


def at(hm: str) -> datetime:
    h, m = map(int, hm.split(":"))
    return datetime(2026, 10, 20, h, m, 4)


# ── Check-in timing ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("hm, expected", [
    ("06:45", ("on_time", "On time")),
    ("07:30", ("on_time", "On time")),          # end of window
    ("07:40", ("on_time", "On time")),          # last minute of grace
    ("07:41", ("late", "Late by 1 minute")),
    ("08:10", ("late", "Late by 30 minutes")),
])
def test_check_in_timing(config, hm, expected):
    assert rules.check_in_timing(at(hm), config) == expected


def test_check_in_timing_without_grace(config):
    config["grace_period_minutes"] = None
    assert rules.check_in_timing(at("07:31"), config) == ("late", "Late by 1 minute")


# ── Check-out timing ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("hm, expected", [
    ("13:59", ("early_departure", "Left 1 minute early")),
    ("12:00", ("early_departure", "Left 120 minutes early")),
    ("14:00", ("on_time", "On-time departure")),
    ("15:00", ("on_time", "On-time departure")),
    ("15:01", ("late_checkout", "Checked out 1 minute after window")),
    ("16:30", ("late_checkout", "Checked out 90 minutes after window")),
])
def test_check_out_timing(config, hm, expected):
    assert rules.check_out_timing(at(hm), config) == expected


def test_check_out_window_defaults_to_single_time(config):
    config["check_out_end"] = None
    assert rules.check_out_timing(at("14:00"), config)[0] == "on_time"
    assert rules.check_out_timing(at("14:01"), config)[0] == "late_checkout"


# ── Next action ──────────────────────────────────────────────────────────────

def test_next_action():
    assert rules.next_action(None) == "check_in"
    assert rules.next_action({"check_in_time": None}) == "check_in"
    assert rules.next_action({"check_in_time": "x"}) == "check_out"
    assert rules.next_action({"check_in_time": "x", "check_out_time": "y"}) is None


# ── Recording ────────────────────────────────────────────────────────────────

def test_record_check_in_then_out_then_complete(fake_logs, teacher, config):
    first = rules.record(teacher, config, at("07:45"))
    assert first == {"ok": True, "action": "check_in", "status": "late", "comment": "Late by 5 minutes"}
    row = fake_logs.rows[("t-1", "2026-10-20")]
    assert row["check_in_time"] == "2026-10-20T07:45:04"
    assert "check_in_method" not in row   # scanner writes are unchanged

    second = rules.record(teacher, config, at("14:30"))
    assert second == {"ok": True, "action": "check_out", "status": "on_time", "comment": "On-time departure"}
    assert row["check_out_status"] == "on_time"

    assert rules.record(teacher, config, at("15:00")) == {"ok": False, "reason": "already_complete"}


def test_record_prefixes_channel_evidence(fake_logs, teacher, config):
    extra = {"method": "mobile", "verified": False, "reasons": ["weak_signal"]}
    rules.record(teacher, config, at("07:00"), extra)
    row = fake_logs.rows[("t-1", "2026-10-20")]
    assert row["check_in_method"] == "mobile"
    assert row["check_in_verified"] is False
    assert row["check_in_reasons"] == ["weak_signal"]

    rules.record(teacher, config, at("14:10"), extra)
    assert row["check_out_method"] == "mobile"


def test_concurrent_check_in_keeps_first(fake_logs, teacher, config):
    fake_logs.race_row = {"log_id": "gate", "check_in_time": "2026-10-20T07:00:00"}
    assert rules.record(teacher, config, at("07:00")) == {"ok": False, "reason": "already_checked_in"}
    assert fake_logs.rows[("t-1", "2026-10-20")]["log_id"] == "gate"


def test_concurrent_check_out_keeps_first(fake_logs, teacher, config, monkeypatch):
    rules.record(teacher, config, at("07:00"))
    monkeypatch.setattr(db, "update_teacher_log_if_open", lambda log_id, data: None)
    assert rules.record(teacher, config, at("14:10")) == {"ok": False, "reason": "already_complete"}


def test_db_error_on_check_in(fake_logs, teacher, config):
    fake_logs.fail_insert = RuntimeError("Supabase 500")
    result = rules.record(teacher, config, at("07:00"))
    assert result["ok"] is False and result["reason"] == "db_error"


# ── Scanner adapter keeps its response shape ─────────────────────────────────

def test_scanner_response_shape(fake_logs, teacher, config, monkeypatch):
    monkeypatch.setattr(db, "get_staff_type", lambda st: config)

    res = process_teacher_scan("TCH001", at("07:12"), teacher=teacher)
    assert res == {
        "status": "success",
        "action": "check_in",
        "student_name": "Ada Obi",
        "teacher_id": "t-1",
        "staff_type": "teaching",
        "comments": "on_time",
        "timestamp": "2026-10-20T07:12:04",
        "record_type": "teacher",
        "message": "Ada Obi checked in at 07:12 (On time)",
    }

    res = process_teacher_scan("TCH001", at("13:30"), teacher=teacher)
    assert res["action"] == "check_out"
    assert res["comments"] == "early_departure"
    assert res["message"] == "Ada Obi checked out at 13:30 (Left 30 minutes early)"

    res = process_teacher_scan("TCH001", at("15:30"), teacher=teacher)
    assert res == {
        "status": "error",
        "error": "Already completed for today",
        "message": "Ada Obi has already checked in and out today.",
    }


def test_scanner_db_error_message(fake_logs, teacher, config, monkeypatch):
    monkeypatch.setattr(db, "get_staff_type", lambda st: config)
    fake_logs.fail_insert = RuntimeError("Supabase 500")
    res = process_teacher_scan("TCH001", at("07:12"), teacher=teacher)
    assert res["status"] == "error" and res["message"] == "Database error. Try again."
