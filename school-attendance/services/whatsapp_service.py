"""
WhatsApp notifications via Twilio.

Setup:
  1. Sign up at https://www.twilio.com and get Account SID + Auth Token.
  2. Activate the WhatsApp Sandbox: Twilio Console → Messaging → Try it out → WhatsApp.
  3. Have recipients text "join <keyword>" to the sandbox number.
  4. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env.

For production (non-sandbox):
  - Apply for a WhatsApp Business Profile in Twilio Console.
  - Purchase a Twilio number with WhatsApp capability.
"""
import logging
from typing import Optional

from config import Config

logger = logging.getLogger("whatsapp")


def _is_configured() -> bool:
    return bool(Config.TWILIO_ACCOUNT_SID and Config.TWILIO_AUTH_TOKEN)


def _fmt_to(phone: str) -> str:
    """Ensure phone has 'whatsapp:' prefix."""
    phone = phone.strip()
    return phone if phone.startswith("whatsapp:") else f"whatsapp:{phone}"


def _send(to_phone: str, message: str) -> None:
    if not _is_configured():
        logger.warning("[WA] Twilio not configured — skipping WhatsApp to %s", to_phone)
        return

    try:
        from twilio.rest import Client  # lazy import so missing package = warning, not crash
        client = Client(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=message,
            from_=_fmt_to(Config.TWILIO_WHATSAPP_FROM),
            to=_fmt_to(to_phone),
        )
        logger.info("[WA] Sent to %s (SID: %s)", to_phone, msg.sid)
    except ImportError:
        logger.error("[WA] 'twilio' package not installed. Run: pip install twilio==8.10.0")
    except Exception as exc:
        logger.error("[WA] Send failed to %s: %s", to_phone, exc)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_whatsapp_arrival(
    parent_phone: str,
    student_name: str,
    arrival_time: str,
    comment: Optional[str] = None,
) -> None:
    extra = ""
    if comment == "early":
        extra = " They arrived early — great!"
    elif comment == "late":
        extra = " Note: this was a late arrival."

    message = (
        f"Hi! Your child *{student_name}* has arrived at "
        f"{Config.SCHOOL_NAME} at *{arrival_time}*.{extra} "
        f"- {Config.SCHOOL_NAME}"
    )
    _send(parent_phone, message)


def send_whatsapp_departure(
    parent_phone: str,
    student_name: str,
    departure_time: str,
) -> None:
    message = (
        f"Hi! Your child *{student_name}* has left "
        f"{Config.SCHOOL_NAME} at *{departure_time}*. "
        f"Please ensure someone is available to receive them. "
        f"- {Config.SCHOOL_NAME}"
    )
    _send(parent_phone, message)


def send_templated_whatsapp(to_phone: str, body_text: str) -> None:
    """Send WhatsApp using a custom text body from a template."""
    _send(to_phone, body_text)


def send_whatsapp_admin_alert(
    admin_phone: str,
    alert_type: str,
    details: dict,
) -> None:
    templates = {
        "late_arrival": (
            "⏰ LATE ARRIVAL ALERT\n"
            "Student: {student_name} ({class})\n"
            "Arrived at: {time}\n"
            "- {school}"
        ),
        "non_arrival": (
            "⚠️ NON-ARRIVAL ALERT\n"
            "Student: {student_name} ({class}) has NOT arrived by 12:00 PM.\n"
            "- {school}"
        ),
        "non_departure": (
            "🔔 STUDENT STILL ON PREMISES\n"
            "Student: {student_name} ({class}) has NOT left by 6:00 PM.\n"
            "- {school}"
        ),
    }

    template = templates.get(alert_type, templates["late_arrival"])
    message  = template.format(
        school=Config.SCHOOL_NAME,
        time=details.get("time", "—"),
        **details,
    )
    _send(admin_phone, message)
