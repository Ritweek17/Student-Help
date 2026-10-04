import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  FileCheck2,
  FileEdit,
  Archive,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Building2,
  MapPin,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as opportunityApi from '../../services/opportunityApi';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export function AdminOverviewPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    archived: 0,
    expired: 0,
  });

  const [recentOpportunities, setRecentOpportunities] = useState([]);

  const loadOverviewData = useCallback(async (signal, isManualRefresh = false) => {
    if (!token) return;

    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Parallel bounded queries for exact database counts and recent opportunities
      const [allRes, pubRes, draftRes, archRes, expRes] = await Promise.all([
        opportunityApi.getOpportunities({ status: 'all', sort: 'newest', limit: 6 }, token, signal),
        opportunityApi.getOpportunities({ status: 'published', limit: 1 }, token, signal),
        opportunityApi.getOpportunities({ status: 'draft', limit: 1 }, token, signal),
        opportunityApi.getOpportunities({ status: 'archived', limit: 1 }, token, signal),
        opportunityApi.getOpportunities({ status: 'expired', limit: 1 }, token, signal),
      ]);

      setStats({
        total: allRes?.pagination?.total || 0,
        published: pubRes?.pagination?.total || 0,
        draft: draftRes?.pagination?.total || 0,
        archived: archRes?.pagination?.total || 0,
        expired: expRes?.pagination?.total || 0,
      });

      setRecentOpportunities(allRes?.opportunities || []);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setError(err.message || 'Failed to load platform overview metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, logout, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    loadOverviewData(controller.signal);
    return () => controller.abort();
  }, [loadOverviewData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
              Admin Overview
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Live Data
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time health, curation state, and activity across the CareerOS opportunity catalog.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadOverviewData(undefined, true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>

          <Link to="/admin/opportunities?create=true">
            <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4" />
              <span>Create Opportunity</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Catalog Query Warning</h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadOverviewData(undefined, true)}>
            Retry
          </Button>
        </div>
      )}

      {/* Real Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Catalog"
          value={stats.total}
          subtitle="All opportunities in DB"
          icon={Compass}
          color="indigo"
        />
        <StatCard
          title="Published & Active"
          value={stats.published}
          subtitle="Visible to all students"
          icon={FileCheck2}
          color="emerald"
        />
        <StatCard
          title="Draft / Review"
          value={stats.draft}
          subtitle="Awaiting publishing"
          icon={FileEdit}
          color="amber"
        />
        <StatCard
          title="Archived & Expired"
          value={stats.archived + stats.expired}
          subtitle={`${stats.archived} archived, ${stats.expired} expired`}
          icon={Archive}
          color="slate"
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Curation Management
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white font-heading">
              Manage Opportunity Catalog
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Filter by status, search by keywords, edit fields, curate verification tags, and manage archives.
            </p>
          </div>
          <Link to="/admin/opportunities">
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Student Perspective
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white font-heading">
              Preview Student Discovery
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Inspect how active published opportunities appear on student feeds and opportunity detail pages.
            </p>
          </div>
          <Link to="/opportunities">
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
              <span>Explore</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Opportunities Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white font-heading">
              Recently Created / Updated Opportunities
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing the most recent 6 opportunities from database
            </p>
          </div>
          <Link to="/admin/opportunities" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
            <span>Manage All ({stats.total})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOpportunities.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            No opportunities found in the database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Title & Organization</th>
                  <th className="py-3 px-4">Type & Mode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentOpportunities.map((opp) => (
                  <tr key={opp._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-sm">
                        {opp.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{opp.organization}</span>
                        {opp.location?.city && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-0.5 text-[11px]">
                              <MapPin className="w-2.5 h-2.5" />
                              {opp.location.city}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-200 capitalize">
                        {opp.type ? opp.type.replace('_', ' ') : 'General'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        {opp.workMode || 'Unspecified'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={opp.status || 'draft'} />
                    </td>
                    <td className="py-3.5 px-4">
                      {opp.verified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950 dark:text-blue-300">
                          <Sparkles className="w-3 h-3 text-blue-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {opp.deadline ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(opp.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-slate-400">Rolling</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <Link
                        to={`/admin/opportunities?edit=${opp._id}`}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        Edit
                      </Link>
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
