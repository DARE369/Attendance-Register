import logging

from flask import Blueprint, request, jsonify

from routes.auth import token_required
from services import csv_service

import_bp = Blueprint("import_csv", __name__)
logger   = logging.getLogger("import")


@import_bp.post("/import-csv")
@token_required
def import_csv():
    """
    Multipart POST — fields:
        file  : CSV file
        class : class name string (e.g. "Year 10A")
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file       = request.files["file"]
    class_name = (request.form.get("class") or "").strip()

    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are accepted (.csv)"}), 400

    file_bytes = file.read()

    try:
        rows = csv_service.parse_csv_file(file_bytes)
    except ValueError as exc:
        logger.warning("[IMPORT] Parse error (%s): %s", file.filename, exc)
        return jsonify({"error": str(exc)}), 400

    if not rows:
        return jsonify({"error": "CSV has no data rows"}), 400

    result = csv_service.batch_insert_students(rows, class_name)

    logger.info(
        "[IMPORT] class=%s total=%d inserted=%d skipped=%d errors=%d",
        class_name, result["total"], result["inserted"], result["skipped"], result["errors"],
    )
    return jsonify(result)
