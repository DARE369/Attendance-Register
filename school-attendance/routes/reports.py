"""
PDF report generation endpoints.
"""
import logging
from datetime import date as _date, timedelta
from flask import Blueprint, jsonify, request, make_response

from routes.auth import token_required
from services import supabase_client as db
from services import pdf_service
from routes.admin import _build_dashboard

reports_bp = Blueprint("reports", __name__)
logger = logging.getLogger("reports")

_TEMPLATES = [
    {
        "template_key":  "daily_summary",
        "display_name":  "Daily Summary",
        "description":   "Complete attendance picture for a single school day — student counts by class and teacher check-ins.",
        "sections":      ["overview", "class_breakdown", "staff_summary"],
    },
    {
        "template_key":  "period_report",
        "display_name":  "Attendance Period Report",
        "description":   "Multi-day trend analysis — daily counts, class breakdown, and most-frequent absentees.",
        "sections":      ["overview", "daily_trend", "class_breakdown", "top_absentees"],
    },
    {
        "template_key":  "staff_report",
        "display_name":  "Staff Attendance Report",
        "description":   "Period-level attendance and punctuality for every teaching staff member.",
        "sections":      ["overview", "staff_detail"],
    },
]


# ---------------------------------------------------------------------------
# GET /api/admin/reports/templates
# ---------------------------------------------------------------------------

@reports_bp.get("/reports/templates")
@token_required
def list_templates():
    try:
        saved = db.get_report_templates()
        by_key = {t["template_key"]: t for t in saved}
        merged = []
        for tpl in _TEMPLATES:
            entry = {**tpl}
            if tpl["template_key"] in by_key:
                saved_entry = by_key[tpl["template_key"]]
                entry["school_name"]   = saved_entry.get("school_name")
                entry["color_scheme"]  = saved_entry.get("color_scheme")
                entry["custom_notes"]  = saved_entry.get("custom_notes")
                entry["custom_sections"] = saved_entry.get("sections")
            merged.append(entry)
        return jsonify({"templates": merged})
    except Exception as exc:
        logger.error("list_templates: %s", exc)
        return jsonify({"templates": _TEMPLATES})


