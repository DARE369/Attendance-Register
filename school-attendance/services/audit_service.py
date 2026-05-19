"""
Audit logging — records all admin actions (add/edit/delete student, teacher, config).
Runs in a daemon thread so it never blocks HTTP responses.
"""
import json
import logging
from datetime import datetime
from typing import Optional

from services import supabase_client as db

logger = logging.getLogger("notification")  # audit entries go to attendance.log


def log_audit(
    admin_id: str,
    action: str,
    table_name: Optional[str] = None,
    record_id: Optional[str] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    description: Optional[str] = None,
) -> None:
    """
    Insert one audit row. Call this in a daemon thread — do NOT await.

    action examples:
      "add_student", "edit_student", "delete_student"
      "add_teacher", "edit_teacher", "delete_teacher"
      "add_staff_type", "edit_staff_type"
    """
    try:
        db.insert_audit_log({
            "admin_id":   str(admin_id) if admin_id else None,
            "action":     action,
            "table_name": table_name,
            "record_id":  str(record_id) if record_id else None,
            "old_value":  old_value,
            "new_value":  new_value,
            "description": description,
            "timestamp":  datetime.utcnow().isoformat(),
        })
        logger.info("[AUDIT] %s — %s", action, description or "")
    except Exception as exc:
        logger.error("[AUDIT] Failed to log '%s': %s", action, exc)
