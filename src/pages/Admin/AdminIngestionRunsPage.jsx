import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as adminIngestionApi from '../../services/adminIngestionApi';
import { RefreshCw, List, ChevronLeft, ChevronRight, Activity, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function AdminIngestionRunsPage() {
  const { token } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState('all');

  const fetchRuns = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 15 };
      if (selectedStatus !== 'all') params.status = selectedStatus;

      const data = await adminIngestionApi.getIngestionRuns(params, token);
      setRuns(data.runs || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to fetch ingestion runs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, page, selectedStatus]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Ingestion Runs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor background ingestion pipeline execution history and metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRuns(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Error Loading Runs</h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3 font-medium">Loading ingestion history...</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center">
            <List className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">No Runs Found</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              There is no ingestion execution history matching your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Run Info</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Timing</th>
                  <th className="py-3.5 px-4">Metrics</th>
                  <th className="py-3.5 px-4">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {runs.map((run) => (
                  <tr key={run._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-500" />
                        {run.sourceId?.name || 'Unknown Source'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 uppercase tracking-widest text-[10px]">
                        ID: {run._id.slice(-8)} | {run.triggeredBy}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize
                        ${run.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                        run.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
                        run.status === 'partial' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                        'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-400">
                      <div><span className="font-medium text-slate-800 dark:text-slate-300">Started:</span> {new Date(run.startedAt).toLocaleString()}</div>
                      {run.completedAt && (
                        <div><span className="font-medium text-slate-800 dark:text-slate-300">Ended:</span> {new Date(run.completedAt).toLocaleTimeString()}</div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-xs space-y-0.5">
                      <div className="text-slate-700 dark:text-slate-300"><span className="text-slate-500">Fetched:</span> {run.fetchedCount}</div>
                      <div className="text-emerald-600 dark:text-emerald-400"><span className="text-slate-500">Created:</span> {run.createdCount}</div>
                      <div className="text-blue-600 dark:text-blue-400"><span className="text-slate-500">Updated:</span> {run.updatedCount}</div>
                      <div className="text-slate-500"><span className="text-slate-500">Dups:</span> {run.duplicateCount}</div>
                    </td>
                    <td className="py-4 px-4 text-xs">
                      {(run.failedCount > 0 || run.invalidCount > 0) ? (
                        <div className="text-red-600 dark:text-red-400">
                          {run.failedCount > 0 && <div>Failed: {run.failedCount}</div>}
                          {run.invalidCount > 0 && <div>Invalid: {run.invalidCount}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {run.errorMessage && (
                        <div className="mt-1 max-w-[200px] truncate text-red-500" title={run.errorMessage}>
                          {run.errorMessage}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing Page <span className="font-semibold text-slate-900 dark:text-white">{pagination.page}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{pagination.pages}</span> ({pagination.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page >= pagination.pages}
                className="gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
