import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getStaffAnalytics } from '../services/api';

function StatBox({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
      <p className="text-xs font-semibold text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ pct, color = 'bg-blue-500' }) {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-700`}
           style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = today.slice(0, 7) + '-01';

export default function StaffAnalyticsPanel({ teacher, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [start,   setStart]   = useState(firstOfMonth);
  const [end,     setEnd]     = useState(today);

  useEffect(() => {
    if (!teacher) return;
    setLoading(true);
    getStaffAnalytics(teacher.teacher_id, start, end)
      .then(({ data: res }) => setData(res))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [teacher, start, end]);

  if (!teacher) return null;

  const monthly = data ? Object.entries(data.monthly_breakdown).sort(([a], [b]) => a.localeCompare(b)) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-xl h-[calc(100vh-2rem)] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{teacher.full_name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{teacher.staff_type} · Analytics</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Date range picker */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0 text-sm">
          <label className="text-xs font-semibold text-gray-500">From</label>
          <input type="date" value={start} max={end}
            onChange={(e) => setStart(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <label className="text-xs font-semibold text-gray-500">To</label>
          <input type="date" value={end} min={start} max={today}
            onChange={(e) => setEnd(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
          ) : !data ? (
            <div className="py-16 text-center text-gray-400 text-sm">No data available</div>
          ) : (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="School Days"     value={data.school_days} />
                <StatBox label="Days Present"    value={data.days_present}
                  sub={`${data.days_absent} absent`} color="text-green-700" />
                <StatBox label="Attendance Rate" value={`${data.attendance_rate}%`}
                  color={data.attendance_rate >= 80 ? 'text-green-700' : 'text-orange-600'} />
                <StatBox label="Avg Check-in"    value={data.avg_checkin_time || '—'} />
              </div>

              {/* Attendance rate bar */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="font-semibold text-gray-700">Attendance Rate</span>
                  <span className="font-bold text-gray-900">{data.attendance_rate}%</span>
                </div>
                <Bar pct={data.attendance_rate}
                  color={data.attendance_rate >= 80 ? 'bg-green-500' : 'bg-orange-400'} />
              </div>

              {/* Punctuality */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Punctuality</p>
                <div className="flex items-center justify-between mb-1 text-xs text-gray-500">
                  <span>On Time</span>
                  <span className="font-bold text-green-700">{data.on_time_checkins}</span>
                </div>
                <Bar pct={data.punctuality_rate} color="bg-green-500" />
                <div className="flex items-center justify-between mt-3 mb-1 text-xs text-gray-500">
                  <span>Late Arrivals</span>
                  <span className="font-bold text-orange-600">{data.late_checkins}</span>
                </div>
                <Bar pct={data.days_present > 0 ? (data.late_checkins / data.days_present * 100) : 0}
                  color="bg-orange-400" />
                <p className="text-xs text-gray-400 mt-2">
                  Punctuality rate: <span className="font-semibold text-gray-600">{data.punctuality_rate}%</span>
                  {' '}· Early departures: <span className="font-semibold text-gray-600">{data.early_departures}</span>
                </p>
              </div>

              {/* Monthly breakdown */}
              {monthly.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Monthly Breakdown</p>
                  <table className="w-full text-xs">
                    <thead className="text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left pb-2">Month</th>
                        <th className="text-center pb-2">Present</th>
                        <th className="text-center pb-2">On Time</th>
                        <th className="text-center pb-2">Late</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthly.map(([month, m]) => (
                        <tr key={month}>
                          <td className="py-2 font-medium text-gray-700">
                            {new Date(month + '-02').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2 text-center text-gray-800 font-semibold">{m.present}</td>
                          <td className="py-2 text-center text-green-700 font-semibold">{m.on_time}</td>
                          <td className="py-2 text-center text-orange-600 font-semibold">{m.late}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
