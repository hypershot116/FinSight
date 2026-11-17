import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    
    try {
      const res = await api.post('/forgot-password', { email });
      setMessage(res.data.message);
      setStatus('success');
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'An error occurred. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100 relative">
        <div className="absolute top-6 left-6">
          <Link to="/login" className="text-sm font-medium text-gray-500 hover:text-teal-600 transition-colors flex items-center">
            ← Back to Login
          </Link>
        </div>
        
        <div className="pt-4">
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">Reset Password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter your email to receive a secure reset link.</p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-50 text-green-800 p-4 rounded-md text-sm text-center border border-green-200">
            {message}
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {status === 'error' && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">{message}</div>
            )}
            <div>
              <input type="email" required placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
            </div>
            <button type="submit" disabled={status === 'loading'}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400">
              {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
