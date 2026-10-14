import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

# .env lives in the project root (one level above this file)
load_dotenv(find_dotenv(usecwd=False))


class Config:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or SUPABASE_KEY
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRY_HOURS = 8
    # The gate device logs in once in the morning and must last past late departures.
    SCANNER_JWT_EXPIRY_HOURS = 18
    ADMIN_REGISTER_SECRET = os.getenv("ADMIN_REGISTER_SECRET", "")
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"

    # Gmail SMTP — use an App Password, not your normal Gmail password
    SMTP_SERVER   = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
    SMTP_EMAIL    = os.getenv("SMTP_EMAIL", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

    # D7 Networks WhatsApp
    D7_API_TOKEN     = os.getenv("D7_API_TOKEN", "")
    D7_WHATSAPP_FROM = os.getenv("D7_WHATSAPP_FROM", "")  # your registered WhatsApp number e.g. +2348012345678

    SCHOOL_NAME = os.getenv("SCHOOL_NAME", "Peculiar School")

    # Staff mobile sign-in (docs/staff-signin-plan.md)
    # Staff sessions are signed with their own secret so they can never pass as admin tokens.
    STAFF_JWT_SECRET = os.getenv("STAFF_JWT_SECRET", "dev-staff-secret-change-in-production")
    # Passkeys are bound to this domain forever: set it to the final app domain before
    # any staff member enrols (e.g. register.example.sch.ng, no scheme or port).
    WEBAUTHN_RP_ID   = os.getenv("WEBAUTHN_RP_ID", "localhost")
    WEBAUTHN_RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "LPS Staff")
    WEBAUTHN_ORIGIN  = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:5173")  # full origin, with scheme
    # Shared secret for scheduled jobs calling /api/internal/* (sent as X-Cron-Secret).
    CRON_SECRET      = os.getenv("CRON_SECRET", "")
