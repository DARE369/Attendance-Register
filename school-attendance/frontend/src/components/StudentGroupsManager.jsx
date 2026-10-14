import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getStudentGroups, createStudentGroup, updateStudentGroup, deleteStudentGroup } from '../services/api';

const TRANSPORT_OPTIONS = [
  { value: 'parent_drop', label: 'Parent Drop-off', cls: 'bg-blue-100 text-blue-700' },
  { value: 'school_bus',  label: 'School Bus',       cls: 'bg-yellow-100 text-yellow-700' },
  { value: 'self',        label: 'Walks / Comes Alone', cls: 'bg-green-100 text-green-700' },
];

const TRANSPORT_MAP = Object.fromEntries(TRANSPORT_OPTIONS.map(o => [o.value, o]));

const EMPTY_FORM = { name: '', transport_mode: 'parent_drop', description: '' };

export default function StudentGroupsManager() {
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // 'add' | 'edit' | 'delete'
  const [selected, setSelected] = useState(null);
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [nameErr, setNameErr] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await getStudentGroups();
      setGroups(data || []);
    } catch {
      toast.error('Failed to load student groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setNameErr('');
    setSelected(null);
    setModal('add');
  }

  function openEdit(g) {
    setForm({ name: g.name, transport_mode: g.transport_mode, description: g.description || '' });
    setNameErr('');
    setSelected(g);
    setModal('edit');
  }

  function openDelete(g) { setSelected(g); setModal('delete'); }
  function closeModal() { setModal(null); setSelected(null); setSaving(false); }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) { setNameErr('Group name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name,
        transport_mode: form.transport_mode,
        description: form.description.trim() || null,
      };
      if (modal === 'add') {
        await createStudentGroup(payload);
        toast.success(`Group "${name}" created`);
      } else {
        await updateStudentGroup(selected.id, payload);
        toast.success('Group updated');
      }
      closeModal();
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed';
      if (err.response?.status === 409) setNameErr(msg);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteStudentGroup(selected.id);
      toast.success(`Group "${selected.name}" deleted`);
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800">Student Groups</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Named groups with a fixed transport mode. Selecting a group on a student auto-sets their transport mode.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
          + New Group
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No groups yet. Create one to start organising students.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Group Name</th>
                <th className="px-5 py-3 text-left">Transport Mode</th>
                <th className="px-5 py-3 text-center">Students</th>
                <th className="px-5 py-3 text-left">Description</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map(g => {
                const tm = TRANSPORT_MAP[g.transport_mode] || TRANSPORT_MAP.parent_drop;
                return (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-800">{g.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${tm.cls}`}>
                        {tm.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        g.student_count > 0
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {g.student_count ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{g.description || '—'}</td>
                    <td className="px-5 py-3 text-center space-x-3">
                      <button onClick={() => openEdit(g)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs">Edit</button>
                      <button onClick={() => openDelete(g)}
                        className="text-red-500 hover:text-red-700 font-medium text-xs">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">
                {modal === 'add' ? 'New Group' : 'Edit Group'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Group Name</label>
                <input
                  value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setNameErr(''); }}
                  placeholder="e.g. Bus Group A"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${nameErr ? 'border-red-400' : 'border-gray-300'}`}
                />
                {nameErr && <p className="mt-1 text-xs text-red-500">{nameErr}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Transport Mode</label>
                <select
                  value={form.transport_mode}
                  onChange={e => setForm({ ...form, transport_mode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {TRANSPORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Selecting this group on a student will automatically set their transport mode.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Morning school bus - Route A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {modal === 'delete' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Delete Group</h2>
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold">"{selected.name}"</span>?
              Students assigned to this group will keep their current transport mode but lose the group tag.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleDelete} disabled={saving}
                className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
