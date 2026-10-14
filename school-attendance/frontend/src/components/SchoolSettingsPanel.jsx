import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getSchoolSettings, updateSchoolSettings } from '../services/api';

const DEFAULTS = {
  arrival_early_start:     '05:00',
  arrival_early_end:       '09:00',
  arrival_ontime_end:      '10:00',
  arrival_late_end:        '12:00',
  departure_start:         '14:00',
  departure_end:           '19:00',
  duplicate_scan_cooldown: '5',
  non_arrival_cutoff:      '12:00',
  non_departure_cutoff:    '18:00',
};

function fmtTime(val) {
  if (!val) return '--';
  const [h, m] = val.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function TimeField({ label, hint, field, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-gray-400 font-mono w-16 text-right">{fmtTime(value)}</span>
        <input
          type="time"
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
    </div>
  );
}

function NumberField({ label, hint, field, value, min, max, unit, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value || ''}
          min={min}
          max={max}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {unit && <span className="text-xs text-gray-500 w-12">{unit}</span>}
      </div>
    </div>
  );
}

export default function SchoolSettingsPanel() {
  const [form,    setForm]    = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    getSchoolSettings()
      .then(({ data }) => setForm({ ...DEFAULTS, ...data }))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSchoolSettings(form);
      toast.success('Settings saved — changes take effect within 60 seconds');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Time Windows & Scan Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure arrival windows, departure hours, and alert cutoffs. Changes apply server-side within 60 seconds.
        </p>
      </div>

      {/* Arrival windows */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Student Arrival Windows
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Scans before early-start or after late-end are marked "out of window"
          </p>
        </div>
        <div className="px-5 divide-y divide-gray-50">
          <TimeField label="Early arrival starts" hint="Before this = ignored; from this = EARLY"
            field="arrival_early_start" value={form.arrival_early_start} onChange={set} />
          <TimeField label="On-time starts (early ends)"
            hint={`${fmtTime(form.arrival_early_start)} – ${fmtTime(form.arrival_early_end)} = EARLY`}
            field="arrival_early_end" value={form.arrival_early_end} onChange={set} />
          <TimeField label="Late starts (on-time ends)"
            hint={`${fmtTime(form.arrival_early_end)} – ${fmtTime(form.arrival_ontime_end)} = ON TIME`}
            field="arrival_ontime_end" value={form.arrival_ontime_end} onChange={set} />
          <TimeField label="Window closes (late ends)"
            hint={`${fmtTime(form.arrival_ontime_end)} – ${fmtTime(form.arrival_late_end)} = LATE`}
            field="arrival_late_end" value={form.arrival_late_end} onChange={set} />
        </div>
        <div className="px-5 py-2.5 bg-blue-50/40 border-t border-blue-100">
          <p className="text-xs text-blue-700 font-medium">
            Summary: Early {fmtTime(form.arrival_early_start)}–{fmtTime(form.arrival_early_end)} ·
            On Time {fmtTime(form.arrival_early_end)}–{fmtTime(form.arrival_ontime_end)} ·
            Late {fmtTime(form.arrival_ontime_end)}–{fmtTime(form.arrival_late_end)}
          </p>
        </div>
      </div>

      {/* Departure window */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Student Departure Window
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Departure scans outside this window are marked "out of window"
          </p>
        </div>
        <div className="px-5 divide-y divide-gray-50">
          <TimeField label="Earliest valid departure"
            field="departure_start" value={form.departure_start} onChange={set} />
          <TimeField label="Latest valid departure"
            field="departure_end" value={form.departure_end} onChange={set} />
        </div>
        <div className="px-5 py-2.5 bg-blue-50/40 border-t border-blue-100">
          <p className="text-xs text-blue-700 font-medium">
            Valid departure window: {fmtTime(form.departure_start)} – {fmtTime(form.departure_end)}
          </p>
        </div>
      </div>

      {/* Scan guard + alert cutoffs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Scan Guard &amp; Alert Cutoffs
          </p>
        </div>
        <div className="px-5 divide-y divide-gray-50">
          <NumberField label="Duplicate scan cooldown"
            hint="Minimum seconds between two scans of the same barcode"
            field="duplicate_scan_cooldown" value={form.duplicate_scan_cooldown}
            min={1} max={60} unit="seconds" onChange={set} />
          <TimeField label="Non-arrival alert time"
            hint="Admin is notified about students who haven't arrived by this time"
            field="non_arrival_cutoff" value={form.non_arrival_cutoff} onChange={set} />
          <TimeField label="Non-departure alert time"
            hint="Admin is notified about students still on premises after this time"
            field="non_departure_cutoff" value={form.non_departure_cutoff} onChange={set} />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-semibold rounded-lg shadow-sm transition-colors
                     disabled:opacity-60 disabled:cursor-not-allowed">
          {saving && (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}
