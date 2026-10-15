import threading
import time

from config import Config
from services import background


def test_waits_for_quick_work(monkeypatch):
    monkeypatch.setattr(Config, "BACKGROUND_WAIT_SECONDS", 2)
    done = []
    background.run(lambda: (time.sleep(0.1), done.append(1)))
    assert done == [1]          # finished before run() returned


def test_does_not_wait_past_the_limit(monkeypatch):
    monkeypatch.setattr(Config, "BACKGROUND_WAIT_SECONDS", 0.2)
    release = threading.Event()
    start = time.monotonic()
    background.run(release.wait)
    assert time.monotonic() - start < 1
    release.set()


def test_fire_and_forget_by_default(monkeypatch):
    monkeypatch.setattr(Config, "BACKGROUND_WAIT_SECONDS", 0)
    release = threading.Event()
    start = time.monotonic()
    background.run(release.wait)
    assert time.monotonic() - start < 0.2
    release.set()


def test_errors_are_logged_not_raised(monkeypatch):
    monkeypatch.setattr(Config, "BACKGROUND_WAIT_SECONDS", 1)
    background.run(lambda: 1 / 0)   # must not raise


def test_management_audit_uses_background(monkeypatch):
    from routes import management
    monkeypatch.setattr(Config, "BACKGROUND_WAIT_SECONDS", 1)
    seen = []
    monkeypatch.setattr(management, "log_audit", lambda *a, **k: seen.append((a, k)))
    management._audit("admin-1", "update", "teachers", record_id="t-1")
    assert seen == [(("admin-1", "update"), {
        "table_name": "teachers", "record_id": "t-1",
        "old_value": None, "new_value": None, "description": None,
    })]
