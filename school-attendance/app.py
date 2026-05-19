import logging
import os
from flask import Flask
from flask_cors import CORS
from config import Config
from routes import register_blueprints


def _add_file_handler(logger_name: str, filepath: str, fmt: str) -> None:
    handler = logging.FileHandler(filepath, encoding="utf-8")
    handler.setFormatter(logging.Formatter(fmt))
    logging.getLogger(logger_name).addHandler(handler)


def _setup_logging():
    os.makedirs("logs", exist_ok=True)
    fmt = "%(asctime)s [%(levelname)s] %(name)s — %(message)s"

    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("logs/attendance.log", encoding="utf-8"),
        ],
    )

    # Per-channel file handlers
    _add_file_handler("scan",         "logs/scan_logs.txt",         fmt)
    _add_file_handler("notification", "logs/notification_logs.txt", fmt)
    _add_file_handler("import",       "logs/import_logs.txt",       fmt)

    # Error-only catch-all
    error_handler = logging.FileHandler("logs/error_logs.txt", encoding="utf-8")
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(fmt))
    logging.getLogger().addHandler(error_handler)


def create_app():
    _setup_logging()
    app = Flask(__name__)
    app.config.from_object(Config)
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    CORS(app, origins=cors_origins)

    register_blueprints(app)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "school-attendance-api"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=Config.DEBUG, host="0.0.0.0", port=5000)
