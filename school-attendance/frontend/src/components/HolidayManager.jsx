import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getHolidays, addHoliday, updateHoliday, deleteHoliday } from '../services/api';

const EMPTY_FORM = {
  holiday_name: '',
  holiday_date: '',
  holiday_type: 'national',
  applies_to:   'both',
  description:  '',
};

const TYPE_COLORS = {
  national: 'bg-blue-100 text-blue-800',
  state:    'bg-purple-100 text-purple-800',
  custom:   'bg-gray-100 text-gray-700',
};

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

export default function HolidayManager({ isEmbedded = false }) {
  const [holidays,  setHolidays]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await getHolidays();
      setHolidays(data.holidays || []);
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!form.holiday_name.trim()) return toast.error('Holiday name is required');
    if (!form.holiday_date)        return toast.error('Date is required');
    setSaving(true);
    try {
      await addHoliday({
        holiday_name: form.holiday_name.trim(),
        holiday_date: form.holiday_date,
        holiday_type: form.holiday_type,
        applies_to:   form.applies_to,
        description:  form.description.trim() || null,
      });
      toast.success('Holiday added');
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(h) {
    try {
      await updateHoliday(h.holiday_id, { is_active: !h.is_active });
      toast.success(`${h.holiday_name} ${h.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch {
      toast.error('Failed to update holiday');
    }
  }

  async function handleDelete(h) {
    if (!window.confirm(`Delete "${h.holiday_name}"?`)) return;
    try {
      await deleteHoliday(h.holiday_id);
      toast.success('Holiday deleted');
      load();
    } catch {
      toast.error('Failed to delete holiday');
    }
  }

  const inner = (
    <div className={isEmbedded ? '' : 'max-w-5xl mx-auto px-4 py-6'}>

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Holidays are excluded from attendance tracking and notifications.
        </p>
        <button onClick={() => setShowForm((p) => !p)}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm
                     hover:bg-blue-700 transition-colors shrink-0">
          + Add Holiday
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5 space-y-4">
          <h3 className="font-bold text-gray-800">New Holiday</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Holiday Name</label>
              <input value={form.holiday_name}
                onChange={(e) => setForm({ ...form, holiday_name: e.target.value })}
                placeholder="e.g. Eid al-Fitr"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input type="date" value={form.holiday_date}
                onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
              <select value={form.holiday_type}
                onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="national">National</option>
                <option value="state">State</option>
                <option value="custom">Custom / School</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Applies To</label>
              <select value={form.applies_to}
                onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="both">Students & Staff</option>
                <option value="students">Students Only</option>
                <option value="staff">Staff Only</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
              <input value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. School marks the end of Ramadan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg
                         hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : holidays.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No holidays configured. Click + Add Holiday to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Applies To</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holidays.map((h) => (
                <tr key={h.holiday_id}
                  className={`hover:bg-gray-50 transition-colors ${!h.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{h.holiday_name}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{fmtDate(h.holiday_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                      TYPE_COLORS[h.holiday_type] || TYPE_COLORS.custom
                    }`}>
                      {h.holiday_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{h.applies_to}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(h)}
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer ${
                        h.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {h.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(h)}
                      className="text-red-500 hover:text-red-700 font-medium text-xs">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbedded) return inner;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">Holiday Calendar</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{inner}</main>
    </div>
  );
}
