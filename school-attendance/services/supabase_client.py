from datetime import datetime
from time import sleep
from typing import Optional
from urllib.parse import quote

import requests

from config import Config


def _base_url() -> str:
    if not Config.SUPABASE_URL or not Config.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    return f"{Config.SUPABASE_URL.rstrip('/')}/rest/v1"


def _headers(single: bool = False) -> dict:
    api_key = Config.SUPABASE_SERVICE_ROLE_KEY
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates",
    }
    if single:
        headers["Accept"] = "application/vnd.pgrst.object+json"
    return headers


def _request(method: str, table: str, *, params: dict | None = None, json: object | None = None, single: bool = False):
    response = None
    for attempt in range(3):
        try:
            response = requests.request(
                method,
                f"{_base_url()}/{table}",
                headers=_headers(single=single),
                params=params,
                json=json,
                timeout=30,
            )
            break
        except requests.RequestException:
            if attempt == 2:
                raise
            sleep(1 + attempt)

    if single and response.status_code == 406:
        return None
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        detail = response.text.strip()
        if method.upper() in {"POST", "PATCH", "DELETE"} and response.status_code in {401, 403}:
            raise RuntimeError(
                "Supabase rejected this write. Set SUPABASE_SERVICE_ROLE_KEY in the server .env "
                "or add the required insert/update RLS policy for this table."
            ) from exc
        message = f"Supabase {response.status_code}"
        if detail:
            message = f"{message}: {detail}"
        raise RuntimeError(message) from exc
    if response.status_code == 204 or not response.content:
        return None
    return response.json()


def _eq(value: str) -> str:
    return f"eq.{quote(str(value), safe='')}"


def _in(values: list) -> str:
    return f"in.({','.join(quote(str(v), safe='') for v in values)})"


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

def get_student(student_id: str) -> Optional[dict]:
    return _request(
        "GET",
        "students",
        params={"select": "*", "student_id": _eq(student_id)},
        single=True,
    )


def insert_student(student: dict) -> dict:
    data = _request("POST", "students", json=student)
    return data[0]


def upsert_student(student: dict) -> dict:
    data = _request(
        "POST",
        "students",
        params={"on_conflict": "student_id"},
        json=student,
    )
    return data[0]


def get_all_students() -> list[dict]:
    return _request("GET", "students", params={"select": "*", "order": "student_id.asc"})


def get_students_by_ids(student_ids: list[str]) -> list[dict]:
    """Return only the student_id column for the given IDs (used for duplicate checking)."""
    if not student_ids:
        return []
    return _request("GET", "students", params={
        "select":     "student_id",
        "student_id": _in(student_ids),
    }) or []


def batch_upsert_students(students: list[dict]) -> list[dict]:
    """Insert multiple students in a single call; existing IDs are skipped via on_conflict."""
    data = _request(
        "POST",
        "students",
        params={"on_conflict": "student_id"},
        json=students,
    )
    return data or []


# ---------------------------------------------------------------------------
# Attendance logs
# ---------------------------------------------------------------------------

def insert_attendance_log(
    student_id: str,
    log_type: str,
    timestamp: datetime,
    comments: Optional[str] = None,
    entry_point: Optional[str] = None,
) -> dict:
    payload = {
        "student_id": student_id,
        "log_type": log_type,
        "scan_timestamp": timestamp.isoformat(),
        "comments": comments,
        "entry_point": entry_point,
    }
    data = _request("POST", "attendance_logs", json=payload)
    return data[0]


def get_attendance_logs(
    date: Optional[str] = None,
    student_id: Optional[str] = None,
) -> list[dict]:
    params = [("select", "*,students(full_name,class)"), ("order", "scan_timestamp.desc")]
    if date:
        params.append(("scan_timestamp", f"gte.{date}T00:00:00"))
        params.append(("scan_timestamp", f"lte.{date}T23:59:59"))
    if student_id:
        params.append(("student_id", _eq(student_id)))

    return _request("GET", "attendance_logs", params=params)


def get_attendance_logs_range(start_date: str, end_date: str) -> list[dict]:
    params = [
        ("select", "*"),
        ("order", "scan_timestamp.asc"),
        ("scan_timestamp", f"gte.{start_date}T00:00:00"),
        ("scan_timestamp", f"lte.{end_date}T23:59:59"),
    ]
    return _request("GET", "attendance_logs", params=params)


