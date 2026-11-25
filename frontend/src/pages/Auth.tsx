import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { api } from '../api';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const { login, loginDemo } = useAuth();

  useEffect(() => {
    let on = true;
    const ping = () => api.get('/status', { timeout: 5000 }).then(() => { if (on) { setServerReady(true); clearInterval(id); } }).catch(() => {});
    ping();
    const id = setInterval(ping, 2500);
    return () => { on = false; clearInterval(id); };
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setDemoLoading(true);
    try {
      await loginDemo();
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Demo login failed (' + (err.response?.status || 'network') + ').');
    } finally {
      setDemoLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mb-3">
            {serverReady ? (
              <><span className="w-2 h-2 rounded-full bg-emerald-500" /> Cloud server live</>
            ) : (
              <><Loader2 className="w-3 h-3 animate-spin text-amber-500" /> Waking up cloud server...</>
            )}
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Sign in to FinSight</h2>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && <div className="bg-red-50 p-4 rounded-md text-sm text-red-700">{error}</div>}
          <div className="space-y-4">
            <input type="email" required placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
              className="rounded-md block w-full px-3 py-2 border border-gray-300 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                className="rounded-md block w-full px-3 py-2 border border-gray-300 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm pr-10" />
              <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end text-sm">
            <Link to="/forgot-password" className="font-medium text-teal-600 hover:text-teal-500">Forgot your password?</Link>
          </div>

          <button type="submit" disabled={loading || demoLoading}
            className="w-full py-2 px-4 text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 transition-colors">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-gray-200" />
          <span className="flex-shrink mx-3 text-xs text-gray-400 uppercase">or</span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        <button type="button" onClick={handleDemo} disabled={loading || demoLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-md text-white bg-slate-900 hover:bg-slate-800 disabled:bg-gray-400 transition-colors">
          <Sparkles className="w-4 h-4 text-teal-400" />
          {demoLoading ? 'Preparing Demo Workspace...' : 'Explore Live Demo (No Sign-Up)'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account? <Link to="/register" className="font-medium text-teal-600 hover:text-teal-500">Sign up here</Link>
        </p>
      </div>
    </div>
  );
}
