import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getSettings, saveSettings } from '../services/api';

const TOGGLES = [
  {
    section: 'Email Notifications',
    key: 'email_enabled',
    label: 'Enable Email Notifications',
    description: 'Send email alerts to parents and admins',
  },
  {
    section: 'WhatsApp Notifications',
    key: 'whatsapp_enabled',
    label: 'Enable WhatsApp Notifications',
    description: 'Send WhatsApp messages via Twilio',
  },
];

const PRIORITY_TOGGLES = [
  {
    key: 'notify_late_arrivals',
    label: 'Late Arrivals',
    description: 'Notify admin when a student arrives after 12:00 PM',
  },
  {
    key: 'notify_non_arrivals',
    label: 'Non-Arrivals',
    description: 'Notify admin when a student hasn\'t arrived by 12:00 PM',
  },
  {
    key: 'notify_non_departures',
    label: 'Non-Departures',
    description: 'Notify admin when a student hasn\'t left by 6:00 PM',
  },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2
                  border-transparent transition-colors duration-200 focus:outline-none
                  focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
                    ring-0 transition-transform duration-200
                    ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

export default function NotificationSettings({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  useEffect(() => {
    getSettings()
      .then(({ data }) => setSettings(data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success('Settings saved');
      onClose();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0
                   00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
                   .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-lg font-bold text-gray-900">Notification Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg
                       hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : settings ? (
          <div className="px-6 py-5 space-y-6">

            {/* Channel toggles */}
            <div className="space-y-4">
              {TOGGLES.map(({ section, key, label, description }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {section}
                  </p>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                    </div>
                    <Toggle
                      checked={!!settings[key]}
                      onChange={() => toggle(key)}
                      disabled={saving}
                    />
                  </div>
                </div>
              ))}
            </div>

            <hr className="border-gray-100" />

            {/* Priority toggles */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Priority Settings — When to notify admin
              </p>
              <div className="space-y-4">
                {PRIORITY_TOGGLES.map(({ key, label, description }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                    </div>
                    <Toggle
                      checked={!!settings[key]}
                      onChange={() => toggle(key)}
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-red-500 py-10">Could not load settings.</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border
                       border-gray-300 rounded-lg hover:bg-gray-50 transition-colors
                       disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || !settings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-semibold rounded-lg shadow-sm transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
