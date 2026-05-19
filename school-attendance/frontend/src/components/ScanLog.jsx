const MAX_SCANS = 10;

function formatTime(ts) {
  if (!ts) return '--';
  const parsed = new Date(ts);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const [, timePart] = ts.split(' ');
  if (!timePart) return ts;
  const [h, m] = timePart.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function ActionBadge({ action }) {
  if (!action) return null;
  const actions = {
    arrival:   { label: 'ARRIVAL',   cls: 'bg-green-100 text-green-800' },
    departure: { label: 'DEPARTURE', cls: 'bg-blue-100 text-blue-800' },
    check_in:  { label: 'CHECK IN',  cls: 'bg-green-100 text-green-800' },
    check_out: { label: 'CHECK OUT', cls: 'bg-blue-100 text-blue-800' },
  };
  const cfg = actions[action] || { label: action, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function CommentBadge({ comment }) {
  if (!comment || comment === 'invalid_time') {
    if (comment === 'invalid_time') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
          out of window
        </span>
      );
    }
    return null;
  }
  const styles = {
    early:           'bg-emerald-100 text-emerald-800',
    on_time:         'bg-emerald-100 text-emerald-800',
    late:            'bg-orange-100 text-orange-700',
    early_departure: 'bg-orange-100 text-orange-700',
    late_checkout:   'bg-orange-100 text-orange-700',
  };
  const labels = {
    early:           'early',
    on_time:         'on time',
    late:            'late',
    early_departure: 'early out',
    late_checkout:   'late checkout',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styles[comment] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[comment] ?? comment}
    </span>
  );
}

function ScanRow({ scan }) {
  const isSuccess = scan.status === 'success';
  const isEntry = scan.action === 'arrival' || scan.action === 'check_in';

  const rowBg = !isSuccess
    ? 'bg-red-50 border-red-200'
    : isEntry
      ? 'bg-green-50 border-green-200'
      : 'bg-blue-50 border-blue-200';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border animate-slide-in ${rowBg}`}>
      <span className="w-20 text-sm font-mono text-gray-500 shrink-0">
        {formatTime(scan.timestamp)}
      </span>

      <div className="flex-1 min-w-0">
        {isSuccess ? (
          <>
            <p className="font-semibold text-gray-900 truncate">{scan.student_name}</p>
            <p className="text-xs text-gray-500">{scan.class || scan.staff_type}</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-red-700 truncate">Scan Error</p>
            <p className="text-xs text-red-500 truncate">{scan.error}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        {isSuccess && <ActionBadge action={scan.action} />}
        {isSuccess && <CommentBadge comment={scan.comments} />}
        {!isSuccess && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
            ERROR
          </span>
        )}
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-2">
      {scans.slice(0, MAX_SCANS).map((scan) => (
        <ScanRow key={scan.id} scan={scan} />
      ))}
      {scans.length >= MAX_SCANS && (
        <p className="text-center text-xs text-gray-400 pt-1">
          Showing last {MAX_SCANS} scans
        </p>
      )}
    </div>
  );
}
