import csv
import io
import re
import uuid
import logging

from services import supabase_client as db

logger = logging.getLogger("import")

_REQUIRED_COLS          = {"student_id", "full_name"}  # class/phone/email are optional per-row
_TEACHER_REQUIRED_COLS  = {"full_name", "staff_type", "barcode_id"}
_PHONE_RE               = re.compile(r"^\+\d{7,15}$")
_EMAIL_RE               = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_STUDENT_ID_RE          = re.compile(r"^[A-Z0-9\-_]{1,20}$")
_BARCODE_RE             = re.compile(r"^[A-Z0-9\-_]{1,30}$")
MAX_FILE_BYTES          = 5 * 1024 * 1024  # 5 MB


def parse_csv_file(file_bytes: bytes) -> list[dict]:
    """Decode CSV bytes and return a list of normalised row dicts."""
    if not file_bytes:
        raise ValueError("File is empty")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError("File too large (max 5 MB)")

    text   = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        raise ValueError("CSV has no headers")

    # Normalise headers: strip whitespace + lowercase
    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    missing = _REQUIRED_COLS - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    rows = []
    for row in reader:
        rows.append({k: (v or "").strip() for k, v in row.items()})

    return rows


def validate_student_row(row: dict) -> tuple[bool, str]:
    """Return (is_valid, error_message)."""
    sid = row.get("student_id", "").upper()
    if not sid:
        return False, "Missing student_id"
    if not _STUDENT_ID_RE.match(sid):
        return False, f"Invalid student_id {sid!r} — use alphanumeric, max 20 chars"

    if not row.get("full_name", "").strip():
        return False, "Missing full_name"

    phone = row.get("parent_phone", "")
    if phone and not _PHONE_RE.match(phone):
        return False, f"Invalid phone {phone!r} — expected +E.164 (e.g. +2348012345678)"

    email = row.get("parent_email", "")
    if email and not _EMAIL_RE.match(email):
        return False, f"Invalid email {email!r}"

    return True, ""


def batch_insert_students(rows: list[dict], class_name: str) -> dict:
    """
    Validate rows, check duplicates in one DB query, batch-insert new students.
    Returns an import report dict.
    """
    total   = len(rows)
    details = []
    errors  = 0

    # ── Phase 1: validate all rows ──────────────────────────────────────────
    valid_students = []
    for row in rows:
        sid   = row.get("student_id", "").strip().upper()
        valid, err_msg = validate_student_row(row)
        if not valid:
            errors += 1
            details.append({"student_id": sid or "(unknown)", "status": "error", "reason": err_msg})
            logger.warning("[IMPORT] Validation error %s: %s", sid or "(unknown)", err_msg)
        else:
            valid_students.append({
                "student_id":   sid,
                "full_name":    row["full_name"].strip(),
                "class":        row.get("class", "").strip() or class_name,
                "parent_phone": row.get("parent_phone") or None,
                "parent_email": row.get("parent_email") or None,
            })

    if not valid_students:
        return {
            "status": "success", "total": total,
            "inserted": 0, "skipped": 0, "errors": errors, "details": details,
        }

    # ── Phase 2: check for duplicates in one DB call ─────────────────────────
    candidate_ids = [s["student_id"] for s in valid_students]
    existing_set: set[str] = set()
    try:
        existing_rows = db.get_students_by_ids(candidate_ids)
        existing_set  = {r["student_id"] for r in existing_rows}
    except Exception as exc:
        logger.error("[IMPORT] Could not check duplicates: %s — treating all as new", exc)

    new_students = [s for s in valid_students if s["student_id"] not in existing_set]
    dup_students = [s for s in valid_students if s["student_id"] in existing_set]

    for s in dup_students:
        details.append({"student_id": s["student_id"], "status": "skipped", "reason": "duplicate"})
        logger.info("[IMPORT] Skipped duplicate: %s", s["student_id"])

    # ── Phase 3: batch insert new students ────────────────────────────────────
    inserted = 0
    if new_students:
        try:
            db.batch_upsert_students(new_students)
            inserted = len(new_students)
            for s in new_students:
                details.append({"student_id": s["student_id"], "status": "success"})
            logger.info("[IMPORT] Batch inserted %d students into class '%s'", inserted, class_name)
        except Exception as exc:
            logger.error("[IMPORT] Batch insert failed (%s) — falling back to individual inserts", exc)
            for s in new_students:
                try:
                    db.insert_student(s)
                    inserted += 1
                    details.append({"student_id": s["student_id"], "status": "success"})
                except Exception as e2:
                    errors += 1
                    details.append({"student_id": s["student_id"], "status": "error", "reason": str(e2)})
                    logger.error("[IMPORT] Insert failed for %s: %s", s["student_id"], e2)

    skipped = len(dup_students)
    return {
        "status":   "success",
        "total":    total,
        "inserted": inserted,
        "skipped":  skipped,
        "errors":   errors,
        "details":  details,
    }


# ---------------------------------------------------------------------------
# Teacher CSV import
# ---------------------------------------------------------------------------

def parse_teacher_csv_file(file_bytes: bytes) -> list:
    if not file_bytes:
        raise ValueError("File is empty")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError("File too large (max 5 MB)")

    text   = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        raise ValueError("CSV has no headers")

    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]
    missing = _TEACHER_REQUIRED_COLS - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    return [{k: (v or "").strip() for k, v in row.items()} for row in reader]


