import { useState, useMemo } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

// ── Badge components ──────────────────────────────────────────────────────────

function StatusBadge({ status, recordType }) {
  const map = {
    arrived:     { label: 'Arrived',     cls: 'bg-green-100 text-green-800 border-green-200' },
    departed:    { label: 'Departed',    cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    pending:     { label: 'Not yet arrived', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    checked_in:  { label: 'Checked In',  cls: 'bg-green-100 text-green-800 border-green-200' },
    checked_out: { label: 'Checked Out', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  };
  const { label, cls } = map[status] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }) {
  return type === 'teacher' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
      Staff
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      Student
    </span>
  );
}

function PunctualityBadge({ status }) {
  if (!status) return null;
  const map = {
    on_time:         { label: 'On Time',    cls: 'text-green-600' },
    late:            { label: 'Late',       cls: 'text-orange-600' },
    early_departure: { label: 'Early Out',  cls: 'text-orange-600' },
    late_checkout:   { label: 'Late Out',   cls: 'text-orange-600' },
    early:           { label: 'Early',      cls: 'text-blue-600' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'text-gray-500' };
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}

// ── Row ───────────────────────────────────────────────────────────────────────

function LogRow({ entry }) {
  const avatarColors = [
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-600',
    'from-purple-400 to-purple-600',
    'from-indigo-400 to-indigo-600',
    'from-teal-400 to-teal-600',
  ];
  const colorIdx = entry.name.charCodeAt(0) % avatarColors.length;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors duration-150">
      <td className="px-4 py-3 text-sm font-medium text-gray-600 tabular-nums whitespace-nowrap">
        {fmtTime(entry.last_scan)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]}
                           flex items-center justify-center text-white text-xs font-bold shrink-0`}>
            {initials(entry.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{entry.name}</p>
            <p className="text-xs text-gray-400 font-mono">{entry.id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <TypeBadge type={entry.type} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{entry.class || '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={entry.status} recordType={entry.type} />
      </td>
      <td className="px-4 py-3">
        <PunctualityBadge status={entry.punctuality} />
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AttendanceLog({ data, loading, selectedDate, onDateChange }) {
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');

  const entries = useMemo(() => {
    const list = [];

    // Students
    if (data?.students_by_class) {
      Object.entries(data.students_by_class).forEach(([cls, students]) => {
        students.forEach((s) => {
          list.push({
            id:          s.student_id,
            name:        s.name,
            type:        'student',
            class:       cls,
            status:      s.status,
            punctuality: s.arrival_comments,
            last_scan:   s.last_scan,
          });
        });
      });
    }

    // Teachers
    if (data?.teachers) {
      data.teachers.forEach((t) => {
        list.push({
          id:          t.barcode_id,
          name:        t.full_name,
          type:        'teacher',
          class:       t.staff_type,
          status:      t.status,
          punctuality: t.status === 'checked_out' ? (t.check_out_status || t.check_in_status) : t.check_in_status,
          last_scan:   t.last_scan,
        });
      });
    }

    // Sort: pending (no scan) last, rest by scan time newest-first
    return list.sort((a, b) => {
      if (!a.last_scan && !b.last_scan) return a.name.localeCompare(b.name);
      if (!a.last_scan) return 1;
      if (!b.last_scan) return -1;
      return new Date(b.last_scan) - new Date(a.last_scan);
    });
  }, [data]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter   !== 'all' && e.type   !== typeFilter)   return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [entries, typeFilter, statusFilter, search]);

  const scanned  = entries.filter((e) => e.last_scan).length;
  const pending  = entries.filter((e) => !e.last_scan).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Live Attendance Log</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {scanned} scanned · {pending} not yet arrived · {entries.length} total
            </p>
          </div>
          {/* Date picker */}
          <input type="date" value={selectedDate}
            onChange={(e) => onDateChange?.(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium
                       bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search name or ID…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-44
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Type filter */}
          <div className="flex gap-1">
            {[
              { v: 'all',     l: 'All' },
              { v: 'student', l: 'Students' },
              { v: 'teacher', l: 'Staff' },
            ].map(({ v, l }) => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium
                       bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Statuses</option>
            <option value="arrived">Arrived</option>
            <option value="departed">Departed</option>
            <option value="pending">Not yet arrived</option>
            <option value="checked_in">Checked In</option>
            <option value="checked_out">Checked Out</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
          <svg className="animate-spin w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Loading attendance data…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm font-medium text-gray-500">No records match your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                {['Time', 'Name', 'Type', 'Class / Dept', 'Status', 'Punctuality'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((e) => (
                <LogRow key={`${e.type}-${e.id}`} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 60 && (
        <div className="px-5 py-3 border-t border-gray-100 text-center text-xs text-gray-400">
          Showing 60 of {filtered.length} records
        </div>
      )}
    </div>
  );
}
