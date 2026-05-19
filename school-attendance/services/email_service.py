"""
Email notifications via Gmail SMTP.

Setup:
  1. Enable 2-Step Verification on the Gmail account.
  2. Go to Google Account → Security → App Passwords → generate one.
  3. Set SMTP_EMAIL and SMTP_PASSWORD (App Password) in .env.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from config import Config

logger = logging.getLogger("email")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_configured() -> bool:
    return bool(Config.SMTP_EMAIL and Config.SMTP_PASSWORD)


def _html_wrap(body_html: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:24px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
              📚 {Config.SCHOOL_NAME}
            </h1>
            <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">
              Attendance Notification
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;">{body_html}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;
                     text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              This is an automated message from {Config.SCHOOL_NAME} Attendance System.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send(to: str, subject: str, html: str) -> None:
    if not _is_configured():
        logger.warning("[EMAIL] SMTP not configured — skipping email to %s", to)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{Config.SCHOOL_NAME} <{Config.SMTP_EMAIL}>"
    msg["To"]      = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(Config.SMTP_SERVER, Config.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(Config.SMTP_EMAIL, Config.SMTP_PASSWORD)
        server.sendmail(Config.SMTP_EMAIL, to, msg.as_string())

    logger.info("[EMAIL] Sent '%s' → %s", subject, to)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_parent_arrival_notification(
    parent_email: str,
    student_name: str,
    arrival_time: str,
    comment: Optional[str] = None,
) -> None:
    comment_note = ""
    if comment == "early":
        comment_note = '<p style="color:#059669;font-size:13px;margin:4px 0 0;">Great news — they arrived early! 🌟</p>'
    elif comment == "late":
        comment_note = '<p style="color:#d97706;font-size:13px;margin:4px 0 0;">Note: this was a late arrival.</p>'

    body = f"""
    <p style="font-size:16px;color:#374151;">Dear Parent/Guardian,</p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;
                padding:18px;margin:20px 0;">
      <p style="margin:0;font-size:16px;color:#166534;">
        ✅ <strong>{student_name}</strong> has <strong>arrived</strong> at school
        today at <strong>{arrival_time}</strong>.
      </p>
      {comment_note}
    </div>
    <p style="font-size:14px;color:#6b7280;">
      Your child is safe at school. Have a great day!
    </p>"""

    try:
        _send(
            parent_email,
            f"✅ {student_name} has arrived at school",
            _html_wrap(body),
        )
    except Exception as exc:
        logger.error("[EMAIL] Arrival notification failed for %s: %s", parent_email, exc)


def send_parent_departure_notification(
    parent_email: str,
    student_name: str,
    departure_time: str,
) -> None:
    body = f"""
    <p style="font-size:16px;color:#374151;">Dear Parent/Guardian,</p>
    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;
                padding:18px;margin:20px 0;">
      <p style="margin:0;font-size:16px;color:#1e40af;">
        🚶 <strong>{student_name}</strong> has <strong>left school</strong>
        today at <strong>{departure_time}</strong>.
      </p>
    </div>
    <p style="font-size:14px;color:#6b7280;">
      Please ensure someone is available to receive them.
    </p>"""

    try:
        _send(
            parent_email,
            f"🚶 {student_name} has left school",
            _html_wrap(body),
        )
    except Exception as exc:
        logger.error("[EMAIL] Departure notification failed for %s: %s", parent_email, exc)


def send_templated_email(to: str, subject: str, body_text: str) -> None:
    """Send email whose body comes from a custom template (plain text → HTML)."""
    safe = body_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    html = (
        '<div style="font-size:15px;color:#374151;line-height:1.7;">'
        + safe.replace("\n", "<br>")
        + "</div>"
    )
    try:
        _send(to, subject, _html_wrap(html))
    except Exception as exc:
        logger.error("[EMAIL] Templated email failed for %s: %s", to, exc)


def send_admin_notification(
    admin_email: str,
    notification_type: str,
    details: dict,
) -> None:
    type_config = {
        "late_arrival": {
            "emoji":   "⏰",
            "color":   "#d97706",
            "bg":      "#fffbeb",
            "border":  "#fcd34d",
            "subject": f"⏰ Late Arrival: {details.get('student_name', 'Student')}",
            "label":   "LATE ARRIVAL",
        },
        "non_arrival": {
            "emoji":   "⚠️",
            "color":   "#dc2626",
            "bg":      "#fef2f2",
            "border":  "#fca5a5",
            "subject": f"⚠️ Non-Arrival: {details.get('student_name', 'Student')}",
            "label":   "STUDENT NOT ARRIVED",
        },
        "non_departure": {
            "emoji":   "🔔",
            "color":   "#7c3aed",
            "bg":      "#f5f3ff",
            "border":  "#c4b5fd",
            "subject": f"🔔 Still at School: {details.get('student_name', 'Student')}",
            "label":   "STUDENT NOT DEPARTED",
        },
    }

    cfg = type_config.get(notification_type, type_config["late_arrival"])
    body = f"""
    <p style="font-size:16px;color:#374151;">Hello Admin,</p>
    <div style="background:{cfg['bg']};border:1px solid {cfg['border']};
                border-radius:8px;padding:18px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;
                color:{cfg['color']};letter-spacing:.05em;">{cfg['emoji']} {cfg['label']}</p>
      <p style="margin:0;font-size:16px;color:#1f2937;">
        <strong>{details.get('student_name')}</strong>
        &nbsp;·&nbsp; {details.get('class', '')}
      </p>
      <p style="margin:8px 0 0;font-size:14px;color:#4b5563;">
        {details.get('message', '')}
      </p>
    </div>
    <p style="font-size:13px;color:#9ca3af;">
      Time: {details.get('time', '—')}
    </p>"""

    try:
        _send(admin_email, cfg["subject"], _html_wrap(body))
    except Exception as exc:
        logger.error("[EMAIL] Admin notification (%s) failed for %s: %s",
                     notification_type, admin_email, exc)
