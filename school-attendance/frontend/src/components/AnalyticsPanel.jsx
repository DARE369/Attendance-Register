import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAnalytics } from '../services/api';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function fmtDate(d) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short',
    });
  } catch { return d; }
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ days }) {
  if (!days?.length) return null;
  const max = Math.max(...days.map((d) => d.rate), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {days.map((d) => {
        const pct = (d.rate / max) * 100;
        const color =
          d.rate >= 80 ? 'bg-green-500' :
          d.rate >= 60 ? 'bg-yellow-400' :
                         'bg-red-400';
        return (
          <div key={d.date} className="flex flex-col items-center flex-1 min-w-0 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap
                            bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0
                            group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {fmtDate(d.date)}: {d.arrived}/{d.total} ({d.rate}%)
            </div>
            <div className={`w-full rounded-t ${color} transition-all duration-300`}
              style={{ height: `${Math.max(pct, 2)}%` }} />
            <span className="text-[9px] text-gray-400 mt-1 rotate-45 origin-left truncate
                             hidden sm:block">
              {fmtDate(d.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'blue' }) {
  const cls = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    green:  'bg-green-50 border-green-100 text-green-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
    red:    'bg-red-50 border-red-100 text-red-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${cls[color] || cls.blue}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-semibold mt-0.5">{label}</p>
      {sub && <p className="text-xs mt-0.5 opacity-70">{sub}</p>}
    </div>
  );
}

// ── Class row ─────────────────────────────────────────────────────────────────
function ClassRow({ cls, max }) {
  const pct = max > 0 ? (cls.rate / max) * 100 : 0;
  const color =
    cls.rate >= 80 ? 'bg-green-400' :
    cls.rate >= 60 ? 'bg-yellow-400' :
                     'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 w-28 shrink-0 truncate">{cls.class}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-600 w-16 text-right shrink-0">
        {cls.rate}% <span className="text-xs font-normal text-gray-400">({cls.attended}/{cls.total})</span>
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyticsPanel({ isEmbedded = false }) {
  const [preset,  setPreset]  = useState('7');
  const [start,   setStart]   = useState(daysAgo(6));
  const [end,     setEnd]     = useState(todayStr());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (s, e) => {
    setLoading(true);
    try {
      const { data: res } = await getAnalytics(s, e);
      setData(res);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(start, end); }, []);

  function applyPreset(p) {
    setPreset(p);
    const e = todayStr();
    const s = daysAgo(parseInt(p) - 1);
    setStart(s);
    setEnd(e);
    load(s, e);
  }

  function applyCustom() {
    setPreset('custom');
    load(start, end);
  }

  const avgRate = data?.daily?.length
    ? Math.round(data.daily.reduce((a, d) => a + d.rate, 0) / data.daily.length)
    : 0;

  const maxClassRate = data?.classes?.length
    ? Math.max(...data.classes.map((c) => c.rate))
    : 100;

  const onTimeRate = data?.teacher_summary?.check_ins
    ? Math.round(data.teacher_summary.on_time / data.teacher_summary.check_ins * 100)
    : 0;

  const content = (
    <div className="space-y-6">
      {/* Header */}
      {!isEmbedded && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Attendance trends and patterns over time</p>
        </div>
      )}

      {/* Date range controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Quick Range</p>
            <div className="flex gap-1">
              {[
                { v: '7',  l: '7 days' },
                { v: '14', l: '14 days' },
                { v: '30', l: '30 days' },
              ].map(({ v, l }) => (
                <button key={v} onClick={() => applyPreset(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    preset === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">From</p>
              <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setPreset('custom'); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">To</p>
              <input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPreset('custom'); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {preset === 'custom' && (
              <button onClick={applyCustom}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold
                           hover:bg-blue-700 transition-colors">
                Apply
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
          <svg className="animate-spin w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Loading analytics…</p>
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Avg Attendance Rate"  value={`${avgRate}%`}
              sub={`over ${data.daily?.length || 0} days`} color="blue" />
            <StatCard label="Total Students"       value={data.total_students}
              sub="enrolled"   color="green" />
            <StatCard label="Teacher Check-ins"    value={data.teacher_summary?.check_ins || 0}
              sub={`${onTimeRate}% on time`} color="purple" />
            <StatCard label="Late Check-ins"       value={data.teacher_summary?.late || 0}
              sub="staff late arrivals" color={data.teacher_summary?.late > 5 ? 'red' : 'amber'} />
          </div>

          {/* Daily attendance chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Daily Attendance Rate (%)</h3>
            <BarChart days={data.daily} />
            <div className="flex gap-4 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-500" /> ≥ 80%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-yellow-400" /> 60–79%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-400" /> &lt; 60%
              </span>
            </div>
          </div>

          {/* Class breakdown */}
          {data.classes?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Attendance by Class</h3>
              <div className="space-y-3">
                {data.classes.map((c) => (
                  <ClassRow key={c.class} cls={c} max={maxClassRate} />
                ))}
              </div>
            </div>
          )}

          {/* Teacher punctuality */}
          {data.teacher_summary && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Staff Punctuality</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Check-ins',   val: data.teacher_summary.check_ins, color: 'text-gray-700' },
                  { label: 'On Time',     val: data.teacher_summary.on_time,   color: 'text-green-600' },
                  { label: 'Late',        val: data.teacher_summary.late,      color: 'text-orange-500' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <p className={`text-2xl font-bold ${color}`}>{val}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {data.teacher_summary.check_ins > 0 && (
                <div className="mt-4 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full"
                    style={{ width: `${onTimeRate}%` }} />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2 text-right">{onTimeRate}% on time</p>
            </div>
          )}
        </>
      ) : (
        <div className="py-16 text-center text-gray-400">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm font-medium text-gray-500">No data for the selected range</p>
        </div>
      )}
    </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">Analytics</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">{content}</main>
    </div>
  );
}
