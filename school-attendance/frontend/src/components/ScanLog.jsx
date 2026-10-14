function formatTime(ts) {
  if (!ts) return '--';
  try {
    const raw = ts.includes('T') ? ts.split('T')[1] : ts.split(' ')[1] ?? ts;
    const clean = raw.replace(/\+.*|Z/, '');
    const [h, m] = clean.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch { return ts; }
}

const ACTION_CFG = {
  arrival:   { label: 'Arrival',   short: 'IN',  cls: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  departure: { label: 'Departure', short: 'OUT', cls: 'bg-blue-100 text-blue-800',   dot: 'bg-blue-500'  },
  check_in:  { label: 'Check In',  short: 'IN',  cls: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  check_out: { label: 'Check Out', short: 'OUT', cls: 'bg-blue-100 text-blue-800',   dot: 'bg-blue-500'  },
};

const COMMENT_CFG = {
  early:           { label: 'Early',         cls: 'text-emerald-600' },
  on_time:         { label: 'On Time',       cls: 'text-emerald-600' },
  late:            { label: 'Late',          cls: 'text-orange-500'  },
  early_departure: { label: 'Early Out',     cls: 'text-orange-500'  },
  late_checkout:   { label: 'Late Out',      cls: 'text-orange-500'  },
  invalid_time:    { label: 'Out of window', cls: 'text-gray-400'    },
};

function actionCfg(action) {
  return ACTION_CFG[action] || { label: action, short: '?', cls: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
}

// A scan is a staff scan if it has staff_type (teacher service sets this) and no class
function isStaff(scan) {
  return Boolean(scan.staff_type) && !scan.class;
}

// ── Latest scan — large prominent card ───────────────────────────────────────

function LatestScanCard({ scan }) {
  const isSuccess = scan.status === 'success';
  const isEntry   = scan.action === 'arrival' || scan.action === 'check_in';
  const cfg       = actionCfg(scan.action);
  const comment   = COMMENT_CFG[scan.comments];
  const staff     = isStaff(scan);

  const bg = !isSuccess ? 'from-red-50 to-red-100 border-red-200'
           : isEntry    ? 'from-green-50 to-emerald-100 border-green-200'
           :              'from-blue-50 to-indigo-100 border-blue-200';

  const iconBg = !isSuccess ? 'bg-red-500'
               : isEntry    ? 'bg-green-500'
               :              'bg-blue-500';

  return (
    <div className={`rounded-2xl border-2 bg-gradient-to-br ${bg} p-4 flex items-center gap-4 animate-slide-in`}>
      {/* Icon */}
      <div className={`${iconBg} w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-md`}>
        {isSuccess ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        {isSuccess ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-900 text-base leading-tight truncate">
                {scan.student_name}
              </p>
              {/* STAFF / STUDENT badge */}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                staff
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-sky-100 text-sky-700'
              }`}>
                {staff ? 'STAFF' : 'STUDENT'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {scan.class || scan.staff_type || ''}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-red-700 text-base leading-tight">Scan Error</p>
            <p className="text-xs text-red-500 mt-0.5 truncate">{scan.error}</p>
          </>
        )}
      </div>

      {/* Right: badges + time */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {isSuccess && (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
            {cfg.label.toUpperCase()}
          </span>
        )}
        {isSuccess && comment && (
          <span className={`text-xs font-semibold ${comment.cls}`}>{comment.label}</span>
        )}
        {!isSuccess && (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">ERROR</span>
        )}
        <span className="text-xs font-mono text-gray-400 mt-0.5">{formatTime(scan.timestamp)}</span>
      </div>
    </div>
  );
}

// ── History row — compact table row ──────────────────────────────────────────

function HistoryRow({ scan, index }) {
  const isSuccess = scan.status === 'success';
  const cfg       = actionCfg(scan.action);
  const comment   = COMMENT_CFG[scan.comments];
  const staff     = isStaff(scan);

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/80 transition-colors ${index % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
      <td className="px-3 py-2 text-xs font-mono text-gray-400 whitespace-nowrap w-20">
        {formatTime(scan.timestamp)}
      </td>
      <td className="px-3 py-2 max-w-0 w-full">
        {isSuccess ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-gray-800 truncate">{scan.student_name}</span>
            <span className={`text-xs font-bold px-1 py-0.5 rounded shrink-0 ${
              staff ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
            }`}>
              {staff ? 'S' : 'ST'}
            </span>
            {(scan.class || scan.staff_type) && (
              <span className="text-xs text-gray-400 truncate hidden sm:block">
                {scan.class || scan.staff_type}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm font-semibold text-red-500 truncate block">{scan.error || 'Error'}</span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {isSuccess ? (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <span className="text-xs font-semibold text-gray-600">{cfg.short}</span>
          </div>
        ) : (
          <span className="text-xs font-bold text-red-500">ERR</span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {comment && isSuccess && (
          <span className={`text-xs font-medium ${comment.cls}`}>{comment.label}</span>
        )}
      </td>
    </tr>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ScanLog({ scans }) {
  if (scans.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm font-medium">No scans yet today</p>
        <p className="text-xs mt-1">Scan results will appear here in real time</p>
      </div>
    );
  }

  const [latest, ...rest] = scans;

  return (
    <div className="flex flex-col gap-3">
      {/* Latest scan — prominent */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Latest</p>
        <LatestScanCard scan={latest} />
      </div>

      {/* History — compact scrollable table */}
      {rest.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Previous ({rest.length})
          </p>
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
              <table className="w-full text-left">
                <tbody>
                  {rest.map((scan, i) => (
                    <HistoryRow key={scan.id} scan={scan} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
