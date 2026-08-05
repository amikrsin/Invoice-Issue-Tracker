import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, Role } from '../types';
import { Users, UserPlus, Shield, User as UserIcon, CheckCircle2, XCircle, Key, Copy, Check, X } from 'lucide-react';

export const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('user');
  const [createLoading, setCreateLoading] = useState(false);

  // Result dialog showing generated temp password
  const [createdResult, setCreatedResult] = useState<{
    user: User;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim()) return;

    setCreateLoading(true);
    try {
      const res = await api.createUser(newUsername.trim(), newName.trim(), newRole);
      setCreatedResult({
        user: res.user,
        tempPassword: res.tempPassword,
      });
      setShowCreateModal(false);
      setNewUsername('');
      setNewName('');
      setNewRole('user');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to create user account');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    const actionText = user.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionText} user @${user.username}?`)) return;

    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleToggleRole = async (user: User) => {
    const nextRole: Role = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change role of @${user.username} to ${nextRole.toUpperCase()}?`)) return;

    try {
      await api.updateUser(user.id, { role: nextRole });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    }
  };

  const handleDirectPasswordReset = async (user: User) => {
    if (!window.confirm(`Generate a new temporary password for @${user.username}?`)) return;

    try {
      const res = await api.updateUser(user.id, { resetPassword: true });
      if (res.tempPassword) {
        setCreatedResult({
          user: res.user,
          tempPassword: res.tempPassword,
        });
      }
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>Admin: Manage Team Users</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create internal user accounts, manage permissions, and issue temporary passwords.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow transition-colors flex items-center space-x-1.5 w-fit"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create New Account</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading team members...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Name & Username</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Password Reset State</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{u.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">@{u.username}</div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleRole(u)}
                        title="Click to toggle role"
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase transition-colors ${
                          u.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {u.role}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1 w-fit">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.must_reset_password ? (
                        <span className="text-amber-700 font-medium text-[11px]">
                          Reset Required on Login
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">
                          Password Set
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleDirectPasswordReset(u)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1"
                          title="Generate new temporary password"
                        >
                          <Key className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Reset Password</span>
                        </button>

                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                            u.is_active
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <span>Create Internal User Account</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              A temporary password will be generated automatically.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. ramesh.k"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Permission *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="user">User (Team Member - Create/View entries)</option>
                  <option value="admin">Admin (Full edit/delete, users & queues)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
                >
                  {createLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Created / Temp Password Dialog */}
      {createdResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Account Ready
                </h3>
                <p className="text-xs text-slate-400">
                  User @{createdResult.user.username} ({createdResult.user.name})
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-xl space-y-2">
              <div className="text-xs text-slate-400">Temporary Password:</div>
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="font-mono text-base font-bold text-emerald-400 tracking-wider">
                  {createdResult.tempPassword}
                </span>
                <button
                  onClick={() => copyToClipboard(createdResult.tempPassword)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
              Provide this temporary password directly to the team member. They will be forced to change it on first login.
            </div>

            <button
              onClick={() => setCreatedResult(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
