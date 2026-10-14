import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getScanOverrides, upsertScanOverride, deleteScanOverride } from '../services/api';

// ── Icons ─────────────────────────────────────────────────────────────────────
const UnlockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function toLocalDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

const OVERRIDE_META = {
  allow: {
    label: 'Force Open',
    description: 'Allow scanning on this day even if it is a weekend or holiday.',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: <UnlockIcon />,
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  block: {
    label: 'Force Closed',
    description: 'Block scanning on this day even if it is a normal school day.',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    icon: <LockIcon />,
    iconBg: 'bg-rose-100 text-rose-600',
  },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ScanOverridesManager() {
  const [overrides, setOverrides] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  // Form state
  const today = toLocalDateString();
  const [form, setForm] = useState({
    override_date: today,
    override_type: 'allow',
    reason: '',
  });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getScanOverrides();
      setOverrides(data || []);
    } catch {
      toast.error('Failed to load scan overrides');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.override_date) return toast.error('Select a date');
    setSaving(true);
    try {
      await upsertScanOverride(form);
      toast.success(`Override saved for ${formatDateLabel(form.override_date)}`);
      setForm({ override_date: today, override_type: 'allow', reason: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save override');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dateStr) => {
    setDeleting(dateStr);
    try {
      await deleteScanOverride(dateStr);
      toast.success(`Override for ${formatDateLabel(dateStr)} removed`);
      setOverrides(prev => prev.filter(o => o.override_date !== dateStr));
    } catch {
      toast.error('Failed to remove override');
    } finally {
      setDeleting(null);
    }
  };

  // Split overrides into upcoming vs past
  const upcoming = overrides.filter(o => o.override_date >= today).sort((a, b) => a.override_date.localeCompare(b.override_date));
  const past     = overrides.filter(o => o.override_date <  today).sort((a, b) => b.override_date.localeCompare(a.override_date));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Scan Day Overrides</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Force-open or force-close scanning for specific dates, overriding the default weekend and holiday rules.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3a52] text-white rounded-lg text-sm font-medium hover:bg-[#2d5a7a] transition-colors"
        >
          <span className="text-lg leading-none">{showForm ? '−' : '+'}</span>
          Add Override
        </button>
      </div>

      {/* How it works callout */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
        <InfoIcon />
        <div className="space-y-1">
          <p><strong>Force Open</strong> — allows scanning on a weekend or holiday (e.g. open day, special event).</p>
          <p><strong>Force Closed</strong> — blocks scanning on a normal school day (e.g. emergency closure, internal exam day with no entry).</p>
          <p className="text-blue-600">Overrides take priority over all other rules. They can be deleted at any time to restore normal behaviour.</p>
        </div>
      </div>

      {/* Add override form */}
      {showForm && (
        <form onSubmit={handleSave} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
          <h3 className="font-medium text-gray-700">New Override</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <CalendarIcon />
                </span>
                <input
                  type="date"
                  value={form.override_date}
                  min={today}
                  onChange={e => setForm(f => ({ ...f, override_date: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a52]"
                  required
                />
              </div>
              {form.override_date && (
                <p className="text-xs text-gray-400 mt-1">
                  {formatDateLabel(form.override_date)}
                  {isWeekend(form.override_date) && (
                    <span className="ml-1 text-amber-500 font-medium">(weekend)</span>
                  )}
                </p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Override Type</label>
              <div className="flex gap-2">
                {['allow', 'block'].map(type => {
                  const meta = OVERRIDE_META[type];
                  const active = form.override_type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, override_type: type }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                        active
                          ? type === 'allow'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1">{OVERRIDE_META[form.override_type].description}</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder={form.override_type === 'allow' ? 'e.g. School Open Day' : 'e.g. Emergency closure'}
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a52]"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#1a3a52] text-white rounded-lg text-sm font-medium hover:bg-[#2d5a7a] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Override'}
            </button>
          </div>
        </form>
      )}

      {/* Overrides list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading overrides…</div>
      ) : overrides.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CalendarIcon />
          <p className="mt-3 text-sm font-medium text-gray-500">No overrides configured</p>
          <p className="text-xs text-gray-400 mt-1">Scanning follows the default weekend and holiday rules.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming / Active</h3>
              <div className="space-y-2">
                {upcoming.map(o => <OverrideRow key={o.id} override={o} onDelete={handleDelete} deleting={deleting} />)}
              </div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Past Overrides</h3>
              <div className="space-y-2 opacity-60">
                {past.map(o => <OverrideRow key={o.id} override={o} onDelete={handleDelete} deleting={deleting} isPast />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ── Single override row ───────────────────────────────────────────────────────
function OverrideRow({ override, onDelete, deleting, isPast = false }) {
  const meta = OVERRIDE_META[override.override_type] || OVERRIDE_META.allow;
  const isDeleting = deleting === override.override_date;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border ${meta.bg} ${meta.border}`}>
      {/* Type icon */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${meta.iconBg}`}>
        {meta.icon}
      </div>

      {/* Date + reason */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {formatDateLabel(override.override_date)}
        </p>
        {override.reason && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{override.reason}</p>
        )}
      </div>

      {/* Badge */}
      <span className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.badge}`}>
        {meta.icon} {meta.label}
      </span>

      {/* Delete */}
      {!isPast && (
        <button
          onClick={() => onDelete(override.override_date)}
          disabled={isDeleting}
          title="Remove override"
          className="flex-shrink-0 p-2 text-gray-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors disabled:opacity-40"
        >
          {isDeleting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <TrashIcon />
          )}
        </button>
      )}
    </div>
  );
}
