const STATUS = {
  arrived:  { label: '✓ Arrived',   cls: 'bg-green-100 text-green-800 border-green-200' },
  departed: { label: '↩ Departed',  cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  pending:  { label: '⏳ Pending',   cls: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const COMMENTS = {
  early:        { label: 'early',        cls: 'bg-emerald-100 text-emerald-800' },
  late:         { label: 'late',         cls: 'bg-orange-100  text-orange-700'  },
  invalid_time: { label: 'out-of-window', cls: 'bg-gray-100   text-gray-500'    },
};

function StatusBadge({ status }) {
  const cfg = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
                      text-xs font-semibold border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function CommentBadge({ comment }) {
  if (!comment) return null;
  const cfg = COMMENTS[comment];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-16 text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0
                 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2
                 2 0 012 2" />
          </svg>
          <p className="text-sm font-medium">{message}</p>
        </div>
      </td>
    </tr>
  );
}

export default function StudentsTable({ students, showClass = true }) {
  const cols = showClass ? 6 : 5;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Student
              </th>
              {showClass && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Class
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Arrived
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Departed
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.length === 0 ? (
              <EmptyRow colSpan={cols} message="No students match the selected filters" />
            ) : (
              students.map((s) => (
                <tr
                  key={s.student_id}
                  className={`transition-colors hover:bg-gray-50 ${
                    s.status === 'pending' ? 'bg-orange-50/40' : ''
                  }`}
                >
                  {/* Name + ID */}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.student_id}</p>
                  </td>

                  {/* Class */}
                  {showClass && (
                    <td className="px-4 py-3 text-gray-600 font-medium whitespace-nowrap">
                      {s.class}
                    </td>
                  )}

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>

                  {/* Arrival time */}
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">
                    {s.arrival_time ?? (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Departure time */}
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">
                    {s.departure_time ?? (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Arrival comments */}
                  <td className="px-4 py-3">
                    <CommentBadge comment={s.arrival_comments} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {students.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            {students.length} student{students.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
