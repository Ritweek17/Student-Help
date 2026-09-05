import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as notificationApi from '../services/notificationApi';

const NotificationContext = createContext(null);

const DEFAULT_LIMIT = 20;

/**
 * NotificationProvider — Single source of truth for notification state.
 *
 * Provides real-time notification data from backend, unread count,
 * filtering, pagination, and all notification actions (mark read,
 * dismiss, delete). Uses AbortController for race safety.
 */
export function NotificationProvider({ children }) {
  const { user, token, isAuthenticated, logout } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [filters, setFiltersState] = useState({ read: undefined, type: undefined, page: 1, limit: DEFAULT_LIMIT });

  const userId = user?._id || user?.id || null;
  const abortControllerRef = useRef(null);

  // ─── Fetch notification list ──────────────────────────────────────
  const refreshNotifications = useCallback(async (currentFilters) => {
    const activeFilters = currentFilters || filters;
    if (!token || !isAuthenticated) {
      setNotifications([]);
      setPagination({ page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
      setLoading(false);
      return;
    }

    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = {
        page: activeFilters.page || 1,
        limit: activeFilters.limit || DEFAULT_LIMIT,
      };
      if (activeFilters.read !== undefined && activeFilters.read !== null) {
        params.read = activeFilters.read;
      }
      if (activeFilters.type) {
        params.type = activeFilters.type;
      }

      const result = await notificationApi.getNotifications(params, token, controller.signal);

      // Only apply if this controller is still active (not aborted)
      if (!controller.signal.aborted) {
        setNotifications(result.notifications || []);
        setPagination(result.pagination || { page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        return;
      }
      if (!controller.signal.aborted) {
        setError(err.message || 'Unable to load notifications.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, isAuthenticated, filters, logout]);

  // ─── Fetch unread count ───────────────────────────────────────────
  const refreshUnreadCount = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const result = await notificationApi.getUnreadCount(token);
      setUnreadCount(result.unreadCount ?? 0);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      // Silently fail for count — don't block UI
    }
  }, [token, isAuthenticated, logout]);

  // ─── Set filters (resets page, triggers refetch) ──────────────────
  const setFilters = useCallback((newFilters) => {
    setFiltersState((prev) => {
      const merged = { ...prev, ...newFilters };
      // Reset page to 1 when changing read/type filters
      if (newFilters.read !== undefined || newFilters.type !== undefined) {
        merged.page = 1;
      }
      return merged;
    });
  }, []);

  // ─── Mark single notification as read ─────────────────────────────
  const markRead = useCallback(async (id) => {
    if (!token || !isAuthenticated) return;

    const target = notifications.find((n) => n._id === id);
    if (!target || target.read) return; // Already read — do not decrement

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setActionError(null);

    try {
      await notificationApi.markRead(id, token);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      // Rollback
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: false, readAt: null } : n))
      );
      setUnreadCount((prev) => prev + 1);
      setActionError(err.message || 'Unable to mark notification as read.');
    }
  }, [token, isAuthenticated, notifications, logout]);

  // ─── Mark all read ────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!token || !isAuthenticated) return;
    setActionError(null);

    // Snapshot for rollback
    const prevNotifications = [...notifications];
    const prevUnreadCount = unreadCount;

    // Optimistic update
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true, readAt: now }))
    );

    try {
      await notificationApi.markAllRead(token);
      // Refresh unread count from server for accuracy
      await refreshUnreadCount();
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      // Rollback
      setNotifications(prevNotifications);
      setUnreadCount(prevUnreadCount);
      setActionError(err.message || 'Unable to mark all notifications as read.');
    }
  }, [token, isAuthenticated, notifications, unreadCount, refreshUnreadCount, logout]);

  // ─── Dismiss notification ─────────────────────────────────────────
  const dismiss = useCallback(async (id) => {
    if (!token || !isAuthenticated) return;
    setActionError(null);

    // Snapshot for rollback
    const prevNotifications = [...notifications];

    // Remove from list (default feed hides dismissed)
    setNotifications((prev) => prev.filter((n) => n._id !== id));

    try {
      await notificationApi.dismissNotification(id, token);
      // Do NOT decrement unreadCount — dismissed !== read
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      // Rollback
      setNotifications(prevNotifications);
      setActionError(err.message || 'Unable to dismiss notification.');
    }
  }, [token, isAuthenticated, notifications, logout]);

  // ─── Delete notification ──────────────────────────────────────────
  const deleteNotification = useCallback(async (id) => {
    if (!token || !isAuthenticated) return;
    setActionError(null);

    const target = notifications.find((n) => n._id === id);
    const wasUnread = target && !target.read;

    // Snapshot for rollback
    const prevNotifications = [...notifications];
    const prevUnreadCount = unreadCount;

    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await notificationApi.deleteNotification(id, token);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      // Rollback
      setNotifications(prevNotifications);
      setUnreadCount(prevUnreadCount);
      setActionError(err.message || 'Unable to delete notification.');
    }
  }, [token, isAuthenticated, notifications, unreadCount, logout]);

  // ─── Auth lifecycle: load on auth, clear on logout/switch ─────────
  useEffect(() => {
    if (token && isAuthenticated && userId) {
      refreshNotifications(filters);
      refreshUnreadCount();
    } else {
      // Clear all state on logout
      setNotifications([]);
      setPagination({ page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
      setUnreadCount(0);
      setLoading(false);
      setError(null);
      setActionError(null);
      setFiltersState({ read: undefined, type: undefined, page: 1, limit: DEFAULT_LIMIT });
    }

    // Cleanup: abort on unmount or user switch
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token, isAuthenticated]);

  // ─── Refetch when filters change ──────────────────────────────────
  useEffect(() => {
    if (token && isAuthenticated && userId) {
      refreshNotifications(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const value = {
    notifications,
    pagination,
    unreadCount,
    loading,
    error,
    actionError,
    filters,
    refreshNotifications,
    refreshUnreadCount,
    markRead,
    markAllRead,
    dismiss,
    deleteNotification,
    setFilters,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
