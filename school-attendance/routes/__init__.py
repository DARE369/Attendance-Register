from routes.auth import auth_bp
from routes.scan import scan_bp
from routes.admin import admin_bp
from routes.settings import settings_bp
from routes.import_csv import import_bp
from routes.templates import templates_bp
from routes.management import management_bp
from routes.holidays import holidays_bp
from routes.fraud_alerts import fraud_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp,       url_prefix="/auth")
    app.register_blueprint(scan_bp,       url_prefix="/api")
    app.register_blueprint(admin_bp,      url_prefix="/api/admin")
    app.register_blueprint(settings_bp,   url_prefix="/api/admin")
    app.register_blueprint(import_bp,     url_prefix="/api/admin")
    app.register_blueprint(templates_bp,  url_prefix="/api/admin")
    app.register_blueprint(management_bp, url_prefix="/api/admin")
    app.register_blueprint(holidays_bp,   url_prefix="/api/admin")
    app.register_blueprint(fraud_bp,      url_prefix="/api/admin")
