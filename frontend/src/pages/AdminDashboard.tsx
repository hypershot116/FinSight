import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ShieldAlert, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

interface UserData {
  id: number;
  name: string | null;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Access Denied: You do not have admin privileges.");
      } else {
        setError("Failed to load users. Check backend connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleUserStatus = async (userId: number, currentStatus: boolean, isAdmin: boolean) => {
    if (isAdmin) {
      alert("You cannot modify admin accounts from this view.");
      return;
    }
    
    try {
      await api.put(`/admin/users/${userId}/status`, { is_active: !currentStatus });
      // Update UI locally to reflect the change instantly
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update user status");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-sm font-medium text-gray-500 hover:text-teal-600 transition-colors flex items-center mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ShieldAlert className="w-8 h-8 mr-3 text-teal-600" />
              System Administration
            </h1>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl shadow-sm text-center">
            <h2 className="text-lg font-bold mb-2">Unauthorized Access</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
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
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading users...</td></tr>
                  ) : users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">#{user.id}</td>
                      <td className="px-6 py-4">{user.name || '—'}</td>
                      <td className="px-6 py-4 font-medium">{user.email}</td>
                      <td className="px-6 py-4">
                        {user.is_admin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Admin</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">User</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center text-green-600"><CheckCircle className="w-4 h-4 mr-1" /> Active</span>
                        ) : (
                          <span className="inline-flex items-center text-red-500"><XCircle className="w-4 h-4 mr-1" /> Pending OTP</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => toggleUserStatus(user.id, user.is_active, user.is_admin)}
                          disabled={user.is_admin}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            user.is_admin ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                            user.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
