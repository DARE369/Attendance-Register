import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getStudents, addStudent, updateStudent, deleteStudent } from '../services/api';

const EMPTY_FORM = { student_id: '', full_name: '', class: '', parent_phone: '', parent_email: '' };

export default function StudentManagement({ isEmbedded = false }) {
  const navigate = useNavigate();

  const [students, setStudents]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState('');
  const [modal,    setModal]      = useState(null); // null | 'add' | 'edit' | 'delete'
  const [selected, setSelected]   = useState(null);
  const [form,     setForm]       = useState(EMPTY_FORM);
  const [saving,   setSaving]     = useState(false);
  const [errors,   setErrors]     = useState({});

  const load = useCallback(async () => {
    try {
      const { data } = await getStudents();
      setStudents(data.students || []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = students.filter((s) =>
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.class || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setSelected(null);
    setModal('add');
  }

  function openEdit(student) {
    setForm({
      student_id:   student.student_id,
      full_name:    student.full_name,
      class:        student.class,
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '',
    });
    setErrors({});
    setSelected(student);
    setModal('edit');
  }

  function openDelete(student) {
    setSelected(student);
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
    if (!form.student_id.trim()) e.student_id = 'Required';
    else if (!/^[A-Z0-9\-_]{1,20}$/i.test(form.student_id.trim())) e.student_id = 'Alphanumeric, max 20 chars';
    if (!form.full_name.trim()) e.full_name = 'Required';
    if (!form.class.trim())     e.class     = 'Required';
    if (form.parent_phone && !/^\+?\d{7,15}$/.test(form.parent_phone.trim()))
      e.parent_phone = 'Invalid phone (e.g. +2348012345678)';
    if (form.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parent_email.trim()))
      e.parent_email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (modal === 'add') {
        await addStudent({
          student_id:   form.student_id.trim().toUpperCase(),
          full_name:    form.full_name.trim(),
          class:        form.class.trim(),
          parent_phone: form.parent_phone.trim() || null,
          parent_email: form.parent_email.trim() || null,
        });
        toast.success(`Student ${form.full_name.trim()} added`);
      } else {
        await updateStudent(selected.student_id, {
          full_name:    form.full_name.trim(),
          class:        form.class.trim(),
          parent_phone: form.parent_phone.trim() || null,
          parent_email: form.parent_email.trim() || null,
        });
        toast.success('Student updated');
      }
      closeModal();
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed';
      if (err.response?.status === 409) {
        setErrors((e) => ({ ...e, student_id: msg }));
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
      await deleteStudent(selected.student_id);
      toast.success(`${selected.full_name} deleted`);
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inner = (
    <div className={isEmbedded ? '' : 'max-w-6xl mx-auto px-4 py-6'}>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by ID, name, or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
          + Add Student
        </button>
      </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {search ? 'No students match your search.' : 'No students yet. Click + Add Student to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Full Name</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-left">Parent Phone</th>
                  <th className="px-4 py-3 text-left">Parent Email</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => (
                  <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-blue-700 font-medium">{s.student_id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.class}</td>
                    <td className="px-4 py-3 text-gray-500">{s.parent_phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.parent_email || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEdit(s)}
                        className="text-blue-600 hover:text-blue-800 font-medium mr-3 text-xs">
                        Edit
                      </button>
                      <button onClick={() => openDelete(s)}
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
        <Modal title={modal === 'add' ? 'Add Student' : 'Edit Student'} onClose={closeModal}>
          <div className="space-y-4">
            <Field label="Student ID" error={errors.student_id}>
              <input
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                disabled={modal === 'edit'}
                placeholder="e.g. STU001"
                className={inputCls(errors.student_id) + (modal === 'edit' ? ' bg-gray-100' : '')}
              />
            </Field>
            <Field label="Full Name" error={errors.full_name}>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Amara Okafor"
                className={inputCls(errors.full_name)}
              />
            </Field>
            <Field label="Class" error={errors.class}>
              <input
                value={form.class}
                onChange={(e) => setForm({ ...form, class: e.target.value })}
                placeholder="e.g. Primary 3A"
                className={inputCls(errors.class)}
              />
            </Field>
            <Field label="Parent Phone (optional)" error={errors.parent_phone}>
              <input
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                placeholder="+2348012345678"
                className={inputCls(errors.parent_phone)}
              />
            </Field>
            <Field label="Parent Email (optional)" error={errors.parent_email}>
              <input
                value={form.parent_email}
                onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
                placeholder="parent@example.com"
                className={inputCls(errors.parent_email)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={closeModal} disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {modal === 'delete' && selected && (
        <Modal title="Delete Student" onClose={closeModal}>
          <p className="text-gray-700 text-sm">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{selected.full_name}</span>{' '}
            ({selected.student_id})? This will remove all their records.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={closeModal} disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={saving}
              className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
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
            <h1 className="text-xl font-bold">Student Management</h1>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{inner}</main>
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

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
