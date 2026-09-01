import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../services/authApi';

const AuthContext = createContext(null);

const TOKEN_STORAGE_KEY = 'careeros_token';

/**
 * AuthProvider — Single source of truth for frontend authentication state.
 *
 * NOTE: Storing the bearer token in sessionStorage is a transitional implementation
 * for persisting user session across page navigation/refreshes. Future security
 * hardening will migrate frontend and backend to HTTP-only cookie authentication.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Session restoration on startup
  useEffect(() => {
    async function restoreSession() {
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.getCurrentUser(storedToken);
        if (response?.user) {
          setUser(response.user);
          setToken(storedToken);
        } else {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setUser(null);
          setToken(null);
        }
      } catch {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const result = await authApi.login({ email, password });
    if (result?.token && result?.user) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
    }
    return result;
  }, []);

  const signup = useCallback(async ({ email, password, firstName, lastName }) => {
    const result = await authApi.signup({ email, password, firstName, lastName });
    if (result?.token && result?.user) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = token || sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) return;

    try {
      const response = await authApi.getCurrentUser(storedToken);
      if (response?.user) {
        setUser(response.user);
      }
    } catch {
      logout();
    }
  }, [token, logout]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
