import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as calendarApi from '../services/calendarApi';

const CalendarContext = createContext(null);

const DEFAULT_LIMIT = 50;

/**
 * CalendarProvider — Single source of truth for CareerOS calendar events.
 *
 * Provides live calendar data from the Express backend, filtering, pagination,
 * and optimistic mutations (create, update, delete) with rollback on failure.
 * Implements AbortController for race-condition prevention and automatically
 * handles session expirations (HTTP 401).
 */
export function CalendarProvider({ children }) {
  const { user, token, isAuthenticated, logout } = useAuth();

  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [filters, setFiltersState] = useState({ type: undefined, status: undefined, page: 1, limit: DEFAULT_LIMIT });

  const userId = user?._id || user?.id || null;
  const abortControllerRef = useRef(null);

  // ─── Fetch calendar event list ─────────────────────────────────────
  const refreshEvents = useCallback(async (currentFilters) => {
    const activeFilters = currentFilters || filters;
    if (!token || !isAuthenticated) {
      setEvents([]);
      setPagination({ page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
      setLoading(false);
      return;
    }

    // Abort any prior in-flight request
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
      if (activeFilters.type) params.type = activeFilters.type;
      if (activeFilters.status) params.status = activeFilters.status;
      if (activeFilters.startAfter) params.startAfter = activeFilters.startAfter;
      if (activeFilters.startBefore) params.startBefore = activeFilters.startBefore;

      const result = await calendarApi.getCalendarEvents(params, token, controller.signal);

      if (!controller.signal.aborted) {
        setEvents(result.events || []);
        setPagination(result.pagination || { page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        return;
      }
      if (!controller.signal.aborted) {
        setError(err.message || 'Unable to load calendar events.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, isAuthenticated, filters, logout]);

  // ─── Filter updater ───────────────────────────────────────────────
  const setFilters = useCallback((newFilters) => {
    setFiltersState((prev) => {
      const merged = { ...prev, ...newFilters };
      if (newFilters.type !== undefined || newFilters.status !== undefined) {
        merged.page = 1;
      }
      return merged;
    });
  }, []);

  // ─── Create Event ─────────────────────────────────────────────────
  const createEvent = useCallback(async (payload) => {
    if (!token || !isAuthenticated) return null;
    setActionError(null);

    try {
      const res = await calendarApi.createCalendarEvent(payload, token);
      if (res?.event) {
        setEvents((prev) => {
          const updated = [...prev, res.event];
          return updated.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
        });
        setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
        return res.event;
      }
      return null;
    } catch (err) {
      if (err.status === 401) {
        logout();
        return null;
      }
      setActionError(err.message || 'Unable to create calendar event.');
      throw err;
    }
  }, [token, isAuthenticated, logout]);

  // ─── Update Event ─────────────────────────────────────────────────
  const updateEvent = useCallback(async (id, payload) => {
    if (!token || !isAuthenticated) return null;
    setActionError(null);

    const prevEvents = [...events];

    // Optimistic update
    setEvents((prev) =>
      prev
        .map((e) => (e._id === id ? { ...e, ...payload, updatedAt: new Date().toISOString() } : e))
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    );

    try {
      const res = await calendarApi.updateCalendarEvent(id, payload, token);
      if (res?.event) {
        setEvents((prev) =>
          prev
            .map((e) => (e._id === id ? res.event : e))
            .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
        );
        return res.event;
      }
      return null;
    } catch (err) {
      if (err.status === 401) {
        logout();
        return null;
      }
      // Rollback
      setEvents(prevEvents);
      setActionError(err.message || 'Unable to update calendar event.');
      throw err;
    }
  }, [token, isAuthenticated, events, logout]);

  // ─── Delete Event ─────────────────────────────────────────────────
  const deleteEvent = useCallback(async (id) => {
    if (!token || !isAuthenticated) return false;
    setActionError(null);

    const prevEvents = [...events];
    const prevPagination = { ...pagination };

    // Optimistic update
    setEvents((prev) => prev.filter((e) => e._id !== id));
    setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));

    try {
      await calendarApi.deleteCalendarEvent(id, token);
      return true;
    } catch (err) {
      if (err.status === 401) {
        logout();
        return false;
      }
      // Rollback
      setEvents(prevEvents);
      setPagination(prevPagination);
      setActionError(err.message || 'Unable to delete calendar event.');
      throw err;
    }
  }, [token, isAuthenticated, events, pagination, logout]);

  // ─── Auth Lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (token && isAuthenticated && userId) {
      refreshEvents(filters);
    } else {
      setEvents([]);
      setPagination({ page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 });
      setLoading(false);
      setError(null);
      setActionError(null);
      setFiltersState({ type: undefined, status: undefined, page: 1, limit: DEFAULT_LIMIT });
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token, isAuthenticated]);

  // ─── Filter Change Lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (token && isAuthenticated && userId) {
      refreshEvents(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const value = {
    events,
    pagination,
    loading,
    error,
    actionError,
    filters,
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setFilters,
    clearActionError: () => setActionError(null),
  };

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
