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

    # Twilio WhatsApp
    TWILIO_ACCOUNT_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN    = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155552671")

    SCHOOL_NAME = os.getenv("SCHOOL_NAME", "Peculiar School")
