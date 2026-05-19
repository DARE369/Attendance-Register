import { useState, useEffect, useRef } from 'react';

function useCountUp(target, active) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    if (active) return; // still loading — don't animate yet
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

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, icon, accentClass, textClass, bgClass, loading, subLabel }) {
  const display = useCountUp(value ?? 0, loading);

  return (
    <div className={`bg-white rounded-xl p-5 border-l-4 ${accentClass} card-hover flex items-start gap-4`}>
      <div className={`p-2.5 rounded-xl ${bgClass} ${textClass} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none mb-1.5">
          {label}
        </p>
        {loading ? (
          <div className="w-12 h-7 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className={`text-3xl font-bold ${textClass} animate-count-up leading-none`}>
            {display}
          </p>
        )}
        {subLabel && !loading && (
          <p className="text-xs text-gray-400 mt-1">{subLabel}</p>
        )}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ label, pct, colorClass, loading }) {
  return (
    <div className="bg-white rounded-xl px-5 py-4 card-hover">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        {loading ? (
          <div className="w-8 h-4 bg-gray-200 rounded animate-pulse" />
        ) : (
          <span className="text-sm font-bold text-gray-900">{pct}%</span>
        )}
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

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icons = {
  students: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7
           20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0
           0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  exit: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  teacher: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  warn: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

// ── Main component ────────────────────────────────────────────────────────────

export default function SummaryCards({ summary, teacherSummary, loading }) {
  const s  = summary        ?? {};
  const ts = teacherSummary ?? {};

  const arrivalPct  = s.total > 0 ? Math.round((s.arrived  / s.total) * 100) : 0;
  const onTimePct   = ts.total > 0 ? Math.round(((ts.on_time ?? 0) / ts.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── Students ── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Students
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KPICard label="Total"         value={s.total}    icon={Icons.students} accentClass="border-blue-500"   textClass="text-blue-700"   bgClass="bg-blue-50"   loading={loading} />
          <KPICard label="Arrived"       value={s.arrived}  icon={Icons.check}    accentClass="border-green-500"  textClass="text-green-700"  bgClass="bg-green-50"  loading={loading} />
          <KPICard label="Departed"      value={s.departed} icon={Icons.exit}     accentClass="border-indigo-500" textClass="text-indigo-700" bgClass="bg-indigo-50" loading={loading} />
          <KPICard label="Not Yet In"    value={s.pending}  icon={Icons.clock}    accentClass="border-orange-400" textClass="text-orange-700" bgClass="bg-orange-50" loading={loading} />
        </div>
        <ProgressBar label="Student Arrival Rate" pct={arrivalPct}
          colorClass="bg-gradient-to-r from-green-400 to-green-600" loading={loading} />
      </div>

      {/* ── Teachers ── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Teaching Staff
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
          <KPICard label="Total Staff"  value={ts.total}      icon={Icons.teacher} accentClass="border-blue-500"   textClass="text-blue-700"   bgClass="bg-blue-50"   loading={loading} />
          <KPICard label="Checked In"   value={(ts.on_time ?? 0) + (ts.late ?? 0)} icon={Icons.check} accentClass="border-green-500"  textClass="text-green-700"  bgClass="bg-green-50"  loading={loading} subLabel={`${ts.late ?? 0} late`} />
          <KPICard label="Not Arrived"  value={ts.pending}    icon={Icons.warn}    accentClass="border-orange-400" textClass="text-orange-700" bgClass="bg-orange-50" loading={loading} />
        </div>
        <ProgressBar label="Staff On-Time Rate" pct={onTimePct}
          colorClass="bg-gradient-to-r from-blue-400 to-blue-600" loading={loading} />
      </div>
    </div>
  );
}
