import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getTemplates, updateTemplate } from '../services/api';
import AppHeader from '../components/AppHeader';

// ── Template catalogue ────────────────────────────────────────────────────────

const GROUPS = [
  {
    label: 'Parent Notifications',
    items: [
      {
        key: 'parent_arrival_email',
        label: 'Arrival — Email',
        channel: 'email',
        variables: ['student_name', 'class', 'arrival_time', 'school_name'],
        defaultSubject: 'Your child has arrived at school',
        defaultBody:
          'Dear Parent/Guardian,\n\nYour child {student_name} ({class}) has arrived at school today at {arrival_time}.\n\nYour child is safe. Have a great day!\n\n{school_name}',
      },
      {
        key: 'parent_arrival_whatsapp',
        label: 'Arrival — WhatsApp',
        channel: 'whatsapp',
        variables: ['student_name', 'arrival_time', 'school_name'],
        defaultBody:
          'Hi! Your child *{student_name}* has arrived at {school_name} at *{arrival_time}*. They are safe!\n- {school_name}',
      },
      {
        key: 'parent_departure_email',
        label: 'Departure — Email',
        channel: 'email',
        variables: ['student_name', 'departure_time', 'school_name'],
        defaultSubject: 'Your child has left school',
        defaultBody:
          'Dear Parent/Guardian,\n\nYour child {student_name} has left school today at {departure_time}.\n\nPlease ensure someone is available to receive them.\n\n{school_name}',
      },
      {
        key: 'parent_departure_whatsapp',
        label: 'Departure — WhatsApp',
        channel: 'whatsapp',
        variables: ['student_name', 'departure_time', 'school_name'],
        defaultBody:
          'Hi! Your child *{student_name}* has left {school_name} at *{departure_time}*. Please be ready!\n- {school_name}',
      },
    ],
  },
  {
    label: 'Admin Alerts',
    items: [
      {
        key: 'admin_late_arrival_email',
        label: 'Late Arrival Alert',
        channel: 'email',
        variables: ['student_name', 'class', 'arrival_time', 'school_name'],
        defaultSubject: 'Late Arrival: {student_name}',
        defaultBody:
          'Hello Admin,\n\nStudent {student_name} ({class}) arrived LATE at {arrival_time}.\n\nStandard arrival time is 9:00 AM. Please follow up if needed.\n\n{school_name}',
      },
      {
        key: 'admin_non_arrival_email',
        label: 'Non-Arrival Alert',
        channel: 'email',
        variables: ['student_name', 'class', 'time', 'school_name'],
        defaultSubject: 'Non-Arrival: {student_name}',
        defaultBody:
          'Hello Admin,\n\nStudent {student_name} ({class}) has NOT arrived as of {time}.\n\nPlease contact the parent immediately.\n\n{school_name}',
      },
      {
        key: 'admin_non_departure_email',
        label: 'Non-Departure Alert',
        channel: 'email',
        variables: ['student_name', 'class', 'time', 'school_name'],
        defaultSubject: 'Student Still at School: {student_name}',
        defaultBody:
          'Hello Admin,\n\nStudent {student_name} ({class}) has NOT departed as of {time}.\n\nPlease check on their status immediately.\n\n{school_name}',
      },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

function ChannelBadge({ channel }) {
  return channel === 'email' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold
                     bg-blue-100 text-blue-700">
      ✉ Email
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold
                     bg-green-100 text-green-700">
      💬 WhatsApp
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TemplateCustomization() {
  const [templates,    setTemplates]    = useState({});
  const [loading,      setLoading]      = useState(true);
  const [selectedKey,  setSelectedKey]  = useState(ALL_ITEMS[0].key);
  const [draft,        setDraft]        = useState({ subject: '', body: '' });
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);

  const selectedMeta = ALL_ITEMS.find((t) => t.key === selectedKey);

  // ── Load templates from API ─────────────────────────────────────────────────
  useEffect(() => {
    getTemplates()
      .then(({ data }) => setTemplates(data))
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  // ── Populate draft when selection changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedMeta) return;
    const saved = templates[selectedKey];
    setDraft({
      subject: saved?.subject ?? selectedMeta.defaultSubject ?? '',
      body:    saved?.body    ?? selectedMeta.defaultBody    ?? '',
    });
    setDirty(false);
  }, [selectedKey, templates]);

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!draft.body.trim()) {
      toast.error('Message body cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const { data } = await updateTemplate(selectedKey, {
        subject: draft.subject || null,
        body:    draft.body,
      });
      setTemplates((prev) => ({ ...prev, [selectedKey]: data.template }));
      setDirty(false);
      toast.success('Template saved');
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!selectedMeta) return;
    setDraft({
      subject: selectedMeta.defaultSubject ?? '',
      body:    selectedMeta.defaultBody    ?? '',
    });
    setDirty(true);
  };

  const insertVariable = (v) => {
    setDraft((prev) => ({ ...prev, body: prev.body + `{${v}}` }));
    setDirty(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">

      <AppHeader subtitle="Message Templates" />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── Left: template list ─────────────────────────────────────── */}
            <div className="space-y-4">
              {GROUPS.map((group) => (
                <div key={group.label} className="bg-white rounded-2xl shadow-sm
                                                   border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {group.label}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.items.map((item) => {
                      const isCustomised = !!templates[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => setSelectedKey(item.key)}
                          className={`w-full text-left px-4 py-3 flex items-center
                                      justify-between gap-2 transition-colors
                                      ${selectedKey === item.key
                                        ? 'bg-blue-50 border-l-4 border-blue-600'
                                        : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
                        >
                          <div>
                            <p className={`text-sm font-semibold ${
                              selectedKey === item.key ? 'text-blue-700' : 'text-gray-800'
                            }`}>
                              {item.label}
                            </p>
                            {isCustomised && (
                              <p className="text-xs text-green-600 mt-0.5">Customised</p>
                            )}
                          </div>
                          <ChannelBadge channel={item.channel} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* SQL hint */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">Setup Required</p>
                <p className="text-xs text-amber-600">
                  Run the <code className="bg-amber-100 px-1 rounded">message_templates</code> SQL
                  migration in Supabase before using custom templates. See README.md.
                </p>
              </div>
            </div>

            {/* ── Right: editor ───────────────────────────────────────────── */}
            {selectedMeta && (
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedMeta.label}</h2>
                      <div className="mt-1">
                        <ChannelBadge channel={selectedMeta.channel} />
                      </div>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Reset to default
                    </button>
                  </div>

                  {/* Subject (email only) */}
                  {selectedMeta.channel === 'email' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Email Subject
                      </label>
                      <input
                        type="text"
                        value={draft.subject}
                        onChange={(e) => handleChange('subject', e.target.value)}
                        placeholder="Email subject line"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Variables like <code className="bg-gray-100 px-1 rounded">{'{student_name}'}</code> work in the subject too.
                      </p>
                    </div>
                  )}

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Message Body
                    </label>
                    <textarea
                      value={draft.body}
                      onChange={(e) => handleChange('body', e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                                 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500
                                 resize-y"
                      placeholder="Write your message here. Use {variable_name} for dynamic content."
                    />
                  </div>

                  {/* Variables */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      Available variables — click to insert:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedMeta.variables.map((v) => (
                        <button
                          key={v}
                          onClick={() => insertVariable(v)}
                          className="inline-flex items-center px-2.5 py-1 bg-gray-100
                                     hover:bg-blue-100 hover:text-blue-700 text-gray-700
                                     rounded-lg text-xs font-mono font-semibold transition-colors"
                        >
                          {`{${v}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={handleSave}
                      disabled={saving || !dirty}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700
                                 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                    stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Saving…
                        </>
                      ) : 'Save Changes'}
                    </button>
                    {dirty && (
                      <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
                    )}
                  </div>
                </div>

                {/* Preview card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Preview (variables shown as placeholders)
                  </p>
                  {selectedMeta.channel === 'email' && draft.subject && (
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Subject: {draft.subject}
                    </p>
                  )}
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans
                                  bg-gray-50 border border-gray-200 rounded-xl p-4 leading-relaxed">
                    {draft.body}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
