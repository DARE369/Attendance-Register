import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getFraudAlerts, updateFraudAlert } from '../services/api';

const SEV_STYLE = {
  high:   'bg-red-100 text-red-800 border border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  low:    'bg-blue-100 text-blue-800 border border-blue-200',
};

// Static chip styles — dynamic `bg-${col}-X` classes are stripped by Tailwind's compiler
const SEV_CHIP = {
  high:   'bg-red-50 text-red-700 border border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  low:    'bg-blue-50 text-blue-700 border border-blue-200',
};
const SEV_DOT = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-blue-500',
};

const PATTERN_LABEL = {
  same_time_scanning:    'Same-Time Scanning',
  unnatural_consistency: 'Unnatural Consistency',
  behavior_change:       'Behaviour Change',
};

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default function FraudAlertsPanel({ isEmbedded = false }) {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('unresolved');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resolved = filter === 'resolved' ? true : filter === 'unresolved' ? false : undefined;
      const params = resolved !== undefined ? { resolved } : {};
      const { data } = await getFraudAlerts(params);
      setAlerts(data.alerts || []);
    } catch {
      toast.error('Failed to load fraud alerts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(alert) {
    try {
      await updateFraudAlert(alert.alert_id, { is_resolved: true });
      toast.success('Alert marked as resolved');
      load();
    } catch {
      toast.error('Failed to resolve alert');
    }
  }

  const bySev = { high: 0, medium: 0, low: 0 };
  alerts.forEach((a) => { bySev[a.severity] = (bySev[a.severity] || 0) + 1; });

  const content = (
    <div className="space-y-5">
      {!isEmbedded && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Fraud Alerts</h2>
          <p className="text-sm text-gray-500 mt-0.5">Suspicious attendance patterns detected by the system</p>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        {(['high', 'medium', 'low']).map((sev) => (
          <div key={sev}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${SEV_CHIP[sev]}`}>
            <span className={`w-2 h-2 rounded-full ${SEV_DOT[sev]}`} />
            {bySev[sev] || 0} {sev}
          </div>
        ))}
        <button onClick={() => load()}
          className="ml-auto px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs
                     font-semibold text-gray-600 hover:border-gray-400 transition-colors">
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { v: 'unresolved', l: 'Unresolved' },
          { v: 'resolved',   l: 'Resolved'   },
          { v: 'all',        l: 'All'         },
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
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
            <svg className="animate-spin w-8 h-8 text-blue-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-medium text-gray-500">No fraud alerts found</p>
            <p className="text-xs mt-1 text-gray-400">Alerts are generated automatically by weekly pattern analysis</p>
          </div>
        ) : (
          alerts.map((a) => (
            <div key={a.alert_id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                a.is_resolved ? 'opacity-60' : ''
              }`}>
              <div className="flex items-start gap-4 p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === a.alert_id ? null : a.alert_id)}>
                <div className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                  SEV_STYLE[a.severity] || SEV_STYLE.low
                }`}>
                  {(a.severity || 'low').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">
                    {PATTERN_LABEL[a.pattern_type] || a.pattern_type}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {a.involved_names?.join(', ')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(a.flagged_date)}</p>
                </div>
                {a.is_resolved ? (
                  <span className="text-xs text-green-600 font-semibold shrink-0">Resolved</span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleResolve(a); }}
                    className="text-xs font-semibold px-3 py-1 bg-green-50 border border-green-200
                               text-green-700 rounded-lg hover:bg-green-100 transition-colors shrink-0">
                    Resolve
                  </button>
                )}
              </div>

              {/* Expanded detail */}
              {expanded === a.alert_id && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50 text-xs text-gray-700 space-y-2">
                  <p>{a.description}</p>
                  {a.evidence && typeof a.evidence === 'object' && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(a.evidence).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="font-semibold text-gray-500 capitalize w-32 shrink-0">
                            {k.replace(/_/g, ' ')}
                          </span>
                          <span>{typeof v === 'number' ? v.toFixed(2) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
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
          <h1 className="text-xl font-bold">Fraud Alerts</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">{content}</main>
    </div>
  );
}