@reports_bp.patch("/reports/templates/<template_key>")
@token_required
def update_template_settings(template_key: str):
    from flask import g
    body = request.get_json(silent=True) or {}
    allowed = {"school_name", "color_scheme", "custom_notes", "sections"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return jsonify({"error": "Nothing to update"}), 400
    try:
        db.upsert_report_template(template_key, g.admin_id, updates)
        return jsonify({"message": "Template settings saved"})
    except Exception as exc:
        logger.error("update_template: %s", exc)
        return jsonify({"error": "Failed to save template settings"}), 500


# ---------------------------------------------------------------------------
# POST /api/admin/reports/generate
# ---------------------------------------------------------------------------

@reports_bp.post("/reports/generate")
@token_required
def generate_report():
    body         = request.get_json(silent=True) or {}
    template_key = body.get("template", "daily_summary")
    date_range   = body.get("date_range", {})
    options      = body.get("options", {})

    start_str = date_range.get("start", _date.today().isoformat())
    end_str   = date_range.get("end",   start_str)

    try:
        start_date = _date.fromisoformat(start_str)
        end_date   = _date.fromisoformat(end_str)
        if (end_date - start_date).days > 90:
            return jsonify({"error": "Date range too large (max 90 days)"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format (use YYYY-MM-DD)"}), 400

    school_name  = options.get("school_name", "Lekki Peculiar School")
    color_scheme = None  # extend later with hex → rgb conversion

    try:
        if template_key == "daily_summary":
            dashboard_data = _build_dashboard(start_str)
            pdf_bytes = pdf_service.generate_daily_summary(
                dashboard_data, options, school_name=school_name)
            filename = f"daily_summary_{start_str}.pdf"

        elif template_key == "period_report":
            students  = db.get_all_students() or []
            total_stu = len(students)
            all_logs  = db.get_attendance_logs_range(start_str, end_str) or []

            num_days = (end_date - start_date).days + 1
            dates    = [(_date.fromisoformat(start_str) + timedelta(days=i)).isoformat()
                        for i in range(num_days)
                        if (_date.fromisoformat(start_str) + timedelta(days=i)).weekday() < 5]

            log_by_date: dict[str, dict] = {}
            for log in all_logs:
                d = (log.get("scan_timestamp") or "")[:10]
                if d:
                    entry = log_by_date.setdefault(d, {"arrived": 0, "departed": 0, "pending": total_stu})
                    if log["log_type"] == "arrival":
                        entry["arrived"] += 1
                        entry["pending"] -= 1
                    elif log["log_type"] == "departure":
                        entry["departed"] += 1

            daily = [{"date": d, **log_by_date.get(d, {"arrived": 0, "departed": 0, "pending": total_stu})}
                     for d in dates]

            # Class breakdown
            class_totals: dict[str, int] = {}
            for s in students:
                class_totals[s["class"]] = class_totals.get(s["class"], 0) + 1

            class_present: dict[str, list] = {}
            for log in all_logs:
                if log["log_type"] != "arrival":
                    continue
                d = (log.get("scan_timestamp") or "")[:10]
                if d not in dates:
                    continue
                sid = log["student_id"]
                stu = next((s for s in students if s["student_id"] == sid), None)
                if stu:
                    class_present.setdefault(stu["class"], []).append(1)

            by_class = {
                cls: {
                    "enrolled":    enrolled,
                    "avg_present": round(len(class_present.get(cls, [])) / len(dates)) if dates else 0,
                }
                for cls, enrolled in class_totals.items()
            }

            # Top absentees
            absent_counts: dict[str, int] = {}
            present_counts: dict[str, set] = {}
            for log in all_logs:
                if log["log_type"] == "arrival":
                    d = (log.get("scan_timestamp") or "")[:10]
                    present_counts.setdefault(log["student_id"], set()).add(d)

            num_school_days = len(dates)
            absentees = []
            for stu in students:
                sid     = stu["student_id"]
                present = len(present_counts.get(sid, set()))
                absent  = max(0, num_school_days - present)
                absent_pct = round(absent / num_school_days * 100) if num_school_days else 0
                if absent > 0:
                    absentees.append({
                        "name":       stu["full_name"],
                        "class":      stu["class"],
                        "absent":     absent,
                        "absent_pct": absent_pct,
                    })
            absentees.sort(key=lambda x: -x["absent"])

            logs_data = {
                "start":          start_str,
                "end":            end_str,
                "total_students": total_stu,
                "daily":          daily,
                "by_class":       by_class,
                "top_absentees":  absentees[:20],
            }
            pdf_bytes = pdf_service.generate_period_report(
                logs_data, options, school_name=school_name)
            filename  = f"period_report_{start_str}_to_{end_str}.pdf"

        elif template_key == "staff_report":
            teachers  = db.get_all_teachers() or []
            all_tlogs = db.get_teacher_logs_range(start_str, end_str) or []

            num_days     = (end_date - start_date).days + 1
            school_days  = sum(
                1 for i in range(num_days)
                if (_date.fromisoformat(start_str) + timedelta(days=i)).weekday() < 5
            )

            tlog_by_teacher: dict[str, list] = {}
            for tlog in all_tlogs:
                tlog_by_teacher.setdefault(tlog["teacher_id"], []).append(tlog)

            staff_list = []
            total_att_rates = []
            total_punc_rates = []

            for t in [t for t in teachers if t.get("is_active", True)]:
                tlogs   = tlog_by_teacher.get(t["teacher_id"], [])
                present = sum(1 for l in tlogs if l.get("check_in_time"))
                absent  = max(0, school_days - present)
                late    = sum(1 for l in tlogs if l.get("check_in_status") == "late")
                on_time = sum(1 for l in tlogs if l.get("check_in_status") == "on_time")
                att_pct = round(present / school_days * 100) if school_days else 0
                punc    = round(on_time / present * 100) if present else 0
                total_att_rates.append(att_pct)
                total_punc_rates.append(punc)
                staff_list.append({
                    "full_name":       t["full_name"],
                    "staff_type":      t["staff_type"],
                    "days_present":    present,
                    "days_absent":     absent,
                    "attendance_rate": att_pct,
                    "on_time_checkins": on_time,
                    "late_checkins":   late,
                    "punctuality_rate": punc,
                })
            staff_list.sort(key=lambda x: x["full_name"])

            avg_att  = round(sum(total_att_rates)  / len(total_att_rates))  if total_att_rates  else 0
            avg_punc = round(sum(total_punc_rates) / len(total_punc_rates)) if total_punc_rates else 0

            staff_data = {
                "start":   start_str,
                "end":     end_str,
                "staff":   staff_list,
                "summary": {
                    "total_staff":    len(staff_list),
                    "school_days":    school_days,
                    "avg_attendance": avg_att,
                    "avg_punctuality": avg_punc,
                },
            }
            pdf_bytes = pdf_service.generate_staff_report(
                staff_data, options, school_name=school_name)
            filename  = f"staff_report_{start_str}_to_{end_str}.pdf"

        else:
            return jsonify({"error": f"Unknown template '{template_key}'"}), 400

        resp = make_response(pdf_bytes)
        resp.headers["Content-Type"]        = "application/pdf"
        resp.headers["Content-Disposition"] = f'inline; filename="{filename}"'
        return resp

    except Exception as exc:
        logger.error("generate_report (%s): %s", template_key, exc)
        return jsonify({"error": f"Report generation failed: {exc}"}), 500
