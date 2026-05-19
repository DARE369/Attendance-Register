"""
PDF report generation using fpdf2.
Three built-in templates:
  daily_summary   — one day's attendance
  period_report   — multi-day period with trend table
  staff_report    — teacher attendance for a period
"""
import io
from datetime import date as _date, timedelta
from typing import Optional

from fpdf import FPDF


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

BRAND_COLOR  = (26,  58,  82)   # #1a3a52
GREEN        = (22, 163,  74)
ORANGE       = (234, 88,  12)
RED          = (220,  38,  38)
GRAY_LIGHT   = (243, 244, 246)
GRAY_MED     = (107, 114, 128)


def _pct_color(pct: float):
    if pct >= 80: return GREEN
    if pct >= 60: return ORANGE
    return RED


def _fmt_date(d: str) -> str:
    try:
        return _date.fromisoformat(d).strftime("%d %b %Y")
    except Exception:
        return d


class _Base(FPDF):
    def __init__(self, school_name: str = "Lekki Peculiar School",
                 color_scheme: Optional[tuple] = None):
        super().__init__()
        self.school_name  = school_name
        self.brand_color  = color_scheme or BRAND_COLOR
        self.set_auto_page_break(auto=True, margin=15)
        self.set_margins(15, 15, 15)

    def header(self):
        self.set_fill_color(*self.brand_color)
        self.rect(0, 0, 210, 18, "F")
        self.set_y(4)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, self.school_name, align="L")
        self.set_text_color(0, 0, 0)
        self.ln(14)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*GRAY_MED)
        self.cell(0, 5, f"Page {self.page_no()}", align="C")
        self.set_text_color(0, 0, 0)

    def section_title(self, text: str):
        self.set_fill_color(*GRAY_LIGHT)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*self.brand_color)
        self.cell(0, 8, f"  {text}", fill=True, ln=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def kpi_row(self, items: list[tuple[str, str]]):
        col_w = 180 / len(items)
        self.set_font("Helvetica", "B", 14)
        for _, val in items:
            self.cell(col_w, 9, val, align="C")
        self.ln()
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*GRAY_MED)
        for label, _ in items:
            self.cell(col_w, 5, label, align="C")
        self.set_text_color(0, 0, 0)
        self.ln(8)

    def table_header(self, cols: list[tuple[str, float]]):
        self.set_fill_color(*self.brand_color)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 8)
        for label, w in cols:
            self.cell(w, 7, label, border=0, fill=True, align="C")
        self.ln()
        self.set_text_color(0, 0, 0)

    def table_row(self, cells: list[tuple[str, float]], fill: bool = False):
        if fill:
            self.set_fill_color(*GRAY_LIGHT)
        self.set_font("Helvetica", "", 8)
        for text, w in cells:
            self.cell(w, 6, str(text), border=0, fill=fill, align="C")
        self.ln()


# ---------------------------------------------------------------------------
# Template 1 — Daily Summary
# ---------------------------------------------------------------------------

