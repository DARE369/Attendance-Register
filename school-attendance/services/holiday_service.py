"""
Holiday and school-day checks.
All functions are synchronous — call from any thread safely.
"""
import logging
from datetime import datetime

from services import supabase_client as db

logger = logging.getLogger("holiday")


def is_weekend(date_str: str | None = None) -> bool:
    """Return True if the date falls on Saturday or Sunday."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    return datetime.strptime(date_str, "%Y-%m-%d").weekday() >= 5  # 5=Sat, 6=Sun


def is_holiday(date_str: str | None = None) -> bool:
    """Return True if an active holiday record exists for this date."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    try:
        row = db.get_holiday_by_date(date_str)
        return row is not None
    except Exception as exc:
        logger.warning("Holiday check failed (%s) — treating as school day", exc)
        return False


def is_school_day(date_str: str | None = None) -> bool:
    """Return True when attendance should be recorded (weekday and not a holiday)."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    return not is_weekend(date_str) and not is_holiday(date_str)
