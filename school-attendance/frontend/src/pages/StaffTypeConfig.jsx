import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getStaffTypes, addStaffType, updateStaffType, deleteStaffType } from '../services/api';

const EMPTY_FORM = {
  staff_type:     '',
  check_in_start: '06:30',
  check_in_end:   '08:00',
  check_out_time: '15:00',
  check_out_end:  '18:00',
};

export default function StaffTypeConfig({ isEmbedded = false }) {
  const navigate = useNavigate();

  const [configs,        setConfigs]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [modal,          setModal]          = useState(null); // null | 'add' | 'edit'
  const [selected,       setSelected]       = useState(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [saving,         setSaving]         = useState(false);
  const [errors,         setErrors]         = useState({});
  const [confirmDelete,  setConfirmDelete]  = useState(null); // config_id awaiting confirmation
  const [deleting,       setDeleting]       = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await getStaffTypes();
      setConfigs(data.staff_types || []);
    } catch {
      toast.error('Failed to load staff types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setSelected(null);
    setModal('add');
  }

  function openEdit(config) {
    setForm({
      staff_type:     config.staff_type,
      check_in_start: config.check_in_start?.slice(0, 5) || '',
      check_in_end:   config.check_in_end?.slice(0, 5) || '',
      check_out_time: config.check_out_time?.slice(0, 5) || '',
      check_out_end:  config.check_out_end?.slice(0, 5) || config.check_out_time?.slice(0, 5) || '',
    });
    setErrors({});
    setSelected(config);
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setSaving(false);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const timeRe = /^\d{2}:\d{2}$/;
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  function validate() {
    const e = {};
    if (modal === 'add' && !form.staff_type.trim()) e.staff_type = 'Required';
    if (!form.check_in_start || !timeRe.test(form.check_in_start))  e.check_in_start = 'Required (HH:MM)';
    if (!form.check_in_end   || !timeRe.test(form.check_in_end))    e.check_in_end   = 'Required (HH:MM)';
    if (!form.check_out_time || !timeRe.test(form.check_out_time))  e.check_out_time = 'Required (HH:MM)';
    if (!form.check_out_end  || !timeRe.test(form.check_out_end))   e.check_out_end  = 'Required (HH:MM)';
    if (!e.check_out_time && !e.check_out_end && toMinutes(form.check_out_end) < toMinutes(form.check_out_time)) {
      e.check_out_end = 'Must not be before start';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        check_in_start: form.check_in_start + ':00',
        check_in_end:   form.check_in_end   + ':00',
        check_out_time: form.check_out_time + ':00',
        check_out_end:  form.check_out_end  + ':00',
      };

      if (modal === 'add') {
        payload.staff_type = form.staff_type.trim();
        await addStaffType(payload);
        toast.success(`Staff type '${payload.staff_type}' created`);
      } else {
        await updateStaffType(selected.config_id, payload);
        toast.success(`'${selected.staff_type}' updated`);
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(config) {
    setDeleting(true);
    try {
      await deleteStaffType(config.config_id);
      toast.success(`'${config.staff_type}' deleted`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(config) {
    try {
      await updateStaffType(config.config_id, { is_active: !config.is_active });
      toast.success(`'${config.staff_type}' ${config.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inner = (
    <div className={isEmbedded ? '' : 'max-w-5xl mx-auto px-4 py-6'}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Staff types define check-in/out time windows used when teachers scan their badges.
        </p>
        <button onClick={openAdd}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors shrink-0">
          + Add Type
        </button>
      </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : configs.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
            No staff types configured. Click + Add Type to begin.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {configs.map((c) => (
              <div key={c.config_id}
                className={`bg-white rounded-xl shadow p-5 border-l-4 ${
                  c.is_active ? 'border-blue-500' : 'border-gray-300 opacity-60'
                }`}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-800">{c.staff_type}</h3>
                  <button onClick={() => toggleActive(c)}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Check-in window</span>
                    <span className="font-medium">
                      {fmtTime(c.check_in_start)} - {fmtTime(c.check_in_end)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Check-out window</span>
                    <span className="font-medium">
                      {fmtTime(c.check_out_time)} - {fmtTime(c.check_out_end || c.check_out_time)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button onClick={() => openEdit(c)}
                    className="flex-1 text-center text-xs text-blue-600 hover:text-blue-800 font-medium py-1">
                    Edit times
                  </button>
                  {confirmDelete === c.config_id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-red-600 font-semibold">Delete?</span>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deleting}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-2 py-1 rounded disabled:opacity-50">
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        disabled={deleting}
                        className="text-xs text-gray-500 hover:text-gray-700 font-semibold px-2 py-1 rounded border border-gray-300">
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(c.config_id)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium py-1 px-1">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
             onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">
                {modal === 'add' ? 'Add Staff Type' : `Edit - ${selected.staff_type}`}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="space-y-4">
              {modal === 'add' && (
                <Field label="Staff Type Name" error={errors.staff_type}>
                  <input value={form.staff_type}
                    onChange={(e) => setForm({ ...form, staff_type: e.target.value })}
                    placeholder="e.g. Teacher"
                    className={inputCls(errors.staff_type)} />
                </Field>
              )}
              <Field label="Check-in window start" error={errors.check_in_start}>
                <input type="time" value={form.check_in_start}
                  onChange={(e) => setForm({ ...form, check_in_start: e.target.value })}
                  className={inputCls(errors.check_in_start)} />
              </Field>
              <Field label="Check-in window end (on-time deadline)" error={errors.check_in_end}>
                <input type="time" value={form.check_in_end}
                  onChange={(e) => setForm({ ...form, check_in_end: e.target.value })}
                  className={inputCls(errors.check_in_end)} />
              </Field>
              <Field label="Check-out window start" error={errors.check_out_time}>
                <input type="time" value={form.check_out_time}
                  onChange={(e) => setForm({ ...form, check_out_time: e.target.value })}
                  className={inputCls(errors.check_out_time)} />
              </Field>
              <Field label="Check-out window end" error={errors.check_out_end}>
                <input type="time" value={form.check_out_end}
                  onChange={(e) => setForm({ ...form, check_out_end: e.target.value })}
                  className={inputCls(errors.check_out_end)} />
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isEmbedded) return inner;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="text-blue-100 hover:text-white transition-colors text-sm">
              ← Dashboard
            </button>
            <span className="text-blue-300">|</span>
            <h1 className="text-xl font-bold">Staff Type Configuration</h1>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{inner}</main>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(error) {
  return `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}
