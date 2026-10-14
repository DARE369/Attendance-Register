"""
Holiday and school-day checks.
All functions are synchronous — call from any thread safely.
"""
import logging
from datetime import datetime

from services import supabase_client as db
from services import tz as _tz

logger = logging.getLogger("holiday")

# Day-of-week status strings returned by get_day_scan_status()
STATUS_OPEN     = "open"      # scanning allowed normally
STATUS_WEEKEND  = "weekend"   # Saturday/Sunday, no override
STATUS_HOLIDAY  = "holiday"   # active holiday in DB, no override
STATUS_BLOCKED  = "blocked"   # admin explicitly blocked this day
STATUS_OVERRIDE = "override"  # admin explicitly opened a normally-closed day


def is_weekend(date_str: str | None = None) -> bool:
    """Return True if the date falls on Saturday or Sunday."""
    if date_str is None:
        date_str = _tz.today_str()
    return datetime.strptime(date_str, "%Y-%m-%d").weekday() >= 5  # 5=Sat, 6=Sun


def is_holiday(date_str: str | None = None) -> bool:
    """Return True if an active holiday record exists for this date."""
    if date_str is None:
        date_str = _tz.today_str()
    try:
        row = db.get_holiday_by_date(date_str)
        return row is not None
    except Exception as exc:
        logger.warning("Holiday check failed (%s) — treating as school day", exc)
        return False


def get_day_scan_status(date_str: str | None = None) -> str:
    """
    Determine whether scanning is permitted for a given date.

    Priority order (highest wins):
      1. Admin override (allow / block) — always beats default rules
      2. Weekend rule
      3. Holiday rule
      4. Normal school day → open

    Returns one of:
        STATUS_OPEN      – proceed with scanning
        STATUS_WEEKEND   – weekend, not overridden
        STATUS_HOLIDAY   – holiday, not overridden
        STATUS_BLOCKED   – admin explicitly closed this day
        STATUS_OVERRIDE  – admin explicitly opened a weekend/holiday
    """
    if date_str is None:
        date_str = _tz.today_str()

    # 1. Check for an explicit admin override
    try:
        override = db.get_scan_override(date_str)
        if override:
            otype = override.get("override_type")
            if otype == "allow":
                return STATUS_OVERRIDE   # open even on weekend/holiday
            if otype == "block":
                return STATUS_BLOCKED    # closed even on a normal school day
    except Exception as exc:
        logger.warning("Scan override check failed (%s) — falling back to default rules", exc)

    # 2. Default rules
    if is_weekend(date_str):
        return STATUS_WEEKEND
    if is_holiday(date_str):
        return STATUS_HOLIDAY
    return STATUS_OPEN


def is_school_day(date_str: str | None = None) -> bool:
    """Return True when attendance should be recorded."""
    status = get_day_scan_status(date_str)
    return status in (STATUS_OPEN, STATUS_OVERRIDE)
