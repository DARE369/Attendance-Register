import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTeachers, addTeacher, updateTeacher, deleteTeacher, getStaffTypes, getTeacherLogs } from '../services/api';
import StaffAnalyticsPanel from '../components/StaffAnalyticsPanel';

const EMPTY_FORM = {
  full_name:      '',
  staff_type:     '',
  barcode_id:     '',
  phone:          '',
  email:          '',
  assigned_class: '',
  notify_on_scan: false,
};

const STATUS_META = {
  on_time: { label: 'On Time',  cls: 'bg-green-100 text-green-700'  },
  late:    { label: 'Late',     cls: 'bg-red-100 text-red-700'      },
};

export default function TeacherManagement({ isEmbedded = false }) {
  const navigate = useNavigate();

  const [teachers,         setTeachers]         = useState([]);
  const [staffTypes,       setStaffTypes]        = useState([]);
  const [todayLogs,        setTodayLogs]         = useState({});
  const [loading,          setLoading]           = useState(true);
  const [search,           setSearch]            = useState('');
  const [filterType,       setFilterType]        = useState('all');
  const [modal,            setModal]             = useState(null);
  const [selected,         setSelected]          = useState(null);
  const [form,             setForm]              = useState(EMPTY_FORM);
  const [saving,           setSaving]            = useState(false);
  const [errors,           setErrors]            = useState({});
  const [analyticsTeacher, setAnalyticsTeacher]  = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [tRes, stRes, logRes] = await Promise.all([
        getTeachers(),
        getStaffTypes(),
        getTeacherLogs({ date: today }),
      ]);
      setTeachers(tRes.data.teachers || []);
      setStaffTypes((stRes.data.staff_types || []).filter(s => s.is_active));
      const logMap = {};
      for (const log of (logRes.data.logs || [])) {
        logMap[log.teacher_id] = log;
      }
      setTodayLogs(logMap);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const staffTypeOptions = useMemo(() =>
    ['all', ...new Set(teachers.map(t => t.staff_type).filter(Boolean).sort())],
  [teachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter(t => {
      if (filterType !== 'all' && t.staff_type !== filterType) return false;
      return !q ||
        t.full_name.toLowerCase().includes(q) ||
        t.staff_type.toLowerCase().includes(q) ||
        t.barcode_id.toLowerCase().includes(q) ||
        (t.assigned_class || '').toLowerCase().includes(q);
    });
  }, [teachers, search, filterType]);

  // Today's stats
  const checkedIn = useMemo(() =>
    filtered.filter(t => todayLogs[t.teacher_id]).length, [filtered, todayLogs]);
  const lateCount = useMemo(() =>
    filtered.filter(t => todayLogs[t.teacher_id]?.check_in_status === 'late').length, [filtered, todayLogs]);
  const pendingCount = useMemo(() =>
    filtered.filter(t => t.is_active && !todayLogs[t.teacher_id]).length, [filtered, todayLogs]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM, staff_type: staffTypes[0]?.staff_type || '' });
    setErrors({});
    setSelected(null);
    setModal('add');
  }

  function openEdit(teacher) {
    setForm({
      full_name:      teacher.full_name,
      staff_type:     teacher.staff_type,
      barcode_id:     teacher.barcode_id,
      phone:          teacher.phone          || '',
      email:          teacher.email          || '',
      assigned_class: teacher.assigned_class || '',
      notify_on_scan: teacher.notify_on_scan || false,
    });
    setErrors({});
    setSelected(teacher);
    setModal('edit');
  }

  function openDelete(teacher) { setSelected(teacher); setModal('delete'); }
  function closeModal() { setModal(null); setSelected(null); setSaving(false); }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.full_name.trim())  e.full_name  = 'Required';
    if (!form.staff_type.trim()) e.staff_type = 'Required';
    if (!form.barcode_id.trim()) e.barcode_id = 'Required';
    if (form.phone && !/^\+?\d{7,15}$/.test(form.phone.trim()))
      e.phone = 'Invalid phone (e.g. +2348012345678)';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        full_name:      form.full_name.trim(),
        staff_type:     form.staff_type.trim(),
        barcode_id:     form.barcode_id.trim().toUpperCase(),
        phone:          form.phone.trim()          || null,
        email:          form.email.trim()          || null,
        assigned_class: form.assigned_class.trim() || null,
        notify_on_scan: form.notify_on_scan,
      };
      if (modal === 'add') {
        await addTeacher(payload);
        toast.success(`${form.full_name.trim()} added`);
      } else {
        await updateTeacher(selected.teacher_id, payload);
        toast.success('Teacher updated');
      }
      closeModal();
      loadAll();
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed';
      if (err.response?.status === 409) setErrors(e => ({ ...e, barcode_id: msg }));
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteTeacher(selected.teacher_id);
      toast.success(`${selected.full_name} deleted`);
      closeModal();
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(teacher) {
    try {
      await updateTeacher(teacher.teacher_id, { is_active: !teacher.is_active });
      loadAll();
    } catch { toast.error('Update failed'); }
  }

  async function toggleNotify(teacher) {
    try {
      await updateTeacher(teacher.teacher_id, { notify_on_scan: !teacher.notify_on_scan });
      loadAll();
    } catch { toast.error('Update failed'); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const inner = (
    <div className={isEmbedded ? '' : 'max-w-6xl mx-auto px-4 py-6'}>

      {/* Today's stats bar */}
      {!loading && (
        <div className="mb-4 flex flex-wrap gap-4 bg-white rounded-xl border border-gray-200 px-5 py-3 text-sm shadow-sm">
          <Stat label="Checked In" value={checkedIn} total={filtered.length} color="text-green-600" />
          <span className="text-gray-200">|</span>
          <Stat label="Late"       value={lateCount}   color="text-red-500" />
          <span className="text-gray-200">|</span>
          <Stat label="Pending"    value={pendingCount} color="text-orange-500" />
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name, type, barcode, class…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-60 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {staffTypeOptions.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} staff</span>
        <div className="flex-1" />
        <button onClick={openAdd}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
          + Add Teacher
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {search || filterType !== 'all'
              ? 'No staff match your filters.'
              : 'No teachers yet. Click + Add Teacher to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-left">Barcode</th>
                  <th className="px-4 py-3 text-left">Today</th>
                  <th className="px-4 py-3 text-center">Notify</th>
                  <th className="px-4 py-3 text-center">Active</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => {
                  const log     = todayLogs[t.teacher_id];
                  const ciMeta  = log?.check_in_status ? STATUS_META[log.check_in_status] : null;
                  const ciTime  = log?.check_in_time
                    ? new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : null;

                  return (
                    <tr key={t.teacher_id} className="hover:bg-gray-50 transition-colors">
                      {/* Name + email stacked */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{t.full_name}</p>
                        {t.email && (
                          <p className="text-xs text-gray-400 mt-0.5">{t.email}</p>
                        )}
                      </td>

                      {/* Staff type */}
                      <td className="px-4 py-3">
                        <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {t.staff_type}
                        </span>
                      </td>

                      {/* Assigned class */}
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {t.assigned_class || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Barcode */}
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs">{t.barcode_id}</td>

                      {/* Today's status */}
                      <td className="px-4 py-3">
                        {log ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-gray-700">{ciTime}</span>
                            {ciMeta && (
                              <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full ${ciMeta.cls}`}>
                                {ciMeta.label}
                              </span>
                            )}
                            {log.check_out_time && (
                              <span className="text-xs text-indigo-600 font-medium">
                                Out {new Date(log.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">Not in yet</span>
                        )}
                      </td>

                      {/* Notify toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleNotify(t)}
                          title={t.notify_on_scan ? 'Notifications on — click to disable' : 'Notifications off — click to enable'}
                          className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-colors ${
                            t.notify_on_scan
                              ? 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </button>
                      </td>

                      {/* Active toggle */}
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleActive(t)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer ${
                            t.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setAnalyticsTeacher(t)}
                            title="View analytics"
                            className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEdit(t)}
                            title="Edit"
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDelete(t)}
                            title="Delete"
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Add Teacher' : 'Edit Teacher'} onClose={closeModal}>
          <div className="space-y-4">
            <Field label="Full Name" error={errors.full_name}>
              <input value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Mrs. Funke Adeyemi"
                className={inputCls(errors.full_name)} />
            </Field>
            <Field label="Staff Type" error={errors.staff_type}>
              <select value={form.staff_type}
                onChange={e => setForm({ ...form, staff_type: e.target.value })}
                className={inputCls(errors.staff_type)}>
                <option value="">— Select —</option>
                {staffTypes.map(st => (
                  <option key={st.staff_type} value={st.staff_type}>{st.staff_type}</option>
                ))}
              </select>
            </Field>
            <Field label="Barcode ID" error={errors.barcode_id}>
              <input value={form.barcode_id}
                onChange={e => setForm({ ...form, barcode_id: e.target.value })}
                placeholder="e.g. TCH001"
                className={inputCls(errors.barcode_id)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone (optional)" error={errors.phone}>
                <input value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+2348012345678"
                  className={inputCls(errors.phone)} />
              </Field>
              <Field label="Email (optional)" error={errors.email}>
                <input value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="teacher@school.edu"
                  className={inputCls(errors.email)} />
              </Field>
            </div>

            <Field label="Assigned Class (optional)">
              <input value={form.assigned_class}
                onChange={e => setForm({ ...form, assigned_class: e.target.value })}
                placeholder="e.g. Primary 3A"
                className={inputCls()} />
            </Field>

            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-semibold text-gray-800">Notify on student scan</p>
                <p className="text-xs text-gray-500 mt-0.5">Send WhatsApp when assigned class students scan in/out</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, notify_on_scan: !form.notify_on_scan })}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${form.notify_on_scan ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200
                  ${form.notify_on_scan ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={closeModal} disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {modal === 'delete' && selected && (
        <Modal title="Delete Teacher" onClose={closeModal}>
          <p className="text-gray-700 text-sm">
            Delete <span className="font-semibold">{selected.full_name}</span>?
            Their attendance records will be preserved.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={closeModal} disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleDelete} disabled={saving}
              className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {analyticsTeacher && (
        <StaffAnalyticsPanel teacher={analyticsTeacher} onClose={() => setAnalyticsTeacher(null)} />
      )}
    </div>
  );

  if (isEmbedded) return inner;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="text-blue-100 hover:text-white transition-colors text-sm">
            ← Dashboard
          </button>
          <span className="text-blue-300">|</span>
          <h1 className="text-xl font-bold">Teacher Management</h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{inner}</main>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Stat({ label, value, total, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold ${color}`}>
        {value}{total != null ? `/${total}` : ''}
      </span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
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