def validate_teacher_row(row: dict) -> tuple:
    if not row.get("full_name", "").strip():
        return False, "Missing full_name"

    if not row.get("staff_type", "").strip():
        return False, "Missing staff_type"

    barcode = row.get("barcode_id", "").strip().upper()
    if not barcode:
        return False, "Missing barcode_id"
    if not _BARCODE_RE.match(barcode):
        return False, f"Invalid barcode_id {barcode!r} — alphanumeric/dash/underscore, max 30 chars"

    phone = row.get("phone", "")
    if phone and not _PHONE_RE.match(phone):
        return False, f"Invalid phone {phone!r} — expected +E.164 (e.g. +2348012345678)"

    email = row.get("email", "")
    if email and not _EMAIL_RE.match(email):
        return False, f"Invalid email {email!r}"

    return True, ""


def batch_insert_teachers(rows: list) -> dict:
    total   = len(rows)
    details = []
    errors  = 0

    # ── Phase 1: validate all rows ──────────────────────────────────────────
    valid_teachers = []
    for row in rows:
        barcode = row.get("barcode_id", "").strip().upper()
        valid, err_msg = validate_teacher_row(row)
        if not valid:
            errors += 1
            details.append({"barcode_id": barcode or "(unknown)", "status": "error", "reason": err_msg})
            logger.warning("[IMPORT] Teacher validation error %s: %s", barcode or "(unknown)", err_msg)
        else:
            valid_teachers.append({
                "teacher_id": str(uuid.uuid4()),
                "full_name":  row["full_name"].strip(),
                "staff_type": row["staff_type"].strip(),
                "barcode_id": barcode,
                "phone":      row.get("phone") or None,
                "email":      row.get("email") or None,
                "is_active":  True,
            })

    if not valid_teachers:
        return {"status": "success", "total": total, "inserted": 0, "skipped": 0, "errors": errors, "details": details}

    # ── Phase 2: pre-flight — check staff types exist in staff_type_config ───
    known_staff_types: set[str] = set()
    try:
        all_types = db.get_all_staff_types()
        known_staff_types = {r["staff_type"] for r in all_types}
    except Exception as exc:
        logger.error("[IMPORT] Could not fetch staff types: %s — skipping pre-check", exc)

    if known_staff_types:
        checked = []
        for t in valid_teachers:
            if t["staff_type"] not in known_staff_types:
                errors += 1
                details.append({
                    "barcode_id": t["barcode_id"],
                    "status": "error",
                    "reason": f"Staff type '{t['staff_type']}' is not configured — create it first in Staff Config",
                })
                logger.warning("[IMPORT] Unknown staff type '%s' for barcode %s", t["staff_type"], t["barcode_id"])
            else:
                checked.append(t)
        valid_teachers = checked

    if not valid_teachers:
        return {"status": "success", "total": total, "inserted": 0, "skipped": 0, "errors": errors, "details": details}

    # ── Phase 3: check for existing barcodes ─────────────────────────────────
    candidate_barcodes = [t["barcode_id"] for t in valid_teachers]
    existing_barcodes = set()
    try:
        existing_rows   = db.get_teachers_by_barcodes(candidate_barcodes)
        existing_barcodes = {r["barcode_id"] for r in existing_rows}
    except Exception as exc:
        logger.error("[IMPORT] Could not check duplicate barcodes: %s", exc)

    new_teachers = [t for t in valid_teachers if t["barcode_id"] not in existing_barcodes]
    dup_teachers = [t for t in valid_teachers if t["barcode_id"] in existing_barcodes]

    for t in dup_teachers:
        details.append({"barcode_id": t["barcode_id"], "status": "skipped", "reason": "barcode already exists"})
        logger.info("[IMPORT] Skipped duplicate barcode: %s", t["barcode_id"])

    # ── Phase 4: batch insert all new teachers in one DB call ─────────────────
    inserted = 0
    if new_teachers:
        try:
            db.batch_upsert_teachers(new_teachers)
            inserted = len(new_teachers)
            for t in new_teachers:
                details.append({"barcode_id": t["barcode_id"], "status": "success"})
            logger.info("[IMPORT] Batch inserted %d teachers", inserted)
        except Exception as exc:
            logger.error("[IMPORT] Batch insert failed (%s) — falling back to individual inserts", exc)
            for t in new_teachers:
                try:
                    db.insert_teacher(t)
                    inserted += 1
                    details.append({"barcode_id": t["barcode_id"], "status": "success"})
                except Exception as e2:
                    errors += 1
                    raw = str(e2)
                    if "23503" in raw or "foreign key" in raw.lower():
                        reason = f"Staff type '{t['staff_type']}' is not configured — create it first in Staff Config"
                    elif "duplicate" in raw.lower() or "unique" in raw.lower() or "23505" in raw:
                        reason = "barcode already exists"
                    else:
                        reason = raw
                    details.append({"barcode_id": t["barcode_id"], "status": "error", "reason": reason})
                    logger.error("[IMPORT] Teacher insert failed for barcode %s: %s", t["barcode_id"], e2)

    skipped = len(dup_teachers)
    logger.info("[IMPORT] Teachers: total=%d inserted=%d skipped=%d errors=%d", total, inserted, skipped, errors)
    return {
        "status":   "success",
        "total":    total,
        "inserted": inserted,
        "skipped":  skipped,
        "errors":   errors,
        "details":  details,
    }
