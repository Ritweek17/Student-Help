import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../services/authApi';

export const AuthContext = createContext(null);

/**
 * AuthProvider — Single source of truth for frontend authentication state.
 *
 * Modernized Phase 10B architecture:
 * - Access token: Short-lived JWT held strictly in-memory (React runtime state).
 * - Refresh token: Opaque, rotated token managed by the server in an HttpOnly, SameSite cookie.
 * - ZERO authentication tokens stored in localStorage or sessionStorage.
 * - Session restoration on reload via /api/auth/refresh.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Proactive token refresh
  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await authApi.refreshToken();
      if (response?.token && response?.user) {
        setToken(response.token);
        setUser(response.user);
        return response.token;
      }
      throw new Error('Failed to refresh token');
    } catch (err) {
      setToken(null);
      setUser(null);
      throw err;
    }
  }, []);

  // Session restoration on startup / page reload
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const response = await authApi.refreshToken();
        if (isMounted && response?.token && response?.user) {
          setToken(response.token);
          setUser(response.user);
        }
      } catch {
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Schedule automatic token refresh before 15-minute access token expiration
  useEffect(() => {
    if (!token) return;

    // Refresh at 14 minutes (840,000 ms)
    const refreshTimer = setTimeout(() => {
      refreshAccessToken().catch(() => {});
    }, 14 * 60 * 1000);

    return () => clearTimeout(refreshTimer);
  }, [token, refreshAccessToken]);

  const login = useCallback(async ({ email, password }) => {
    const result = await authApi.login({ email, password });
    if (result?.token && result?.user) {
      setToken(result.token);
      setUser(result.user);
    }
    return result;
  }, []);

  const signup = useCallback(async ({ email, password, firstName, lastName }) => {
    const result = await authApi.signup({ email, password, firstName, lastName });
    if (result?.token && result?.user) {
      setToken(result.token);
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;

    try {
      const response = await authApi.getCurrentUser(token);
      if (response?.user) {
        setUser(response.user);
      }
    } catch {
      try {
        await refreshAccessToken();
      } catch {
        logout();
      }
    }
  }, [token, logout, refreshAccessToken]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    signup,
    logout,
    refreshUser,
    refreshAccessToken,
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
