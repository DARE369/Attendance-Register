"""
Shared staff check-in / check-out rules.

Used by every channel that records staff attendance (the gate scanner today,
the staff mobile app next). Channels differ only in how they identify the
person and what evidence they attach; timing, the one-record-per-day rule and
the database writes live here so the channels can never disagree.

The caller always supplies the time. It must come from the server clock
(services.tz.now()), never from a client.
"""
import logging
from datetime import datetime

from services import supabase_client as db

logger = logging.getLogger("scan")

ACTION_CHECK_IN  = "check_in"
ACTION_CHECK_OUT = "check_out"


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def _parse_hm(time_str: str) -> tuple[int, int]:
    """'07:15:00' or '07:15' → (7, 15)"""
    parts = time_str.split(":")
    return int(parts[0]), int(parts[1])


def _total_minutes(h: int, m: int) -> int:
    return h * 60 + m


def _plural(n: int) -> str:
    return "s" if n != 1 else ""


# ---------------------------------------------------------------------------
# Timing rules (pure)
# ---------------------------------------------------------------------------

def check_in_timing(scan_time: datetime, config: dict) -> tuple[str, str]:
    """
    Compare scan time against (check_in_end + grace_period_minutes).
    Returns (status, comment): ("on_time", ...) or ("late", ...).
    """
    grace   = config.get("grace_period_minutes") or 0
    end_h, end_m = _parse_hm(config["check_in_end"])
    limit   = _total_minutes(end_h, end_m) + grace
    scanned = _total_minutes(scan_time.hour, scan_time.minute)

    if scanned <= limit:
        return "on_time", "On time"
    late = scanned - limit
    return "late", f"Late by {late} minute{_plural(late)}"


def check_out_timing(scan_time: datetime, config: dict) -> tuple[str, str]:
    """
    Compare scan time against the configured check-out window.
    Returns (status, comment): "early_departure" | "on_time" | "late_checkout".
    """
    start_h, start_m = _parse_hm(config["check_out_time"])
    end_h, end_m = _parse_hm(config.get("check_out_end") or config["check_out_time"])
    start = _total_minutes(start_h, start_m)
    end = _total_minutes(end_h, end_m)
    scanned = _total_minutes(scan_time.hour, scan_time.minute)

    if scanned < start:
        early = start - scanned
        return "early_departure", f"Left {early} minute{_plural(early)} early"
    if scanned <= end:
        return "on_time", "On-time departure"
    late = scanned - end
    return "late_checkout", f"Checked out {late} minute{_plural(late)} after window"


def next_action(today_log: dict | None) -> str | None:
    """What the staff member can do next today: check_in, check_out, or None (done)."""
    if not today_log or not today_log.get("check_in_time"):
        return ACTION_CHECK_IN
    if not today_log.get("check_out_time"):
        return ACTION_CHECK_OUT
    return None


# ---------------------------------------------------------------------------
# Recording
# ---------------------------------------------------------------------------

def _evidence_fields(prefix: str, extra: dict | None) -> dict:
    """
    Prefix channel evidence (method, verified, reasons, evidence) with
    check_in_ / check_out_. Empty for the scanner, so its writes are unchanged.
    """
    return {f"{prefix}_{k}": v for k, v in (extra or {}).items()}


def record(teacher: dict, config: dict, now: datetime, extra: dict | None = None) -> dict:
    """
    Record the next check-in or check-out for this teacher at `now`.

    `extra` holds channel evidence keyed without prefix, e.g.
    {"method": "mobile", "verified": False, "reasons": [...], "evidence": {...}}.

    Returns one of:
      {"ok": True,  "action": "check_in"|"check_out", "status": ..., "comment": ...}
      {"ok": False, "reason": "already_checked_in" | "already_complete"}
      {"ok": False, "reason": "db_error", "error": "..."}
    A concurrent write from another channel resolves to already_checked_in or
    already_complete, never to a duplicate or overwritten record.
    """
    scan_date = now.date().isoformat()
    today_log = db.get_teacher_log_by_date(teacher["teacher_id"], scan_date)
    action = next_action(today_log)

    if action == ACTION_CHECK_IN:
        status, comment = check_in_timing(now, config)
        try:
            db.insert_teacher_log({
                "teacher_id":        teacher["teacher_id"],
                "scan_date":         scan_date,
                "check_in_time":     now.isoformat(),
                "check_in_status":   status,
                "check_in_comments": comment,
                **_evidence_fields("check_in", extra),
            })
        except Exception as exc:
            # The (teacher_id, scan_date) unique constraint fires when another
            # channel signed in first. Keep the first record; don't report an error.
            if db.get_teacher_log_by_date(teacher["teacher_id"], scan_date):
                logger.info("[STAFF] concurrent check-in for %s, keeping the first", teacher["teacher_id"])
                return {"ok": False, "reason": "already_checked_in"}
            logger.error("[STAFF] DB error on check-in: %s", exc)
            return {"ok": False, "reason": "db_error", "error": str(exc)}
        return {"ok": True, "action": action, "status": status, "comment": comment}

    if action == ACTION_CHECK_OUT:
        status, comment = check_out_timing(now, config)
        try:
            updated = db.update_teacher_log_if_open(today_log["log_id"], {
                "check_out_time":     now.isoformat(),
                "check_out_status":   status,
                "check_out_comments": comment,
                **_evidence_fields("check_out", extra),
            })
        except Exception as exc:
            logger.error("[STAFF] DB error on check-out: %s", exc)
            return {"ok": False, "reason": "db_error", "error": str(exc)}
        if not updated:
            return {"ok": False, "reason": "already_complete"}
        return {"ok": True, "action": action, "status": status, "comment": comment}

    return {"ok": False, "reason": "already_complete"}