def get_teacher_logs_range(start_date: str, end_date: str) -> list[dict]:
    params = [
        ("select", "*"),
        ("order", "check_in_time.asc"),
        ("check_in_time", f"gte.{start_date}T00:00:00"),
        ("check_in_time", f"lte.{end_date}T23:59:59"),
    ]
    return _request("GET", "teacher_attendance_logs", params=params)


# ---------------------------------------------------------------------------
# Admins
# ---------------------------------------------------------------------------

def get_admin(username: str) -> Optional[dict]:
    return _request(
        "GET",
        "admins",
        params={"select": "*", "username": _eq(username)},
        single=True,
    )


def insert_admin(admin: dict) -> dict:
    data = _request("POST", "admins", json=admin)
    return data[0]


def upsert_admin(admin: dict) -> dict:
    data = _request(
        "POST",
        "admins",
        params={"on_conflict": "username"},
        json=admin,
    )
    return data[0]


# ---------------------------------------------------------------------------
# Notification settings
# ---------------------------------------------------------------------------

def get_notification_settings(admin_id: str) -> Optional[dict]:
    return _request(
        "GET",
        "notification_settings",
        params={"select": "*", "admin_id": _eq(admin_id)},
        single=True,
    )


def update_notification_settings(admin_id: str, settings_dict: dict) -> dict:
    settings_dict["updated_at"] = datetime.utcnow().isoformat()
    existing = get_notification_settings(admin_id)
    if existing:
        data = _request(
            "PATCH",
            "notification_settings",
            params={"admin_id": _eq(admin_id)},
            json=settings_dict,
        )
    else:
        settings_dict["admin_id"] = admin_id
        data = _request("POST", "notification_settings", json=settings_dict)
    return data[0]


def get_all_admin_settings() -> list[dict]:
    """Returns all notification_settings rows joined with admin email/username."""
    return _request(
        "GET",
        "notification_settings",
        params={"select": "*,admins(email,username)"},
    ) or []


# ---------------------------------------------------------------------------
# Message templates
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Student management (update / delete — insert already exists above)
# ---------------------------------------------------------------------------

def update_student(student_id: str, data: dict) -> dict:
    data.pop("student_id", None)  # primary key is immutable
    result = _request("PATCH", "students", params={"student_id": _eq(student_id)}, json=data)
    return result[0] if result else {}


def delete_student(student_id: str) -> None:
    _request("DELETE", "students", params={"student_id": _eq(student_id)})


# ---------------------------------------------------------------------------
# Teachers
# ---------------------------------------------------------------------------

def get_all_teachers() -> list[dict]:
    return _request("GET", "teachers", params={"select": "*", "order": "full_name.asc"}) or []


def get_teacher_by_barcode(barcode_id: str) -> Optional[dict]:
    return _request(
        "GET", "teachers",
        params={"select": "*", "barcode_id": _eq(barcode_id), "is_active": "eq.true"},
        single=True,
    )


def get_teachers_by_barcodes(barcode_ids: list) -> list:
    if not barcode_ids:
        return []
    return _request("GET", "teachers", params={
        "select":     "barcode_id",
        "barcode_id": _in(barcode_ids),
    }) or []


def batch_upsert_teachers(teachers: list[dict]) -> list[dict]:
    """Insert multiple teachers in a single call; existing barcodes are skipped via on_conflict."""
    data = _request(
        "POST",
        "teachers",
        params={"on_conflict": "barcode_id"},
        json=teachers,
    )
    return data or []


def insert_teacher(data: dict) -> dict:
    result = _request("POST", "teachers", json=data)
    return result[0]


def update_teacher(teacher_id: str, data: dict) -> dict:
    result = _request("PATCH", "teachers", params={"teacher_id": _eq(teacher_id)}, json=data)
    return result[0] if result else {}


def delete_teacher(teacher_id: str) -> None:
    _request("DELETE", "teachers", params={"teacher_id": _eq(teacher_id)})


# ---------------------------------------------------------------------------
# Teacher attendance logs
# ---------------------------------------------------------------------------

def get_teacher_log_by_date(teacher_id: str, date_str: str) -> Optional[dict]:
    return _request(
        "GET", "teacher_attendance_logs",
        params={"select": "*", "teacher_id": _eq(teacher_id), "scan_date": _eq(date_str)},
        single=True,
    )


def insert_teacher_log(data: dict) -> dict:
    result = _request("POST", "teacher_attendance_logs", json=data)
    return result[0]


def update_teacher_log(log_id: str, data: dict) -> dict:
    from datetime import datetime
    data["updated_at"] = datetime.utcnow().isoformat()
    result = _request("PATCH", "teacher_attendance_logs", params={"log_id": _eq(log_id)}, json=data)
    return result[0] if result else {}


