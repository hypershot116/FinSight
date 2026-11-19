import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  ShieldAlert,
  ShieldCheck,
  Crown,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
} from 'lucide-react';

interface UserData {
  id: number;
  name: string | null;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  is_master_admin: boolean;
  has_pending_otp: boolean;
  created_at: string;
}

interface CurrentUser {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean;
  is_master_admin: boolean;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState('');
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [meRes, usersRes] = await Promise.all([
        api.get('/me'),
        api.get('/admin/users'),
      ]);
      setCurrentUser(meRes.data);
      setUsers(usersRes.data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Access Denied: You do not have admin privileges.');
      } else {
        setError('Failed to load users. Check backend connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleUserStatus = async (target: UserData) => {
    setActionBanner(null);
    const nextStatus = !target.is_active;

    try {
      await api.put(`/admin/users/${target.id}/status`, { is_active: nextStatus });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === target.id
            ? { ...u, is_active: nextStatus, has_pending_otp: nextStatus ? false : u.has_pending_otp }
            : u
        )
      );
      setActionBanner({
        type: 'success',
        text: `${target.email} has been ${nextStatus ? 'activated' : 'deactivated'}.`,
      });
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update user status.',
      });
    }
  };

  const toggleAdminRole = async (target: UserData) => {
    setActionBanner(null);
    const nextAdminState = !target.is_admin;

    try {
      const res = await api.put(`/admin/users/${target.id}/role`, { is_admin: nextAdminState });
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, is_admin: nextAdminState } : u))
      );
      setActionBanner({
        type: 'success',
        text: res.data.message,
      });
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update user role.',
      });
    }
  };

  const isMaster = Boolean(currentUser?.is_master_admin);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              to="/"
              className="text-sm font-medium text-gray-500 hover:text-teal-600 transition-colors flex items-center mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ShieldAlert className="w-8 h-8 mr-3 text-teal-600" />
              System Administration
            </h1>
          </div>

          {currentUser && (
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                isMaster
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-purple-100 text-purple-800 border border-purple-200'
              }`}
            >
              {isMaster ? (
                <>
                  <Crown className="w-3.5 h-3.5 mr-1.5" /> Master Admin Mode
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Admin Mode
                </>
              )}
            </span>
          )}
        </div>

        {actionBanner && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm border flex items-center justify-between ${
              actionBanner.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <span>{actionBanner.text}</span>
            <button
              onClick={() => setActionBanner(null)}
              className="text-xs font-semibold opacity-70 hover:opacity-100 ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl shadow-sm text-center">
            <h2 className="text-lg font-bold mb-2">Unauthorized Access</h2>
            <p>{error}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Return Home
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-900 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">User ID</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Email</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                        Loading users...
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const isSelf = currentUser?.id === user.id;
                      const canModifyStatus =
                        !isSelf && !user.is_master_admin && (!user.is_admin || isMaster);
                      const canModifyRole = isMaster && !isSelf && !user.is_master_admin;

                      return (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">#{user.id}</td>
                          <td className="px-6 py-4">{user.name || '—'}</td>
                          <td className="px-6 py-4 font-medium">{user.email}</td>
                          <td className="px-6 py-4">
                            {user.is_master_admin ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <Crown className="w-3 h-3 mr-1" /> Master Admin
                              </span>
                            ) : user.is_admin ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                User
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {user.is_active ? (
                              <span className="inline-flex items-center text-green-600">
                                <CheckCircle className="w-4 h-4 mr-1" /> Active
                              </span>
                            ) : user.has_pending_otp ? (
                              <span className="inline-flex items-center text-amber-600">
                                <Clock className="w-4 h-4 mr-1" /> Pending OTP
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-red-500">
                                <XCircle className="w-4 h-4 mr-1" /> Deactivated
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            {user.is_master_admin ? (
                              <span className="text-xs text-gray-400 italic">Protected</span>
                            ) : (
                              <>
                                {canModifyRole && (
                                  <button
                                    onClick={() => toggleAdminRole(user)}
                                    disabled={!user.is_admin && !user.is_active}
                                    title={
                                      !user.is_admin && !user.is_active
                                        ? 'Activate user before promoting to Admin'
                                        : ''
                                    }
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                      !user.is_admin && !user.is_active
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : user.is_admin
                                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                    }`}
                                  >
                                    {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                                  </button>
                                )}

                                <button
                                  onClick={() => toggleUserStatus(user)}
                                  disabled={!canModifyStatus}
                                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    !canModifyStatus
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : user.is_active
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                        : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                                  }`}
                                >
                                  {user.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
