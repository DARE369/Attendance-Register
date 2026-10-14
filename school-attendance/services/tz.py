"""
Timezone utilities — always return Nigeria WAT (UTC+1) time.

WAT is a fixed UTC+1 offset with no DST, so we use datetime.timezone(timedelta(hours=1))
directly. This requires no system tzdata files or pip packages and works on any
Docker slim image.
"""
from datetime import datetime, date, timezone, timedelta

_WAT = timezone(timedelta(hours=1))   # Nigeria WAT = UTC+1, no DST


def now() -> datetime:
    """Return current Nigeria WAT time as a naive datetime (tzinfo stripped for DB storage)."""
    return datetime.now(_WAT).replace(tzinfo=None)


def today() -> date:
    """Return today's date in Nigeria WAT."""
    return datetime.now(_WAT).date()


def today_str() -> str:
    """Return today's date in Nigeria WAT as 'YYYY-MM-DD'."""
    return today().isoformat()