def generate_daily_summary(
    data: dict,
    options: dict,
    school_name: str = "Lekki Peculiar School",
    color_scheme: Optional[tuple] = None,
) -> bytes:
    summary   = data.get("summary", {})
    t_summary = data.get("teacher_summary", {})
    date_str  = data.get("date", _date.today().isoformat())
    classes   = data.get("students_by_class", {})
    teachers  = data.get("teachers", [])

    pdf = _Base(school_name=school_name, color_scheme=color_scheme)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*pdf.brand_color)
    pdf.cell(0, 8, "Daily Attendance Summary", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*GRAY_MED)
    pdf.cell(0, 5, f"Date: {_fmt_date(date_str)}", ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # Student KPIs
    pdf.section_title("Student Overview")
    total   = summary.get("total",    0)
    arrived = summary.get("arrived",  0)
    depart  = summary.get("departed", 0)
    pending = summary.get("pending",  0)
    att_pct = round(arrived / total * 100) if total else 0

    pdf.kpi_row([
        ("Total Students",  str(total)),
        ("Arrived",         str(arrived)),
        ("Departed",        str(depart)),
        ("Not Yet In",      str(pending)),
        ("Attendance Rate", f"{att_pct}%"),
    ])

    # Class breakdown
    if "class_breakdown" in options.get("sections", ["class_breakdown"]):
        pdf.section_title("Class Breakdown")
        cols = [("Class", 60), ("Total", 30), ("Arrived", 30), ("Departed", 30), ("Pending", 30)]
        pdf.table_header(cols)
        for i, (cls, students) in enumerate(sorted(classes.items())):
            cls_arrived = sum(1 for s in students if s["status"] == "arrived")
            cls_depart  = sum(1 for s in students if s["status"] == "departed")
            cls_pending = sum(1 for s in students if s["status"] == "pending")
            pdf.table_row([
                (cls,           60),
                (len(students), 30),
                (cls_arrived,   30),
                (cls_depart,    30),
                (cls_pending,   30),
            ], fill=i % 2 == 0)
        pdf.ln(5)

    # Staff summary
    if "staff_summary" in options.get("sections", ["staff_summary"]):
        pdf.section_title("Teaching Staff")
        t_total   = t_summary.get("total",       0)
        t_checkin = (t_summary.get("on_time", 0) + t_summary.get("late", 0))
        t_out     = t_summary.get("checked_out", 0)
        t_late    = t_summary.get("late",        0)
        t_pending = t_summary.get("pending",     0)
        pdf.kpi_row([
            ("Total Staff",   str(t_total)),
            ("Checked In",    str(t_checkin)),
            ("Checked Out",   str(t_out)),
            ("Late Arrivals", str(t_late)),
            ("Not Arrived",   str(t_pending)),
        ])

        if teachers:
            cols = [("Name", 70), ("Type", 45), ("Check-In", 32), ("Status", 33)]
            pdf.table_header(cols)
            for i, t in enumerate(teachers[:30]):
                ci = t.get("check_in_time") or "—"
                if ci and ci != "—":
                    try:
                        ci = ci.split("T")[-1][:5]
                    except Exception:
                        pass
                pdf.table_row([
                    (t.get("full_name", "")[:28], 70),
                    (t.get("staff_type", ""),     45),
                    (ci,                          32),
                    (t.get("status", ""),         33),
                ], fill=i % 2 == 0)

    return bytes(pdf.output())


# ---------------------------------------------------------------------------
# Template 2 — Attendance Period Report
# ---------------------------------------------------------------------------

def generate_period_report(
    logs_data: dict,
    options: dict,
    school_name: str = "Lekki Peculiar School",
    color_scheme: Optional[tuple] = None,
) -> bytes:
    start    = logs_data.get("start",  "")
    end      = logs_data.get("end",    "")
    total_s  = logs_data.get("total_students", 0)
    daily    = logs_data.get("daily",  [])
    by_class = logs_data.get("by_class", {})
    absentees = logs_data.get("top_absentees", [])

    pdf = _Base(school_name=school_name, color_scheme=color_scheme)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*pdf.brand_color)
    pdf.cell(0, 8, "Attendance Period Report", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*GRAY_MED)
    pdf.cell(0, 5, f"Period: {_fmt_date(start)} — {_fmt_date(end)}", ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # Period overview KPIs
    num_days    = len(daily)
    avg_arrived = round(sum(d.get("arrived", 0) for d in daily) / num_days) if num_days else 0
    avg_pct     = round(avg_arrived / total_s * 100) if total_s else 0
    pdf.section_title("Period Overview")
    pdf.kpi_row([
        ("School Days",      str(num_days)),
        ("Total Students",   str(total_s)),
        ("Avg Daily Present", str(avg_arrived)),
        ("Avg Attendance %", f"{avg_pct}%"),
    ])

    # Daily trend table
    if "daily_trend" in options.get("sections", ["daily_trend"]):
        pdf.section_title("Daily Attendance Trend")
        cols = [("Date", 55), ("Arrived", 35), ("Departed", 35), ("Pending", 35), ("Rate %", 30)]
        pdf.table_header(cols)
        for i, d in enumerate(daily):
            arr  = d.get("arrived",  0)
            dep  = d.get("departed", 0)
            pend = d.get("pending",  0)
            pct  = round(arr / total_s * 100) if total_s else 0
            pdf.table_row([
                (_fmt_date(d.get("date", "")), 55),
                (arr,  35),
                (dep,  35),
                (pend, 35),
                (f"{pct}%", 30),
            ], fill=i % 2 == 0)
        pdf.ln(5)

    # Class breakdown
    if "class_breakdown" in options.get("sections", ["class_breakdown"]):
        pdf.section_title("Class Breakdown (Period Totals)")
        cols = [("Class", 65), ("Avg Present", 40), ("Avg Rate %", 40), ("Total Enrolled", 45)]
        pdf.table_header(cols)
        for i, (cls, info) in enumerate(sorted(by_class.items())):
            enrolled = info.get("enrolled", 0)
            avg_p    = info.get("avg_present", 0)
            avg_r    = round(avg_p / enrolled * 100) if enrolled else 0
            pdf.table_row([
                (cls,     65),
                (avg_p,   40),
                (f"{avg_r}%", 40),
                (enrolled, 45),
            ], fill=i % 2 == 0)
        pdf.ln(5)

    # Top absentees
    if absentees and "top_absentees" in options.get("sections", ["top_absentees"]):
        pdf.section_title("Frequently Absent Students")
        cols = [("Name", 80), ("Class", 45), ("Days Absent", 35), ("Rate %", 30)]
        pdf.table_header(cols)
        for i, s in enumerate(absentees[:20]):
            pdf.table_row([
                (s.get("name",  "")[:30], 80),
                (s.get("class", ""),      45),
                (s.get("absent", 0),      35),
                (f"{s.get('absent_pct', 0)}%", 30),
            ], fill=i % 2 == 0)

    return bytes(pdf.output())


# ---------------------------------------------------------------------------
# Template 3 — Staff Attendance Report
# ---------------------------------------------------------------------------

def generate_staff_report(
    staff_data: dict,
    options: dict,
    school_name: str = "Lekki Peculiar School",
    color_scheme: Optional[tuple] = None,
) -> bytes:
    start    = staff_data.get("start", "")
    end      = staff_data.get("end",   "")
    staff    = staff_data.get("staff", [])
    summary  = staff_data.get("summary", {})

    pdf = _Base(school_name=school_name, color_scheme=color_scheme)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*pdf.brand_color)
    pdf.cell(0, 8, "Staff Attendance Report", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*GRAY_MED)
    pdf.cell(0, 5, f"Period: {_fmt_date(start)} — {_fmt_date(end)}", ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # Summary KPIs
    pdf.section_title("Overview")
    pdf.kpi_row([
        ("Total Staff",       str(summary.get("total_staff",    0))),
        ("Avg Attendance %",  f"{summary.get('avg_attendance',  0)}%"),
        ("Avg Punctuality %", f"{summary.get('avg_punctuality', 0)}%"),
        ("School Days",       str(summary.get("school_days",    0))),
    ])

    # Staff detail table
    pdf.section_title("Individual Staff Records")
    cols = [("Name", 60), ("Type", 38), ("Present", 22), ("Absent", 22),
            ("Att %", 20), ("OnTime", 20), ("Late", 18)]
    pdf.table_header(cols)
    for i, s in enumerate(staff):
        pdf.table_row([
            (s.get("full_name",       "")[:24], 60),
            (s.get("staff_type",      ""),      38),
            (s.get("days_present",    0),       22),
            (s.get("days_absent",     0),       22),
            (f"{s.get('attendance_rate', 0)}%", 20),
            (s.get("on_time_checkins",0),       20),
            (s.get("late_checkins",   0),       18),
        ], fill=i % 2 == 0)

    return bytes(pdf.output())
