import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getStudents, addStudent, updateStudent, deleteStudent, getStudentGroups } from '../services/api';

const TRANSPORT_OPTIONS = [
  { value: 'parent_drop', label: 'Parent Drop-off' },
  { value: 'school_bus',  label: 'School Bus'       },
  { value: 'self',        label: 'Walks / Comes Alone' },
];

const TRANSPORT_META = {
  parent_drop: { label: 'Parent', cls: 'bg-blue-100 text-blue-700'   },
  school_bus:  { label: 'Bus',    cls: 'bg-yellow-100 text-yellow-700' },
  self:        { label: 'Self',   cls: 'bg-green-100 text-green-700'  },
};

const EMPTY_FORM = {
  student_id:     '',
  full_name:      '',
  class:          '',
  transport_mode: 'parent_drop',
  group_tag:      '',
  parent_phone:   '',
  parent_email:   '',
};

export default function StudentManagement({ isEmbedded = false }) {
  const navigate = useNavigate();

  const [students,     setStudents]     = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterClass,  setFilterClass]  = useState('all');
  const [filterGroup,  setFilterGroup]  = useState('all');
  const [modal,        setModal]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState({});
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [bulkGroup,    setBulkGroup]    = useState('');

  // Map group name → transport_mode for auto-fill
  const groupTransportMap = useMemo(() =>
    Object.fromEntries(studentGroups.map(g => [g.name, g.transport_mode])),
  [studentGroups]);

  const load = useCallback(async () => {
    try {
      const [stuRes, grpRes] = await Promise.all([getStudents(), getStudentGroups()]);
      setStudents(stuRes.data.students || []);
      setStudentGroups(grpRes.data || []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived filter options ─────────────────────────────────────────────────
  const classes = useMemo(() =>
    ['all', ...new Set(students.map(s => s.class).filter(Boolean).sort())],
  [students]);

  const groups = useMemo(() =>
    ['all', ...new Set(students.map(s => s.group_tag).filter(Boolean).sort())],
  [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (filterClass !== 'all' && s.class !== filterClass) return false;
      if (filterGroup !== 'all' && (s.group_tag || null) !== filterGroup) return false;
      return !q ||
        s.student_id.toLowerCase().includes(q) ||
        s.full_name.toLowerCase().includes(q) ||
        (s.class      || '').toLowerCase().includes(q) ||
        (s.group_tag  || '').toLowerCase().includes(q);
    });
  }, [students, search, filterClass, filterGroup]);

  // ── Multi-select ──────────────────────────────────────────────────────────
  const allSelected  = filtered.length > 0 && filtered.every(s => selectedIds.has(s.student_id));
  const someSelected = !allSelected && filtered.some(s => selectedIds.has(s.student_id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.student_id)));
    }
  }

  function toggleOne(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function applyBulkGroup() {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const value = bulkGroup.trim() || null;
      await Promise.all([...selectedIds].map(id => updateStudent(id, { group_tag: value })));
      toast.success(value
        ? `Assigned group "${value}" to ${selectedIds.size} student(s)`
        : `Removed group from ${selectedIds.size} student(s)`);
      setSelectedIds(new Set());
      setBulkGroup('');
      load();
    } catch {
      toast.error('Failed to assign group');
    } finally {
      setSaving(false);
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setSelected(null);
    setModal('add');
  }

  function openEdit(student) {
    setForm({
      student_id:     student.student_id,
      full_name:      student.full_name,
      class:          student.class,
      transport_mode: student.transport_mode || 'parent_drop',
      group_tag:      student.group_tag || '',
      parent_phone:   student.parent_phone || '',
      parent_email:   student.parent_email || '',
    });
    setErrors({});
    setSelected(student);
    setModal('edit');
  }

  function openDelete(student) { setSelected(student); setModal('delete'); }

  function closeModal() { setModal(null); setSelected(null); setSaving(false); }

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

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        full_name:      form.full_name.trim(),
        class:          form.class.trim(),
        transport_mode: form.transport_mode || 'parent_drop',
        group_tag:      form.group_tag.trim() || null,
        parent_phone:   form.parent_phone.trim() || null,
        parent_email:   form.parent_email.trim() || null,
      };
      if (modal === 'add') {
        await addStudent({ student_id: form.student_id.trim().toUpperCase(), ...payload });
        toast.success(`${form.full_name.trim()} added`);
      } else {
        await updateStudent(selected.student_id, payload);
        toast.success('Student updated');
      }
      closeModal();
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed';
      if (err.response?.status === 409) setErrors(e => ({ ...e, student_id: msg }));
      else toast.error(msg);
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name, ID, class, group…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Class filter */}
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {classes.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All Classes' : c}</option>
          ))}
        </select>

        {/* Group filter */}
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {groups.map(g => (
            <option key={g} value={g}>{g === 'all' ? 'All Groups' : g}</option>
          ))}
        </select>

        <span className="text-sm text-gray-400">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>

        <div className="flex-1" />
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          + Add Student
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold text-blue-700">
            {selectedIds.size} selected
          </span>
          <span className="text-blue-300">|</span>
          <span className="text-sm text-gray-600 font-medium">Assign Group:</span>
          <select
            value={bulkGroup}
            onChange={e => setBulkGroup(e.target.value)}
            className="flex-1 min-w-[160px] max-w-xs px-3 py-1.5 border border-blue-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Remove Group —</option>
            {studentGroups.map(g => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
          <button
            onClick={applyBulkGroup}
            disabled={saving}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Apply
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {search || filterClass !== 'all' || filterGroup !== 'all'
              ? 'No students match your filters.'
              : 'No students yet. Click + Add Student to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-3 py-3 text-center w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Name / Group</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-left">Transport</th>
                  <th className="px-4 py-3 text-left">Parent Phone</th>
                  <th className="px-4 py-3 text-left">Parent Email</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => {
                  const tm = TRANSPORT_META[s.transport_mode] || TRANSPORT_META.parent_drop;
                  const isChecked = selectedIds.has(s.student_id);
                  return (
                    <tr key={s.student_id}
                      className={`transition-colors ${isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(s.student_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-blue-700 font-medium text-xs">{s.student_id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.full_name}</p>
                        {s.group_tag && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                            {s.group_tag}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.class}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${tm.cls}`}>
                          {tm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.parent_phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.parent_email || '—'}</td>
                      <td className="px-4 py-3 text-center space-x-3">
                        <button onClick={() => openEdit(s)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs">Edit</button>
                        <button onClick={() => openDelete(s)}
                          className="text-red-500 hover:text-red-700 font-medium text-xs">Delete</button>
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
        <Modal title={modal === 'add' ? 'Add Student' : 'Edit Student'} onClose={closeModal}>
          <div className="space-y-4">
            <Field label="Student ID" error={errors.student_id}>
              <input
                value={form.student_id}
                onChange={e => setForm({ ...form, student_id: e.target.value })}
                disabled={modal === 'edit'}
                placeholder="e.g. STU001"
                className={inputCls(errors.student_id) + (modal === 'edit' ? ' bg-gray-100' : '')}
              />
            </Field>
            <Field label="Full Name" error={errors.full_name}>
              <input value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Amara Okafor"
                className={inputCls(errors.full_name)} />
            </Field>
            <Field label="Class" error={errors.class}>
              <input value={form.class}
                onChange={e => setForm({ ...form, class: e.target.value })}
                placeholder="e.g. Primary 3A"
                className={inputCls(errors.class)} />
            </Field>

            <Field label="Group (optional)">
              <select
                value={form.group_tag}
                onChange={e => {
                  const name = e.target.value;
                  const autoMode = groupTransportMap[name];
                  setForm(f => ({
                    ...f,
                    group_tag: name,
                    ...(autoMode ? { transport_mode: autoMode } : {}),
                  }));
                }}
                className={inputCls()}>
                <option value="">— No Group —</option>
                {studentGroups.map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
              {form.group_tag && groupTransportMap[form.group_tag] && (
                <p className="mt-1 text-xs text-blue-500">
                  Transport mode auto-set to: <span className="font-semibold">
                    {TRANSPORT_OPTIONS.find(o => o.value === groupTransportMap[form.group_tag])?.label}
                  </span>
                </p>
              )}
            </Field>

            <Field label="Transport Mode">
              <select value={form.transport_mode}
                onChange={e => setForm({ ...form, transport_mode: e.target.value })}
                className={inputCls()}>
                {TRANSPORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Parent Phone (optional)" error={errors.parent_phone}>
              <input value={form.parent_phone}
                onChange={e => setForm({ ...form, parent_phone: e.target.value })}
                placeholder="+2348012345678"
                className={inputCls(errors.parent_phone)} />
            </Field>
            <Field label="Parent Email (optional)" error={errors.parent_email}>
              <input value={form.parent_email}
                onChange={e => setForm({ ...form, parent_email: e.target.value })}
                placeholder="parent@example.com"
                className={inputCls(errors.parent_email)} />
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
        <Modal title="Delete Student" onClose={closeModal}>
          <p className="text-gray-700 text-sm">
            Delete <span className="font-semibold">{selected.full_name}</span> ({selected.student_id})?
            This removes all their records.
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
          <h1 className="text-xl font-bold">Student Management</h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{inner}</main>
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
