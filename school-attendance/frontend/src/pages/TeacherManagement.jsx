import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTeachers, addTeacher, updateTeacher, deleteTeacher, getStaffTypes } from '../services/api';
import StaffAnalyticsPanel from '../components/StaffAnalyticsPanel';

const EMPTY_FORM = { full_name: '', staff_type: '', barcode_id: '', phone: '', email: '' };

export default function TeacherManagement({ isEmbedded = false }) {
  const navigate = useNavigate();

  const [teachers,        setTeachers]        = useState([]);
  const [staffTypes,      setStaffTypes]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [modal,           setModal]           = useState(null);
  const [selected,        setSelected]        = useState(null);
  const [form,            setForm]            = useState(EMPTY_FORM);
  const [saving,          setSaving]          = useState(false);
  const [errors,          setErrors]          = useState({});
  const [analyticsTeacher, setAnalyticsTeacher] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [tRes, stRes] = await Promise.all([getTeachers(), getStaffTypes()]);
      setTeachers(tRes.data.teachers || []);
      setStaffTypes((stRes.data.staff_types || []).filter((s) => s.is_active));
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = teachers.filter((t) =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    t.staff_type.toLowerCase().includes(search.toLowerCase()) ||
    t.barcode_id.toLowerCase().includes(search.toLowerCase())
  );

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setForm({ ...EMPTY_FORM, staff_type: staffTypes[0]?.staff_type || '' });
    setErrors({});
    setSelected(null);
    setModal('add');
  }

  function openEdit(teacher) {
    setForm({
      full_name:  teacher.full_name,
      staff_type: teacher.staff_type,
      barcode_id: teacher.barcode_id,
      phone:      teacher.phone || '',
      email:      teacher.email || '',
    });
    setErrors({});
    setSelected(teacher);
    setModal('edit');
  }

  function openDelete(teacher) {
    setSelected(teacher);
    setModal('delete');
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setSaving(false);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate() {
    const e = {};
    if (!form.full_name.trim())   e.full_name   = 'Required';
    if (!form.staff_type.trim())  e.staff_type  = 'Required';
    if (!form.barcode_id.trim())  e.barcode_id  = 'Required';
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
      if (modal === 'add') {
        await addTeacher({
          full_name:  form.full_name.trim(),
          staff_type: form.staff_type.trim(),
          barcode_id: form.barcode_id.trim().toUpperCase(),
          phone:      form.phone.trim() || null,
          email:      form.email.trim() || null,
        });
        toast.success(`${form.full_name.trim()} added`);
      } else {
        await updateTeacher(selected.teacher_id, {
          full_name:  form.full_name.trim(),
          staff_type: form.staff_type.trim(),
          barcode_id: form.barcode_id.trim().toUpperCase(),
          phone:      form.phone.trim() || null,
          email:      form.email.trim() || null,
        });
        toast.success('Teacher updated');
      }
      closeModal();
      loadAll();
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed';
      if (err.response?.status === 409) {
        setErrors((e) => ({ ...e, barcode_id: msg }));
      } else {
        toast.error(msg);
      }
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
      toast.success(`${teacher.full_name} ${teacher.is_active ? 'deactivated' : 'activated'}`);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inner = (
    <div className={isEmbedded ? '' : 'max-w-6xl mx-auto px-4 py-6'}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by name, type, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">{filtered.length} teacher{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
          + Add Teacher
        </button>
      </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {search ? 'No teachers match your search.' : 'No teachers yet. Click + Add Teacher to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Staff Type</th>
                  <th className="px-4 py-3 text-left">Barcode ID</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => (
                  <tr key={t.teacher_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.full_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {t.staff_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">{t.barcode_id}</td>
                    <td className="px-4 py-3 text-gray-500">{t.phone || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(t)}
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer ${
                          t.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setAnalyticsTeacher(t)}
                        className="text-purple-600 hover:text-purple-800 font-medium mr-3 text-xs">
                        Analytics
                      </button>
                      <button onClick={() => openEdit(t)}
                        className="text-blue-600 hover:text-blue-800 font-medium mr-3 text-xs">
                        Edit
                      </button>
                      <button onClick={() => openDelete(t)}
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

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Add Teacher' : 'Edit Teacher'} onClose={closeModal}>
          <div className="space-y-4">
            <Field label="Full Name" error={errors.full_name}>
              <input value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Mrs. Funke Adeyemi"
                className={inputCls(errors.full_name)} />
            </Field>
            <Field label="Staff Type" error={errors.staff_type}>
              <select value={form.staff_type}
                onChange={(e) => setForm({ ...form, staff_type: e.target.value })}
                className={inputCls(errors.staff_type)}>
                <option value="">— Select —</option>
                {staffTypes.map((st) => (
                  <option key={st.staff_type} value={st.staff_type}>{st.staff_type}</option>
                ))}
              </select>
            </Field>
            <Field label="Barcode ID" error={errors.barcode_id}>
              <input value={form.barcode_id}
                onChange={(e) => setForm({ ...form, barcode_id: e.target.value })}
                placeholder="e.g. TCH001"
                className={inputCls(errors.barcode_id)} />
            </Field>
            <Field label="Phone (optional)" error={errors.phone}>
              <input value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+2348012345678"
                className={inputCls(errors.phone)} />
            </Field>
            <Field label="Email (optional)" error={errors.email}>
              <input value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="teacher@school.edu"
                className={inputCls(errors.email)} />
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
        <StaffAnalyticsPanel
          teacher={analyticsTeacher}
          onClose={() => setAnalyticsTeacher(null)}
        />
      )}
    </div>
  );

  if (isEmbedded) return inner;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="text-blue-100 hover:text-white transition-colors text-sm">
              ← Dashboard
            </button>
            <span className="text-blue-300">|</span>
            <h1 className="text-xl font-bold">Teacher Management</h1>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{inner}</main>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
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
