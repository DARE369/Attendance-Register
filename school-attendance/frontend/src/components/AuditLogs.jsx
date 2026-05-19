import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAuditLogs } from '../services/api';

const ACTION_META = {
  add_student:     { label: 'Add Student',    icon: '➕', cls: 'bg-green-100 text-green-800' },
  edit_student:    { label: 'Edit Student',   icon: '✏️', cls: 'bg-blue-100 text-blue-800' },
  delete_student:  { label: 'Delete Student', icon: '🗑', cls: 'bg-red-100 text-red-800' },
  add_teacher:     { label: 'Add Teacher',    icon: '➕', cls: 'bg-green-100 text-green-800' },
  edit_teacher:    { label: 'Edit Teacher',   icon: '✏️', cls: 'bg-blue-100 text-blue-800' },
  delete_teacher:  { label: 'Delete Teacher', icon: '🗑', cls: 'bg-red-100 text-red-800' },
  add_staff_type:  { label: 'Add Staff Type', icon: '➕', cls: 'bg-green-100 text-green-800' },
  edit_staff_type: { label: 'Edit Staff Type', icon: '⚙️', cls: 'bg-yellow-100 text-yellow-800' },
};

function fmtDateTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

export default function AuditLogs({ isEmbedded = false }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [offset,  setOffset]  = useState(0);

  const LIMIT = 50;

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const { data } = await getAuditLogs({ limit: LIMIT, offset: off });
      setLogs(data.logs || []);
      setOffset(off);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  const filtered = logs.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'add')    return l.action?.startsWith('add_');
    if (filter === 'edit')   return l.action?.startsWith('edit_');
    if (filter === 'delete') return l.action?.startsWith('delete_');
    return true;
  });

  const content = (
    <div className="space-y-5">
      {!isEmbedded && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500 mt-0.5">All admin actions recorded</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: 'all',    l: 'All Actions' },
          { v: 'add',    l: 'Added' },
          { v: 'edit',   l: 'Edited' },
          { v: 'delete', l: 'Deleted' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === v
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
            }`}>
            {l}
          </button>
        ))}
        <button onClick={() => load(0)}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-white
                     text-gray-600 border border-gray-300 hover:border-gray-400 transition-colors">
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <svg className="animate-spin w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm">Loading audit logs…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm font-medium text-gray-500">No audit records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Time', 'Action', 'Record', 'Description', 'Admin'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((log, i) => {
                  const meta = ACTION_META[log.action] ?? {
                    label: (log.action || '').replace(/_/g, ' '),
                    icon: '•',
                    cls: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {fmtDateTime(log.timestamp)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1
                                         rounded-full text-xs font-semibold ${meta.cls}`}>
                          <span>{meta.icon}</span>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 font-mono">
                        {log.record_id?.slice(0, 12) || log.table_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-700 max-w-xs truncate">
                        {log.description || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {log.admin_id ? `Admin #${log.admin_id}` : 'System'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {filtered.length} records</span>
            <div className="flex gap-2">
              {offset > 0 && (
                <button onClick={() => load(Math.max(0, offset - LIMIT))}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 font-medium">
                  ← Prev
                </button>
              )}
              {logs.length === LIMIT && (
                <button onClick={() => load(offset + LIMIT)}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 font-medium">
                  Next →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">Audit Logs</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">{content}</main>
    </div>
  );
}
