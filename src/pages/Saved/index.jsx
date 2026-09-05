import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { OpportunityCard } from '../../components/cards/OpportunityCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useSavedOpportunities } from '../../context/SavedOpportunityContext';
import * as savedOpportunityApi from '../../services/savedOpportunityApi';

export function SavedPage() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const { toggleSave } = useSavedOpportunities();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedItems, setSavedItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('All');

  const fetchSavedPageData = useCallback(async (abortSignal) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await savedOpportunityApi.getSavedOpportunities({ page, limit: 20 }, token, abortSignal);
      const list = response.savedOpportunities || [];
      // Gracefully filter out null or unpublished opportunity records (Archived/Hidden data safety)
      const validList = list.filter((item) => item && item.opportunity);
      setSavedItems(validList);
      setPagination(response.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Unable to load saved opportunities.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, page, logout]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSavedPageData(controller.signal);
    return () => controller.abort();
  }, [fetchSavedPageData]);

  const handleToggleSave = async (oppId) => {
    const res = await toggleSave(oppId);
    if (res.success) {
      setSavedItems((prev) => {
        const next = prev.filter((item) => {
          const id = item.opportunity?._id || item.opportunity?.id;
          return id !== oppId;
        });

        // If removing the last item on current page and page > 1, navigate to previous page
        if (next.length === 0 && page > 1) {
          setPage((p) => Math.max(p - 1, 1));
        } else {
          setPagination((p) => {
            const nextTotal = Math.max(p.total - 1, 0);
            return {
              ...p,
              total: nextTotal,
              pages: Math.ceil(nextTotal / p.limit) || 1,
            };
          });
        }

        return next;
      });
    }
  };

  const validOpps = savedItems
    .map((item) => item.opportunity)
    .filter(Boolean);

  const tabs = [
    { id: 'All', label: 'All Saved', count: pagination.total || validOpps.length },
    { id: 'Interested', label: 'Interested', count: validOpps.filter((o) => !o.applicationStatus).length },
    { id: 'Applied', label: 'Applied', count: validOpps.filter((o) => o.applicationStatus === 'Applied').length },
    { id: 'Expired', label: 'Expired / Closed', count: 0 }
  ];

  const filteredOpps = validOpps.filter((opp) => {
    if (activeTab === 'Interested') return !opp.applicationStatus;
    if (activeTab === 'Applied') return opp.applicationStatus === 'Applied';
    if (activeTab === 'Expired') return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Saved Opportunities"
        subtitle="Keep track of bookmarked internships, hackathons, and fellowships."
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {error ? (
        <div className="p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
              Unable to Load Saved Opportunities
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">{error}</p>
          </div>
          <Button size="sm" icon={RefreshCw} onClick={() => fetchSavedPageData()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <LoadingState text="Loading saved opportunities..." />
      ) : filteredOpps.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOpps.map((opp) => (
              <OpportunityCard
                key={opp._id || opp.id}
                opportunity={opp}
                isSavedState={true}
                onToggleSave={handleToggleSave}
              />
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Showing Page <span className="font-bold text-slate-900 dark:text-white">{pagination.page}</span> of{' '}
                <span className="font-bold text-slate-900 dark:text-white">{pagination.pages}</span> ({pagination.total} saved opportunities)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronRight}
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => Math.min(p + 1, pagination.pages))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No saved opportunities yet."
          description="Save opportunities you're interested in and they'll appear here."
          actionLabel="Explore Opportunities Feed"
          onAction={() => navigate('/opportunities')}
        />
      )}
    </div>
  );
}
