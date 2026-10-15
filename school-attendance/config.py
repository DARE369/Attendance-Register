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

    # Seconds a request waits for its background work (notifications, audit
    # writes) before replying. Set to 5 on Google Cloud Run, where CPU is
    # throttled once a response is sent. 0 = pure fire-and-forget.
    BACKGROUND_WAIT_SECONDS = float(os.getenv("BACKGROUND_WAIT_SECONDS", "0"))
