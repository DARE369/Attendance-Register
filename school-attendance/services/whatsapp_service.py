"""
WhatsApp notifications via D7 Networks WhatsApp API.

Setup checklist:
  1. Log in at https://app.d7networks.com
  2. Channels → WhatsApp → register / verify your business number.
  3. Developer → API Tokens → copy your token.
  4. WhatsApp → Templates → create the three templates below and submit for Meta approval.
  5. Set Fly.io secrets:
       flyctl secrets set D7_API_TOKEN="..." D7_WHATSAPP_FROM="+234..." -a peculiar-register

Required D7 template IDs (create these in the D7 dashboard):
  parent_arrival      — body: "Hi! Your child {{1}} has arrived at {{2}} at {{3}}. They are safe!"
  parent_departure    — body: "Hi! Your child {{1}} has left {{2}} at {{3}}. Please be ready!"
  admin_late_arrival  — body: "LATE ARRIVAL: {{1}} ({{2}}) arrived at {{3}}."
"""
import logging
from typing import Optional

import requests

from config import Config

logger = logging.getLogger("whatsapp")

_D7_URL = "https://api.d7networks.com/whatsapp/v2/send"

_TMPL_PARENT_ARRIVAL   = "parent_arrival"
_TMPL_PARENT_DEPARTURE = "parent_departure"
_TMPL_ADMIN_LATE       = "admin_late_arrival"


def _is_configured() -> bool:
    return bool(Config.D7_API_TOKEN and Config.D7_WHATSAPP_FROM)


def _normalize_phone(phone: str) -> str:
    phone = phone.strip()
    if phone.startswith("whatsapp:"):
        phone = phone[len("whatsapp:"):]
    if phone and not phone.startswith("+"):
        phone = f"+{phone}"
    return phone


def _send_template(to_phone: str, template_id: str, params: dict, language: str = "en") -> None:
    """Send a pre-approved D7/Meta template message."""
    if not _is_configured():
        logger.warning("[WA] D7 not configured — skipping WhatsApp to %s", to_phone)
        return

    phone = _normalize_phone(to_phone)
    if not phone:
        logger.warning("[WA] Empty phone number — skipping")
        return

    payload = {
        "messages": [
            {
                "originator": Config.D7_WHATSAPP_FROM,
                "recipients": [{"recipient": phone}],
                "content": {
                    "message_type": "TEMPLATE",
                    "template": {
                        "template_id": template_id,
                        "language": language,
                        "body_parameter_values": params,
                    },
                },
            }
        ]
    }
    _post(payload, phone)


def _send_text(to_phone: str, message: str) -> None:
    """Send a free-form text message.
    NOTE: only works within a 24-hour conversation window — use templates for production."""
    if not _is_configured():
        logger.warning("[WA] D7 not configured — skipping WhatsApp to %s", to_phone)
        return

    phone = _normalize_phone(to_phone)
    if not phone:
        return

    payload = {
        "messages": [
            {
                "originator": Config.D7_WHATSAPP_FROM,
                "recipients": [{"recipient": phone}],
                "content": {
                    "message_type": "TEXT",
                    "text": {"body": message},
                },
            }
        ]
    }
    _post(payload, phone)


def _post(payload: dict, phone: str) -> None:
    headers = {
        "Authorization": f"Bearer {Config.D7_API_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        resp = requests.post(_D7_URL, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        request_id = resp.json().get("request_id", "—")
        logger.info("[WA] Sent to %s (request_id: %s)", phone, request_id)
    except requests.HTTPError as exc:
        body = exc.response.text if exc.response else ""
        logger.error("[WA] HTTP %s to %s: %s",
                     exc.response.status_code if exc.response else "?", phone, body)
    except Exception as exc:
        logger.error("[WA] Send failed to %s: %s", phone, exc)


# ---------------------------------------------------------------------------
# Public API — called by notification_service
# ---------------------------------------------------------------------------

def send_whatsapp_arrival(
    parent_phone: str,
    student_name: str,
    arrival_time: str,
    comment: Optional[str] = None,
) -> None:
    # template body: "Hi! Your child {{1}} has arrived at {{2}} at {{3}}. They are safe!"
    _send_template(
        parent_phone,
        _TMPL_PARENT_ARRIVAL,
        {"0": student_name, "1": Config.SCHOOL_NAME, "2": arrival_time},
    )


def send_whatsapp_departure(
    parent_phone: str,
    student_name: str,
    departure_time: str,
) -> None:
    # template body: "Hi! Your child {{1}} has left {{2}} at {{3}}. Please be ready!"
    _send_template(
        parent_phone,
        _TMPL_PARENT_DEPARTURE,
        {"0": student_name, "1": Config.SCHOOL_NAME, "2": departure_time},
    )


def send_templated_whatsapp(to_phone: str, body_text: str) -> None:
    """Free-form text — used for teacher notifications and test messages."""
    _send_text(to_phone, body_text)


def send_whatsapp_admin_alert(
    admin_phone: str,
    alert_type: str,
    details: dict,
) -> None:
    if alert_type == "late_arrival":
        # template body: "LATE ARRIVAL: {{1}} ({{2}}) arrived at {{3}}."
        _send_template(
            admin_phone,
            _TMPL_ADMIN_LATE,
            {
                "0": details.get("student_name", ""),
                "1": details.get("class", ""),
                "2": details.get("time", "—"),
            },
        )
    else:
        messages = {
            "non_arrival": (
                "NON-ARRIVAL ALERT\n"
                "Student: {student_name} ({class}) has NOT arrived by {time}.\n- {school}"
            ),
            "non_departure": (
                "STUDENT STILL ON PREMISES\n"
                "Student: {student_name} ({class}) has NOT left by {time}.\n- {school}"
            ),
        }
        msg = messages.get(alert_type, "")
        if msg:
            _send_text(admin_phone, msg.format(school=Config.SCHOOL_NAME, **details))
