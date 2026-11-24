import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../api';

interface AuthContextType {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  useEffect(() => {
    const syncAuth = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === null) setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', syncAuth);
    return () => window.removeEventListener('storage', syncAuth);
  }, []);

  const saveToken = (t: string) => { localStorage.setItem('token', t); setToken(t); };

  const login = async (email: string, password: string) => {
    const fd = new URLSearchParams({ username: email, password });
    const res = await api.post('/login', fd, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    saveToken(res.data.access_token);
  };

  const loginDemo = async () => {
    const res = await api.post('/demo-login');
    saveToken(res.data.access_token);
  };

  const logout = () => { localStorage.removeItem('token'); setToken(null); window.location.href = '/login'; };

  return (
    <AuthContext.Provider value={{ token, login, loginDemo, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
