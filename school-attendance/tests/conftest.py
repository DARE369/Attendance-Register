import os
import sys

import pytest

# Make `services`, `routes`, `config` importable when pytest runs from school-attendance/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class FakeTeacherLogs:
    """In-memory stand-in for the teacher_attendance_logs helpers in supabase_client."""

    def __init__(self):
        self.rows = {}              # (teacher_id, scan_date) -> row
        self.fail_insert = None     # exception to raise on insert
        self.race_row = None        # row "another channel" writes just before our insert

    def get_teacher_log_by_date(self, teacher_id, date_str):
        return self.rows.get((teacher_id, date_str))

    def insert_teacher_log(self, data):
        if self.race_row is not None:
            self.rows[(data["teacher_id"], data["scan_date"])] = self.race_row
            raise RuntimeError("Supabase 409: duplicate key value violates unique constraint")
        if self.fail_insert:
            raise self.fail_insert
        key = (data["teacher_id"], data["scan_date"])
        if key in self.rows:
            raise RuntimeError("Supabase 409: duplicate key value violates unique constraint")
        row = {"log_id": f"log-{len(self.rows) + 1}", **data}
        self.rows[key] = row
        return row

    def update_teacher_log_if_open(self, log_id, data):
        for row in self.rows.values():
            if row["log_id"] == log_id:
                if row.get("check_out_time"):
                    return None
                row.update(data)
                return row
        return None


@pytest.fixture
def fake_logs(monkeypatch):
    from services import supabase_client as db
    fake = FakeTeacherLogs()
    for name in ("get_teacher_log_by_date", "insert_teacher_log", "update_teacher_log_if_open"):
        monkeypatch.setattr(db, name, getattr(fake, name))
    return fake


@pytest.fixture
def teacher():
    return {"teacher_id": "t-1", "full_name": "Ada Obi", "staff_type": "teaching", "barcode_id": "TCH001"}


@pytest.fixture
def config():
    # check-in ends 07:30 with 10 min grace; check-out window 14:00–15:00
    return {
        "staff_type": "teaching",
        "check_in_end": "07:30:00",
        "grace_period_minutes": 10,
        "check_out_time": "14:00:00",
        "check_out_end": "15:00:00",
    }
