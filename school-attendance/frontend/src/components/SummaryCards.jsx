import { useState, useEffect, useRef } from 'react';

function useCountUp(target, active) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    if (active) return;
    const n = parseInt(target) || 0;
    const prev = prevRef.current;
    prevRef.current = n;
    if (n === prev) return;

    let current = prev;
    const step  = Math.ceil(Math.abs(n - prev) / 18) * Math.sign(n - prev);
    const id    = setInterval(() => {
      current += step;
      const done = step > 0 ? current >= n : current <= n;
      if (done) { setDisplay(n); clearInterval(id); }
      else        setDisplay(current);
    }, 28);
    return () => clearInterval(id);
  }, [target, active]);

  return display;
}

function KPICard({ label, value, icon, accentClass, textClass, bgClass, loading, subLabel }) {
  const display = useCountUp(value ?? 0, loading);
  return (
    <div className={`bg-white rounded-xl p-4 border-l-4 ${accentClass} flex items-start gap-3 shadow-sm`}>
      <div className={`p-2 rounded-xl ${bgClass} ${textClass} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none mb-1">
          {label}
        </p>
        {loading ? (
          <div className="w-10 h-6 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className={`text-2xl font-bold ${textClass} leading-none`}>{display}</p>
        )}
        {subLabel && !loading && (
          <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ label, pct, colorClass, loading, secondaryLabel }) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          {secondaryLabel && !loading && (
            <span className="text-xs text-gray-400">{secondaryLabel}</span>
          )}
          {loading ? (
            <div className="w-8 h-4 bg-gray-200 rounded animate-pulse" />
          ) : (
            <span className="text-sm font-bold text-gray-900">{pct}%</span>
          )}
        </div>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-700 ease-out`}
          style={{ width: loading ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

const Icons = {
  students: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7
           20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0
           0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  exit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  teacher: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  warn: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  early: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  late: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  school: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
};

export default function SummaryCards({ summary, teacherSummary, loading }) {
  const s  = summary        ?? {};
  const ts = teacherSummary ?? {};

  const arrivalPct = s.total  > 0 ? Math.round((s.arrived  / s.total)  * 100) : 0;
  const onTimePct  = s.arrived > 0 ? Math.round(((s.on_time ?? 0) / s.arrived) * 100) : 0;
  const latePct    = s.arrived > 0 ? Math.round(((s.late    ?? 0) / s.arrived) * 100) : 0;
  const staffOnTimePct = ts.total > 0 ? Math.round(((ts.on_time ?? 0) / ts.total) * 100) : 0;

  return (
    <div className="space-y-5">

      {/* ── Students row 1: totals ── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Students</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total"      value={s.total}    icon={Icons.students} accentClass="border-blue-500"   textClass="text-blue-700"   bgClass="bg-blue-50"   loading={loading} />
          <KPICard label="Arrived"    value={s.arrived}  icon={Icons.check}    accentClass="border-green-500"  textClass="text-green-700"  bgClass="bg-green-50"  loading={loading} subLabel={s.arrived > 0 ? `${s.early ?? 0} early · ${s.on_time ?? 0} on time · ${s.late ?? 0} late` : null} />
          <KPICard label="Departed"   value={s.departed} icon={Icons.exit}     accentClass="border-indigo-500" textClass="text-indigo-700" bgClass="bg-indigo-50" loading={loading} />
          <KPICard label="Not Yet In" value={s.pending}  icon={Icons.clock}    accentClass="border-orange-400" textClass="text-orange-700" bgClass="bg-orange-50" loading={loading} />
        </div>
      </div>

      {/* ── Students row 2: arrival breakdown ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Early"        value={s.early    ?? 0} icon={Icons.early}  accentClass="border-teal-400"   textClass="text-teal-700"   bgClass="bg-teal-50"   loading={loading} subLabel="before 9:00 AM" />
        <KPICard label="On Time"      value={s.on_time  ?? 0} icon={Icons.check}  accentClass="border-green-400"  textClass="text-green-700"  bgClass="bg-green-50"  loading={loading} subLabel="9:00–10:00 AM" />
        <KPICard label="Late"         value={s.late     ?? 0} icon={Icons.late}   accentClass="border-red-400"    textClass="text-red-700"    bgClass="bg-red-50"    loading={loading} subLabel="after 10:00 AM" />
        <KPICard label="Still In"     value={s.still_in ?? 0} icon={Icons.school} accentClass="border-purple-400" textClass="text-purple-700" bgClass="bg-purple-50" loading={loading} subLabel="arrived, not yet departed" />
      </div>

      {/* ── Progress bars ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ProgressBar
          label="Arrival Rate"
          pct={arrivalPct}
          colorClass="bg-gradient-to-r from-green-400 to-green-600"
          loading={loading}
        />
        <ProgressBar
          label="On-Time Rate"
          pct={onTimePct}
          colorClass="bg-gradient-to-r from-blue-400 to-blue-600"
          loading={loading}
          secondaryLabel={s.arrived > 0 ? `of ${s.arrived} who arrived` : null}
        />
        <ProgressBar
          label="Late Arrivals"
          pct={latePct}
          colorClass="bg-gradient-to-r from-amber-400 to-orange-500"
          loading={loading}
          secondaryLabel={s.arrived > 0 ? `of ${s.arrived} who arrived` : null}
        />
      </div>

      {/* ── Teachers ── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Teaching Staff</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KPICard label="Total Staff"  value={ts.total}                              icon={Icons.teacher} accentClass="border-blue-500"   textClass="text-blue-700"   bgClass="bg-blue-50"   loading={loading} />
          <KPICard label="Checked In"   value={(ts.on_time ?? 0) + (ts.late ?? 0)}   icon={Icons.check}   accentClass="border-green-500"  textClass="text-green-700"  bgClass="bg-green-50"  loading={loading} subLabel={ts.late ? `${ts.late} late` : null} />
          <KPICard label="Checked Out"  value={ts.checked_out ?? 0}                   icon={Icons.exit}    accentClass="border-indigo-500" textClass="text-indigo-700" bgClass="bg-indigo-50" loading={loading} />
          <KPICard label="Not Arrived"  value={ts.pending ?? 0}                       icon={Icons.warn}    accentClass="border-orange-400" textClass="text-orange-700" bgClass="bg-orange-50" loading={loading} />
        </div>
        <ProgressBar
          label="Staff On-Time Rate"
          pct={staffOnTimePct}
          colorClass="bg-gradient-to-r from-blue-400 to-blue-600"
          loading={loading}
        />
      </div>
    </div>
  );
}
