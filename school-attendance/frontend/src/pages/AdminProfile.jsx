import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getProfile, updateProfile, changePassword,
  getAdmins, createAdmin, deleteAdmin,
} from '../services/api';

const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin:       'bg-blue-100 text-blue-700',
  scanner:     'bg-gray-100 text-gray-600',
};

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  scanner:     'Scanner',
};

export default function AdminProfile({ isEmbedded = false }) {
  const [profile,      setProfile]      = useState(null);
  const [profileForm,  setProfileForm]  = useState({ display_name: '', email: '', phone: '' });
  const [pwForm,       setPwForm]       = useState({ current_password: '', new_password: '', confirm: '' });
  const [admins,       setAdmins]       = useState([]);
  const [newAdminForm, setNewAdminForm] = useState({ username: '', password: '', email: '', role: 'admin' });
  const [saving,       setSaving]       = useState(false);
  const [savingPw,     setSavingPw]     = useState(false);
  const [savingAdmin,  setSavingAdmin]  = useState(false);
  const [showNewAdmin, setShowNewAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await getProfile();
      const a = data.admin;
      setProfile(a);
      setProfileForm({
        display_name: a.display_name || '',
        email:        a.email        || '',
        phone:        a.phone        || '',
      });
      setIsSuperAdmin(a.role === 'super_admin');
    } catch {
      toast.error('Failed to load profile');
    }
  }, []);

  const loadAdmins = useCallback(async () => {
    try {
      const { data } = await getAdmins();
      setAdmins(data.admins || []);
    } catch { /* not super_admin — ignore 403 */ }
  }, []);

  useEffect(() => {
    loadProfile();
    loadAdmins();
  }, [loadProfile, loadAdmins]);

  async function handleProfileSave() {
    setSaving(true);
    try {
      await updateProfile({
        display_name: profileForm.display_name.trim() || null,
        email:        profileForm.email.trim()        || null,
        phone:        profileForm.phone.trim()        || null,
      });
      toast.success('Profile updated');
      loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (!pwForm.current_password || !pwForm.new_password)
      return toast.error('All password fields are required');
    if (pwForm.new_password !== pwForm.confirm)
      return toast.error('New passwords do not match');
    if (pwForm.new_password.length < 8)
      return toast.error('New password must be at least 8 characters');
    setSavingPw(true);
    try {
      await changePassword({
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      });
      toast.success('Password changed');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  }

  async function handleCreateAdmin() {
    if (!newAdminForm.username.trim() || !newAdminForm.password)
      return toast.error('Username and password are required');
    setSavingAdmin(true);
    try {
      await createAdmin({
        username: newAdminForm.username.trim(),
        password: newAdminForm.password,
        email:    newAdminForm.email.trim() || null,
        role:     newAdminForm.role,
      });
      toast.success(`Admin '${newAdminForm.username.trim()}' created`);
      setNewAdminForm({ username: '', password: '', email: '', role: 'admin' });
      setShowNewAdmin(false);
      loadAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create admin');
    } finally {
      setSavingAdmin(false);
    }
  }

  async function handleDeleteAdmin(a) {
    if (!window.confirm(`Deactivate '${a.username}'?`)) return;
    try {
      await deleteAdmin(a.admin_id);
      toast.success(`'${a.username}' deactivated`);
      loadAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deactivate admin');
    }
  }

  const inner = (
    <div className={isEmbedded ? 'space-y-8' : 'max-w-3xl mx-auto px-4 py-6 space-y-8'}>

      {/* ── Profile section ── */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-base font-bold text-gray-800 mb-5">My Profile</h2>
        {profile && (
          <div className="mb-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center
                            text-blue-700 font-bold text-lg shrink-0">
              {(profile.display_name || profile.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile.username}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[profile.role] || ROLE_COLORS.admin}`}>
                {ROLE_LABELS[profile.role] || profile.role}
              </span>
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Display Name">
            <input value={profileForm.display_name}
              onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
              placeholder="e.g. Mr. Adebayo"
              className={inputCls()} />
          </Field>
          <Field label="Email (for notifications)">
            <input type="email" value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              placeholder="admin@school.edu"
              className={inputCls()} />
          </Field>
          <Field label="Phone Number">
            <input type="tel" value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="+2348012345678"
              className={inputCls()} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handleProfileSave} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </section>

      {/* ── Change password section ── */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-base font-bold text-gray-800 mb-5">Change Password</h2>
        <div className="space-y-4 max-w-sm">
          <Field label="Current Password">
            <input type="password" value={pwForm.current_password}
              onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
              className={inputCls()} />
          </Field>
          <Field label="New Password">
            <input type="password" value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
              placeholder="At least 8 characters"
              className={inputCls()} />
          </Field>
          <Field label="Confirm New Password">
            <input type="password" value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              className={inputCls()} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handlePasswordChange} disabled={savingPw}
            className="px-5 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg
                       hover:bg-gray-900 disabled:opacity-50">
            {savingPw ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </section>

      {/* ── Admin user management (super_admin only) ── */}
      {isSuperAdmin && (
        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-800">Admin Users</h2>
            <button onClick={() => setShowNewAdmin((p) => !p)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg
                         hover:bg-blue-700 transition-colors">
              + Add Admin
            </button>
          </div>

          {showNewAdmin && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">New Admin User</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Username">
                  <input value={newAdminForm.username}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                    placeholder="e.g. mrs_johnson"
                    className={inputCls()} />
                </Field>
                <Field label="Password">
                  <input type="password" value={newAdminForm.password}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                    placeholder="Min. 8 characters"
                    className={inputCls()} />
                </Field>
                <Field label="Email (optional)">
                  <input type="email" value={newAdminForm.email}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                    placeholder="admin@school.edu"
                    className={inputCls()} />
                </Field>
                <Field label="Role">
                  <select value={newAdminForm.role}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, role: e.target.value })}
                    className={inputCls()}>
                    <option value="admin">Admin — full dashboard access</option>
                    <option value="scanner">Scanner — scan only, no dashboard</option>
                    <option value="super_admin">Super Admin — full access + manage admins</option>
                  </select>
                </Field>
              </div>
              <div className="flex gap-3">
                <button onClick={handleCreateAdmin} disabled={savingAdmin}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg
                             hover:bg-blue-700 disabled:opacity-50">
                  {savingAdmin ? 'Creating…' : 'Create Admin'}
                </button>
                <button onClick={() => setShowNewAdmin(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">Display Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map((a) => (
                  <tr key={a.admin_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.username}</td>
                    <td className="px-4 py-3 text-gray-600">{a.display_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{a.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[a.role] || ROLE_COLORS.admin}`}>
                        {ROLE_LABELS[a.role] || a.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.admin_id !== profile?.admin_id ? (
                        <button onClick={() => handleDeleteAdmin(a)}
                          className="text-red-500 hover:text-red-700 font-medium text-xs">
                          Deactivate
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">You</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );

  if (isEmbedded) return inner;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">Admin Profile</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{inner}</main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function inputCls() {
  return 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
}
