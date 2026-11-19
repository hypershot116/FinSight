import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setTokenError('No reset token found in the URL.');
      setTokenStatus('invalid');
      return;
    }

    let cancelled = false;
    setTokenStatus('checking');

    api
      .post('/verify-reset-token', { token })
      .then(() => {
        if (!cancelled) setTokenStatus('valid');
      })
      .catch((err: any) => {
        if (!cancelled) {
          setTokenError(
            err.response?.data?.detail ||
              'This password reset link is invalid, tampered with, or expired.'
          );
          setTokenStatus('invalid');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const allRequirementsMet = Object.values(requirements).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet || !token) return;

    setStatus('loading');
    try {
      const res = await api.post('/reset-password', { token, new_password: password });
      setMessage(res.data.message);
      setStatus('success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to reset password. Link may be expired.');
      setStatus('error');
    }
  };

  if (tokenStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center p-8 bg-white rounded-xl shadow-lg border border-gray-100">
          <p className="text-gray-600 text-sm">Verifying your password reset link...</p>
        </div>
      </div>
    );
  }

  if (tokenStatus === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center p-8 bg-white rounded-xl shadow-lg border border-red-200 space-y-4">
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-red-600">Invalid or Expired Link</h2>
          <p className="text-gray-600 text-sm">{tokenError}</p>
          <Link
            to="/forgot-password"
            className="inline-block px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition-colors"
          >
            Request a New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="pt-4">
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">Set New Password</h2>
        </div>

        {status === 'success' ? (
          <div className="bg-green-50 text-green-800 p-4 rounded-md text-sm text-center border border-green-200">
            {message} <br /> Redirecting to login...
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {status === 'error' && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                {message}
              </div>
            )}

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>

            {password.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-md text-sm">
                <p className="font-semibold text-gray-700 mb-2">Password must contain:</p>
                <ul className="space-y-1">
                  <RequirementItem met={requirements.length} text="At least 8 characters" />
                  <RequirementItem met={requirements.uppercase} text="One uppercase letter" />
                  <RequirementItem met={requirements.number} text="One number" />
                  <RequirementItem met={requirements.special} text="One special character" />
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={!allRequirementsMet || status === 'loading'}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 transition-colors"
            >
              {status === 'loading' ? 'Saving...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
  <li className="flex items-center space-x-2">
    {met ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
    <span className={met ? 'text-green-700' : 'text-gray-500'}>{text}</span>
  </li>
);
