import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);  // true while checking stored token

  // ── On app load — restore session from localStorage ──────────────────────
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        // Verify token is still valid + get fresh user data
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch {
        // Token invalid or expired and refresh failed — clear storage
        localStorage.clear();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });

    // Store tokens
    localStorage.setItem('accessToken',  data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    setUser(data.user);
    return data.user;   // caller can redirect based on role
  }, []);

  // ── REGISTER ──────────────────────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const { data } = await api.post('/auth/register', formData);
    return data;
  }, []);

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Logout endpoint failed — clear client side anyway
    } finally {
      localStorage.clear();
      setUser(null);
    }
  }, []);

  // ── Role helpers — use these in components instead of checking user.role ──
  const isAdmin    = user?.role === 'ADMIN';
  const isManager  = user?.role === 'MANAGER';
  const isEmployee = user?.role === 'EMPLOYEE';

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAdmin,
    isManager,
    isEmployee,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — use this in every component that needs auth
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}