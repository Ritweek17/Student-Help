import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as adminIngestionApi from '../../services/adminIngestionApi';
import { RefreshCw, Activity, Power, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function AdminSourcesPage() {
  const { token } = useAuth();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [savingSourceId, setSavingSourceId] = useState(null);

  const fetchSources = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await adminIngestionApi.getSources(token);
      setSources(data.sources || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch sources');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const toggleEnabled = async (source) => {
    if (!token) return;
    setSavingSourceId(source._id);
    try {
      await adminIngestionApi.updateSource(source._id, { enabled: !source.enabled }, token);
      await fetchSources(true);
    } catch (err) {
      alert(err.message || 'Failed to update source');
    } finally {
      setSavingSourceId(null);
    }
  };

  const updatePriority = async (source, newPriority) => {
    const priority = parseInt(newPriority, 10);
    if (isNaN(priority) || priority < 0) return;
    if (priority === source.priority) return;

    if (!token) return;
    setSavingSourceId(source._id);
    try {
      await adminIngestionApi.updateSource(source._id, { priority }, token);
      await fetchSources(true);
    } catch (err) {
      alert(err.message || 'Failed to update priority');
    } finally {
      setSavingSourceId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Ingestion Sources
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage external opportunity sources and view their health telemetry.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchSources(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Error Loading Sources</h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3 font-medium">Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">No Sources Configured</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              There are no opportunity ingestion sources currently available in the database.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Source</th>
                  <th className="py-3.5 px-4">Telemetry</th>
                  <th className="py-3.5 px-4 text-center">Priority</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {sources.map((source) => (
                  <tr key={source._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {source.name}
                        {source.isLocked && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400">
                            <ShieldCheck className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Slug: {source.slug} | Type: {source.type}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <div className="space-y-1">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Last Run: </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {source.lastRunAt ? new Date(source.lastRunAt).toLocaleString() : 'Never'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Success: </span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {source.lastSuccessAt ? new Date(source.lastSuccessAt).toLocaleString() : 'Never'}
                          </span>
                        </div>
                        {source.lastError && (
                          <div className="text-red-600 dark:text-red-400 mt-1">
                            Failed: {source.lastFailureAt ? new Date(source.lastFailureAt).toLocaleString() : 'N/A'}<br/>
                            Reason: {source.lastError}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        defaultValue={source.priority}
                        onBlur={(e) => updatePriority(source, e.target.value)}
                        disabled={savingSourceId === source._id}
                        className="w-20 text-center px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Button
                        variant={source.enabled ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => toggleEnabled(source)}
                        disabled={savingSourceId === source._id}
                        className={`gap-1 ${source.enabled ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/60 dark:hover:bg-emerald-900/30' : ''}`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {source.enabled ? 'Enabled' : 'Disabled'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
