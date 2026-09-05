import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as applicationApi from '../services/applicationApi';

const ApplicationContext = createContext(null);

export function ApplicationProvider({ children }) {
  const { user, token, isAuthenticated, logout } = useAuth();

  // Map indexed by `${opportunityId}:${type}` -> application object
  const [applicationsMap, setApplicationsMap] = useState(new Map());
  const [updatingKeys, setUpdatingKeys] = useState(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = user?._id || user?.id || null;

  // Refresh application tracking records without N+1 requests
  const refreshApplications = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setApplicationsMap(new Map());
      setUpdatingKeys(new Set());
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);
    setError(null);

    try {
      const firstPage = await applicationApi.getApplications({ page: 1, limit: 50 }, token);
      const map = new Map();

      (firstPage.applications || []).forEach((appDoc) => {
        const oppId = appDoc.opportunity?._id || appDoc.opportunity?.id || appDoc.opportunityId;
        if (oppId && appDoc.type) {
          const key = `${oppId}:${appDoc.type}`;
          map.set(key, appDoc);
        }
      });

      const totalPages = firstPage.pagination?.pages || 1;
      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          const pageRes = await applicationApi.getApplications({ page: p, limit: 50 }, token);
          (pageRes.applications || []).forEach((appDoc) => {
            const oppId = appDoc.opportunity?._id || appDoc.opportunity?.id || appDoc.opportunityId;
            if (oppId && appDoc.type) {
              const key = `${oppId}:${appDoc.type}`;
              map.set(key, appDoc);
            }
          });
        }
      }

      setApplicationsMap(map);
    } catch (err) {
      if (err.status === 401) {
        logout();
      } else {
        setError(err.message || 'Unable to load application tracking data.');
      }
    } finally {
      setInitialLoading(false);
    }
  }, [token, isAuthenticated, logout]);

  // Handle User switch & session restoration
  useEffect(() => {
    if (token && isAuthenticated && userId) {
      refreshApplications();
    } else {
      setApplicationsMap(new Map());
      setUpdatingKeys(new Set());
      setInitialLoading(false);
      setError(null);
    }
  }, [userId, token, isAuthenticated, refreshApplications]);

  const getApplicationForOpportunity = useCallback((opportunityId, type) => {
    if (!opportunityId || !type) return null;
    const key = `${opportunityId}:${type}`;
    return applicationsMap.get(key) || null;
  }, [applicationsMap]);

  const isUpdating = useCallback((opportunityId, type) => {
    if (!opportunityId || !type) return false;
    const key = `${opportunityId}:${type}`;
    return updatingKeys.has(key);
  }, [updatingKeys]);

  const createTracking = useCallback(async (payload) => {
    if (!token || !isAuthenticated) {
      logout();
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    const { opportunityId, type } = payload;
    if (!opportunityId || !type) {
      return { success: false, error: 'Opportunity ID and tracking type are required.' };
    }

    const key = `${opportunityId}:${type}`;
    if (updatingKeys.has(key)) {
      return { success: false, error: 'Operation in progress' };
    }

    setUpdatingKeys((prev) => new Set(prev).add(key));

    try {
      const response = await applicationApi.createApplication(payload, token);
      const appDoc = response.application;

      if (appDoc) {
        setApplicationsMap((prev) => {
          const next = new Map(prev);
          next.set(key, appDoc);
          return next;
        });
      }

      return { success: true, application: appDoc };
    } catch (err) {
      if (err.status === 401) {
        logout();
      }
      return { success: false, error: err.message || 'Unable to create tracking record.' };
    } finally {
      setUpdatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [token, isAuthenticated, logout, updatingKeys]);

  const updateTracking = useCallback(async (opportunityId, type, payload) => {
    if (!token || !isAuthenticated) {
      logout();
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    if (!opportunityId || !type) {
      return { success: false, error: 'Opportunity ID and tracking type are required.' };
    }

    const key = `${opportunityId}:${type}`;
    if (updatingKeys.has(key)) {
      return { success: false, error: 'Operation in progress' };
    }

    setUpdatingKeys((prev) => new Set(prev).add(key));

    try {
      const response = await applicationApi.updateApplication(opportunityId, type, payload, token);
      const updatedDoc = response.application;

      if (updatedDoc) {
        setApplicationsMap((prev) => {
          const next = new Map(prev);
          next.set(key, updatedDoc);
          return next;
        });
      }

      return { success: true, application: updatedDoc };
    } catch (err) {
      if (err.status === 401) {
        logout();
      }
      return { success: false, error: err.message || 'Unable to update tracking record.' };
    } finally {
      setUpdatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [token, isAuthenticated, logout, updatingKeys]);

  const deleteTracking = useCallback(async (opportunityId, type) => {
    if (!token || !isAuthenticated) {
      logout();
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    if (!opportunityId || !type) {
      return { success: false, error: 'Opportunity ID and tracking type are required.' };
    }

    const key = `${opportunityId}:${type}`;
    if (updatingKeys.has(key)) {
      return { success: false, error: 'Operation in progress' };
    }

    setUpdatingKeys((prev) => new Set(prev).add(key));

    try {
      await applicationApi.deleteApplication(opportunityId, type, token);

      setApplicationsMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      return { success: true };
    } catch (err) {
      if (err.status === 401) {
        logout();
      }
      return { success: false, error: err.message || 'Unable to delete tracking record.' };
    } finally {
      setUpdatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [token, isAuthenticated, logout, updatingKeys]);

  const value = {
    applicationsMap,
    updatingKeys,
    initialLoading,
    error,
    refreshApplications,
    getApplicationForOpportunity,
    isUpdating,
    createTracking,
    updateTracking,
    deleteTracking,
  };

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplications() {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useApplications must be used within an ApplicationProvider');
  }
  return context;
}