def get_teacher_logs(date: Optional[str] = None, teacher_id: Optional[str] = None) -> list[dict]:
    params = [
        ("select", "*,teachers(full_name,staff_type)"),
        ("order", "check_in_time.desc"),
    ]
    if date:
        params.append(("scan_date", _eq(date)))
    if teacher_id:
        params.append(("teacher_id", _eq(teacher_id)))
    return _request("GET", "teacher_attendance_logs", params=params) or []


# ---------------------------------------------------------------------------
# Staff type configuration
# ---------------------------------------------------------------------------

def get_all_staff_types() -> list[dict]:
    return _request("GET", "staff_type_config", params={"select": "*", "order": "staff_type.asc"}) or []


def get_staff_type(staff_type: str) -> Optional[dict]:
    return _request(
        "GET", "staff_type_config",
        params={"select": "*", "staff_type": _eq(staff_type), "is_active": "eq.true"},
        single=True,
    )


def insert_staff_type(data: dict) -> dict:
    result = _request("POST", "staff_type_config", json=data)
    return result[0]


def update_staff_type(config_id: str, data: dict) -> dict:
    from datetime import datetime
    data["updated_at"] = datetime.utcnow().isoformat()
    result = _request("PATCH", "staff_type_config", params={"config_id": _eq(config_id)}, json=data)
    return result[0] if result else {}


def delete_staff_type(config_id: str) -> None:
    _request("DELETE", "staff_type_config", params={"config_id": _eq(config_id)})


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

def insert_audit_log(data: dict) -> None:
    try:
        _request("POST", "audit_logs", json=data)
    except Exception:
        pass  # audit failures must never crash the caller


def get_audit_logs(limit: int = 50, offset: int = 0) -> list[dict]:
    params = [
        ("select", "*"),
        ("order", "timestamp.desc"),
        ("limit", str(limit)),
        ("offset", str(offset)),
    ]
    return _request("GET", "audit_logs", params=params) or []


# ---------------------------------------------------------------------------
# Message templates
# ---------------------------------------------------------------------------

def get_all_templates() -> list[dict]:
    return _request("GET", "message_templates", params={"select": "*", "order": "template_key.asc"}) or []


def upsert_template(template_key: str, data: dict) -> dict:
    from datetime import datetime
    data["template_key"] = template_key
    data["updated_at"]   = datetime.utcnow().isoformat()
    result = _request(
        "POST",
        "message_templates",
        params={"on_conflict": "template_key"},
        json=data,
    )
    return result[0]


# ---------------------------------------------------------------------------
# Holidays
# ---------------------------------------------------------------------------

def get_holidays(active_only: bool = False) -> list[dict]:
    params = [("select", "*"), ("order", "holiday_date.asc")]
    if active_only:
        params.append(("is_active", "eq.true"))
    return _request("GET", "holidays", params=params) or []


def get_holiday_by_date(date_str: str) -> Optional[dict]:
    return _request(
        "GET", "holidays",
        params={"select": "*", "holiday_date": _eq(date_str), "is_active": "eq.true"},
        single=True,
    )


def insert_holiday(data: dict) -> dict:
    result = _request("POST", "holidays", json=data)
    return result[0]


def update_holiday(holiday_id: str, data: dict) -> dict:
    data["updated_at"] = datetime.utcnow().isoformat()
    result = _request("PATCH", "holidays", params={"holiday_id": _eq(holiday_id)}, json=data)
    return result[0] if result else {}


def delete_holiday(holiday_id: str) -> None:
    _request("DELETE", "holidays", params={"holiday_id": _eq(holiday_id)})


# ---------------------------------------------------------------------------
# Fraud alerts
# ---------------------------------------------------------------------------

def get_fraud_alerts(resolved: Optional[bool] = None, limit: int = 100) -> list[dict]:
    params = [
        ("select", "*"),
        ("order", "created_at.desc"),
        ("limit",  str(limit)),
    ]
    if resolved is not None:
        params.append(("is_resolved", "eq.true" if resolved else "eq.false"))
    return _request("GET", "fraud_alerts", params=params) or []


def insert_fraud_alert(data: dict) -> dict:
    result = _request("POST", "fraud_alerts", json=data)
    return result[0]


def update_fraud_alert(alert_id: str, data: dict) -> dict:
    data["updated_at"] = datetime.utcnow().isoformat()
    result = _request("PATCH", "fraud_alerts", params={"alert_id": _eq(alert_id)}, json=data)
    return result[0] if result else {}
