import csv
import io
from datetime import date as _date, timedelta
from typing import Optional

from flask import Blueprint, jsonify, request, make_response

from routes.auth import token_required
from services import supabase_client as db

admin_bp = Blueprint("admin", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_time(ts: Optional[str]) -> Optional[str]:
    """'2026-05-16T08:30:00+00:00' → '08:30 AM'"""
    if not ts:
        return None
    try:
        # Normalise: drop timezone, microseconds, use space separator
        clean = ts.replace("T", " ").split("+")[0].split(".")[0]
        time_part = clean.split(" ")[1]          # "08:30:00"
        h, m = time_part.split(":")[:2]
        hour = int(h)
        return f"{hour % 12 or 12}:{m} {'PM' if hour >= 12 else 'AM'}"
    except (ValueError, IndexError, AttributeError):
        return ts


def _build_dashboard(date_str: str) -> dict:
    """
    Pulls all students + teachers + today's logs and assembles the full dashboard payload.
    """
    students     = db.get_all_students() or []
    logs         = db.get_attendance_logs(date=date_str) or []
    teachers     = db.get_all_teachers() or []
    teacher_logs = db.get_teacher_logs(date=date_str) or []

    # Index logs by student_id (logs arrive newest-first from the DB)
    student_logs: dict[str, list] = {}
    for log in logs:
        student_logs.setdefault(log["student_id"], []).append(log)

    classes_seen: set[str] = set()
    students_by_class: dict[str, list] = {}
    summary = {"total": 0, "arrived": 0, "departed": 0, "pending": 0}

    for stu in students:
        sid = stu["student_id"]
        cls = stu["class"]
        classes_seen.add(cls)
        students_by_class.setdefault(cls, [])

        slogs      = student_logs.get(sid, [])          # newest-first
        chron      = list(reversed(slogs))              # oldest-first

        first_arrival  = next((l for l in chron if l["log_type"] == "arrival"),   None)
        first_depart   = next((l for l in chron if l["log_type"] == "departure"), None)
        last_log       = slogs[0] if slogs else None

        if not last_log:
            status = "pending"
        elif last_log["log_type"] == "arrival":
            status = "arrived"
        else:
            status = "departed"

        summary["total"] += 1
        summary[status]  += 1

        students_by_class[cls].append({
            "student_id":        sid,
            "name":              stu["full_name"],
            "class":             cls,
            "status":            status,
            "arrival_time":      _fmt_time(first_arrival["scan_timestamp"])  if first_arrival else None,
            "departure_time":    _fmt_time(first_depart["scan_timestamp"])   if first_depart  else None,
            "arrival_comments":  first_arrival.get("comments")               if first_arrival else None,
            "last_scan":         last_log["scan_timestamp"]                  if last_log      else None,
        })

    # ── Teacher summary ──────────────────────────────────────────────────────
    tlog_index = {log["teacher_id"]: log for log in teacher_logs}
    active_teachers = [t for t in teachers if t.get("is_active", True)]

    teacher_summary = {"total": len(active_teachers), "on_time": 0, "late": 0,
                       "checked_in": 0, "checked_out": 0, "pending": 0}
    teachers_list = []

    for t in active_teachers:
        tlog = tlog_index.get(t["teacher_id"])
        if tlog:
            ci_status = tlog.get("check_in_status") or ""
            if tlog.get("check_out_time"):
                t_status = "checked_out"
                teacher_summary["checked_out"] += 1
            else:
                t_status = "checked_in"
                teacher_summary["checked_in"] += 1
            if ci_status == "on_time":
                teacher_summary["on_time"] += 1
            elif ci_status == "late":
                teacher_summary["late"] += 1
        else:
            t_status = "pending"
            teacher_summary["pending"] += 1

        teachers_list.append({
            "teacher_id":     t["teacher_id"],
            "full_name":      t["full_name"],
            "staff_type":     t["staff_type"],
            "barcode_id":     t["barcode_id"],
            "status":         t_status,
            "check_in_time":  tlog.get("check_in_time")  if tlog else None,
            "check_out_time": tlog.get("check_out_time") if tlog else None,
            "check_out_status": tlog.get("check_out_status") if tlog else None,
            "check_in_status": tlog.get("check_in_status") if tlog else None,
            "comments":       tlog.get("check_in_comments") if tlog else None,
            "last_scan":      (tlog.get("check_out_time") or tlog.get("check_in_time")) if tlog else None,
        })

    return {
        "date":              date_str,
        "classes":           sorted(classes_seen),
        "summary":           summary,
        "students_by_class": students_by_class,
        "teacher_summary":   teacher_summary,
        "teachers":          teachers_list,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@admin_bp.get("/dashboard")
@token_required
def dashboard():
    date_str = request.args.get("date", _date.today().isoformat())
    try:
        return jsonify(_build_dashboard(date_str))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@admin_bp.get("/students/<class_name>")
@token_required
def students_by_class(class_name: str):
    date_str = request.args.get("date", _date.today().isoformat())
    try:
        data = _build_dashboard(date_str)
        return jsonify({
            "class":    class_name,
            "students": data["students_by_class"].get(class_name, []),
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@admin_bp.get("/attendance-log")
@token_required
def attendance_log():
    date_str   = request.args.get("date", _date.today().isoformat())
    student_id = request.args.get("student_id")
    try:
        logs = db.get_attendance_logs(date=date_str, student_id=student_id) or []
        return jsonify({"logs": logs[:50], "total": len(logs)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@admin_bp.get("/analytics")
@token_required
def analytics():
    today     = _date.today()
    end_str   = request.args.get("end",   today.isoformat())
    start_str = request.args.get("start", (today - timedelta(days=6)).isoformat())

    try:
        end_date   = _date.fromisoformat(end_str)
        start_date = _date.fromisoformat(start_str)
        if (end_date - start_date).days > 90:
            return jsonify({"error": "Date range too large (max 90 days)"}), 400

        students      = db.get_all_students() or []
        total_stu     = len(students)
        class_totals  = {}
        for s in students:
            class_totals[s["class"]] = class_totals.get(s["class"], 0) + 1

        all_logs      = db.get_attendance_logs_range(start_str, end_str) or []
        all_tlogs     = db.get_teacher_logs_range(start_str, end_str)    or []

        # Build per-day stats
        num_days      = (end_date - start_date).days + 1
        dates         = [(start_date + timedelta(days=i)).isoformat() for i in range(num_days)]

        # Index arrival logs by date → set of student_ids who arrived
        arrivals_by_date: dict[str, set] = {d: set() for d in dates}
        for log in all_logs:
            if log.get("log_type") == "arrival":
                d = (log["scan_timestamp"] or "")[:10]
                if d in arrivals_by_date:
                    arrivals_by_date[d].add(log["student_id"])

        daily = []
        for d in dates:
            arrived = len(arrivals_by_date[d])
            rate    = round(arrived / total_stu * 100, 1) if total_stu else 0
            daily.append({"date": d, "arrived": arrived, "total": total_stu, "rate": rate})

        # Class breakdown: across the whole range, average attendance rate per class
        class_arrivals: dict[str, set] = {}
        for log in all_logs:
            if log.get("log_type") == "arrival":
                # Attach class via student list
                pass  # resolved below

        stu_class = {s["student_id"]: s["class"] for s in students}
        class_arrived_students: dict[str, set] = {}
        for log in all_logs:
            if log.get("log_type") == "arrival":
                cls = stu_class.get(log["student_id"])
                if cls:
                    class_arrived_students.setdefault(cls, set()).add(log["student_id"])

        classes_stats = []
        for cls, ttl in class_totals.items():
            attended = len(class_arrived_students.get(cls, set()))
            avg_rate = round(attended / ttl * 100, 1) if ttl else 0
            classes_stats.append({"class": cls, "attended": attended,
                                   "total": ttl, "rate": avg_rate})
        classes_stats.sort(key=lambda x: -x["rate"])

        # Teacher punctuality across range
        total_teachers  = len(db.get_all_teachers() or [])
        on_time_cnt  = sum(1 for l in all_tlogs if l.get("check_in_status") == "on_time")
        late_cnt     = sum(1 for l in all_tlogs if l.get("check_in_status") == "late")
        checkins     = len(all_tlogs)

        return jsonify({
            "start":           start_str,
            "end":             end_str,
            "total_students":  total_stu,
            "total_teachers":  total_teachers,
            "daily":           daily,
            "classes":         classes_stats,
            "teacher_summary": {
                "check_ins": checkins,
                "on_time":   on_time_cnt,
                "late":      late_cnt,
            },
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@admin_bp.get("/staff-analytics/<teacher_id>")
@token_required
def staff_analytics(teacher_id: str):
    today     = _date.today()
    end_str   = request.args.get("end",   today.isoformat())
    start_str = request.args.get("start", (_date(today.year, today.month, 1)).isoformat())

    try:
        end_date   = _date.fromisoformat(end_str)
        start_date = _date.fromisoformat(start_str)
        if (end_date - start_date).days > 365:
            return jsonify({"error": "Date range too large (max 365 days)"}), 400

        teachers = db.get_all_teachers()
        teacher  = next((t for t in teachers if t["teacher_id"] == teacher_id), None)
        if not teacher:
            return jsonify({"error": "Teacher not found"}), 404

        logs = db.get_teacher_logs(teacher_id=teacher_id)
        logs_in_range = [
            l for l in logs
            if start_str <= (l.get("scan_date") or "") <= end_str
        ]

        num_days = (end_date - start_date).days + 1
        school_days = sum(
            1 for i in range(num_days)
            if (_date.fromisoformat(start_str) + timedelta(days=i)).weekday() < 5
        )

        present     = sum(1 for l in logs_in_range if l.get("check_in_time"))
        absent      = max(0, school_days - present)
        late        = sum(1 for l in logs_in_range if l.get("check_in_status") == "late")
        on_time     = sum(1 for l in logs_in_range if l.get("check_in_status") == "on_time")
        early_out   = sum(1 for l in logs_in_range if l.get("check_out_status") == "early_departure")
        checked_out = sum(1 for l in logs_in_range if l.get("check_out_time"))

        check_in_times = [l["check_in_time"] for l in logs_in_range if l.get("check_in_time")]
        avg_checkin = None
        if check_in_times:
            def _minutes(ts):
                try:
                    t = ts.split("T")[-1][:5]
                    h, m = map(int, t.split(":"))
                    return h * 60 + m
                except Exception:
                    return None
            mins = [_minutes(ts) for ts in check_in_times if _minutes(ts) is not None]
            if mins:
                avg_m = sum(mins) // len(mins)
                avg_checkin = f"{avg_m // 60:02d}:{avg_m % 60:02d}"

        monthly: dict[str, dict] = {}
        for l in logs_in_range:
            month = (l.get("scan_date") or "")[:7]
            if not month:
                continue
            m = monthly.setdefault(month, {"present": 0, "late": 0, "on_time": 0})
            if l.get("check_in_time"):
                m["present"] += 1
            if l.get("check_in_status") == "late":
                m["late"] += 1
            elif l.get("check_in_status") == "on_time":
                m["on_time"] += 1

        return jsonify({
            "teacher": {
                "teacher_id": teacher["teacher_id"],
                "full_name":  teacher["full_name"],
                "staff_type": teacher["staff_type"],
            },
            "period": {"start": start_str, "end": end_str},
            "school_days":       school_days,
            "days_present":      present,
            "days_absent":       absent,
            "attendance_rate":   round(present / school_days * 100, 1) if school_days else 0,
            "on_time_checkins":  on_time,
            "late_checkins":     late,
            "punctuality_rate":  round(on_time / present * 100, 1) if present else 0,
            "avg_checkin_time":  avg_checkin,
            "early_departures":  early_out,
            "days_checked_out":  checked_out,
            "monthly_breakdown": monthly,
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@admin_bp.get("/export-csv")
@token_required
def export_csv():
    date_str = request.args.get("date", _date.today().isoformat())
    try:
        data = _build_dashboard(date_str)

        buf = io.StringIO()
        w   = csv.writer(buf)
        w.writerow(["StudentID", "Name", "Class", "Status",
                    "ArrivalTime", "ArrivalComments", "DepartureTime"])

        for students in data["students_by_class"].values():
            for s in students:
                w.writerow([
                    s["student_id"],
                    s["name"],
                    s["class"],
                    s["status"],
                    s["arrival_time"]     or "",
                    s["arrival_comments"] or "",
                    s["departure_time"]   or "",
                ])

        buf.seek(0)
        resp = make_response(buf.getvalue())
        resp.headers["Content-Type"]        = "text/csv"
        resp.headers["Content-Disposition"] = f'attachment; filename="attendance_{date_str}.csv"'
        return resp

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
