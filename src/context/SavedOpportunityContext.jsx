import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as savedOpportunityApi from '../services/savedOpportunityApi';

const SavedOpportunityContext = createContext(null);

export function SavedOpportunityProvider({ children }) {
  const { user, token, isAuthenticated, logout } = useAuth();

  const [savedIds, setSavedIds] = useState(new Set());
  const [savingIds, setSavingIds] = useState(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = user?._id || user?.id || null;

  // Refresh full list of saved opportunity IDs to populate shared Set without N+1 requests
  const refreshSaved = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setSavedIds(new Set());
      setSavingIds(new Set());
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);
    setError(null);

    try {
      const firstPage = await savedOpportunityApi.getSavedOpportunities({ page: 1, limit: 50 }, token);
      const ids = new Set();

      (firstPage.savedOpportunities || []).forEach((item) => {
        const oppId = item.opportunity?._id || item.opportunity?.id;
        if (oppId) ids.add(oppId);
      });

      const totalPages = firstPage.pagination?.pages || 1;
      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          const pageRes = await savedOpportunityApi.getSavedOpportunities({ page: p, limit: 50 }, token);
          (pageRes.savedOpportunities || []).forEach((item) => {
            const oppId = item.opportunity?._id || item.opportunity?.id;
            if (oppId) ids.add(oppId);
          });
        }
      }

      setSavedIds(ids);
    } catch (err) {
      if (err.status === 401) {
        logout();
      } else {
        setError(err.message || 'Unable to load saved opportunities.');
      }
    } finally {
      setInitialLoading(false);
    }
  }, [token, isAuthenticated, logout]);

  // Load / clear saved IDs whenever user or token changes (User Switch Safety)
  useEffect(() => {
    if (token && isAuthenticated && userId) {
      refreshSaved();
    } else {
      setSavedIds(new Set());
      setSavingIds(new Set());
      setInitialLoading(false);
      setError(null);
    }
  }, [userId, token, isAuthenticated, refreshSaved]);

  const isSaved = useCallback((opportunityId) => {
    if (!opportunityId) return false;
    return savedIds.has(String(opportunityId));
  }, [savedIds]);

  const isSaving = useCallback((opportunityId) => {
    if (!opportunityId) return false;
    return savingIds.has(String(opportunityId));
  }, [savingIds]);

  const toggleSave = useCallback(async (opportunityId) => {
    if (!token || !isAuthenticated) {
      logout();
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    const idStr = String(opportunityId);
    if (!idStr) return { success: false, error: 'Invalid opportunity ID' };

    // Prevent duplicate concurrent requests for the same opportunity
    if (savingIds.has(idStr)) {
      return { success: false, error: 'Operation in progress' };
    }

    const currentlySaved = savedIds.has(idStr);

    // Optimistic UI update
    setSavingIds((prev) => new Set(prev).add(idStr));
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (currentlySaved) {
        next.delete(idStr);
      } else {
        next.add(idStr);
      }
      return next;
    });

    try {
      if (currentlySaved) {
        await savedOpportunityApi.unsaveOpportunity(idStr, token);
      } else {
        await savedOpportunityApi.saveOpportunity(idStr, token);
      }
      return { success: true, saved: !currentlySaved };
    } catch (err) {
      // Failure Rollback: Revert saved state on error
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) {
          next.add(idStr);
        } else {
          next.delete(idStr);
        }
        return next;
      });

      if (err.status === 401) {
        logout();
      }

      return {
        success: false,
        error: err.message || 'Unable to update saved status. Please try again.',
      };
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
    }
  }, [token, isAuthenticated, logout, savedIds, savingIds]);

  const value = {
    savedIds,
    savingIds,
    initialLoading,
    error,
    isSaved,
    isSaving,
    toggleSave,
    refreshSaved,
  };

  return (
    <SavedOpportunityContext.Provider value={value}>
      {children}
    </SavedOpportunityContext.Provider>
  );
}

export function useSavedOpportunities() {
  const context = useContext(SavedOpportunityContext);
  if (!context) {
    throw new Error('useSavedOpportunities must be used within a SavedOpportunityProvider');
  }
  return context;
}
