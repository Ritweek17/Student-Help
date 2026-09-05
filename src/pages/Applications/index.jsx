import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  FileText,
  ChevronRight,
  Building2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ExternalLink,
  Trash2,
  Edit3,
  Filter
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ApplicationCard } from '../../components/cards/ApplicationCard';
import { useAuth } from '../../context/AuthContext';
import { useApplications } from '../../context/ApplicationContext';
import { APPLICATION_STATUSES, REGISTRATION_STATUSES } from '../../utils/trackingTypeHelper';
import * as applicationApi from '../../services/applicationApi';

export function ApplicationsPage() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const { updateTracking, deleteTracking, refreshApplications } = useApplications();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  // Filters & Page
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Drawer / Edit / Delete Modals
  const [selectedApp, setSelectedApp] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Edit fields inside Drawer
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editExternalUrl, setEditExternalUrl] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadApplicationsData = useCallback(async (abortSignal) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: 20,
    };

    if (typeFilter !== 'All') {
      params.type = typeFilter;
    }

    if (statusFilter !== 'All') {
      params.status = statusFilter;
    }

    try {
      const response = await applicationApi.getApplications(params, token, abortSignal);
      const validApps = (response.applications || []).filter((app) => app && app.opportunity);
      setApplications(validApps);
      setPagination(response.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Unable to load your applications.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, page, typeFilter, statusFilter, logout]);

  useEffect(() => {
    const controller = new AbortController();
    loadApplicationsData(controller.signal);
    return () => controller.abort();
  }, [loadApplicationsData]);

  const handleTypeFilterChange = (typeVal) => {
    setTypeFilter(typeVal);
    setStatusFilter('All');
    setPage(1);
  };

  const handleStatusFilterChange = (statusVal) => {
    setStatusFilter(statusVal);
    setPage(1);
  };

  const handleOpenDetails = (app) => {
    setSelectedApp(app);
    setEditStatus(app.status || '');
    setEditNotes(app.notes || '');
    setEditExternalUrl(app.externalUrl || '');
    setDrawerOpen(true);
  };

  const handleSaveAppUpdates = async () => {
    if (!selectedApp || !selectedApp.opportunity) return;
    const oppId = selectedApp.opportunity._id || selectedApp.opportunity.id;
    const type = selectedApp.type;

    setActionLoading(true);
    try {
      const res = await updateTracking(oppId, type, {
        status: editStatus,
        notes: editNotes,
        externalUrl: editExternalUrl,
      });

      if (res.success) {
        setApplications((prev) =>
          prev.map((a) =>
            a._id === selectedApp._id || (a.opportunity?._id === oppId && a.type === type)
              ? { ...a, ...res.application, opportunity: a.opportunity }
              : a
          )
        );
        setSelectedApp((prev) => (prev ? { ...prev, ...res.application } : null));
        setDrawerOpen(false);
      } else {
        alert(res.error || 'Unable to update tracking details.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!selectedApp || !selectedApp.opportunity) return;
    const oppId = selectedApp.opportunity._id || selectedApp.opportunity.id;
    const type = selectedApp.type;

    setActionLoading(true);
    try {
      const res = await deleteTracking(oppId, type);
      if (res.success) {
        setApplications((prev) => {
          const next = prev.filter(
            (a) => !(a.opportunity?._id === oppId && a.type === type)
          );

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

        setDeleteModalOpen(false);
        setDrawerOpen(false);
        setSelectedApp(null);
      } else {
        alert(res.error || 'Unable to delete tracking record.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Pipeline Metric Counts
  const counts = {
    Applied: applications.filter((a) => a.status === 'applied' || a.status === 'registered').length,
    Interview: applications.filter((a) => a.status === 'interview' || a.status === 'attended').length,
    Waiting: applications.filter((a) => a.status === 'waiting').length,
    Selected: applications.filter((a) => a.status === 'selected' || a.status === 'completed').length,
    Rejected: applications.filter((a) => a.status === 'rejected' || a.status === 'cancelled').length,
  };

  const availableStatuses = typeFilter === 'registration' ? REGISTRATION_STATUSES : typeFilter === 'application' ? APPLICATION_STATUSES : [...APPLICATION_STATUSES, ...REGISTRATION_STATUSES];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Application Tracker"
        subtitle="Manage your active job applications, interview timelines, and registrations."
      />

      {/* Summary Pipeline Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { status: 'Applied / Registered', count: counts.Applied, bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
          { status: 'Interview / Attended', count: counts.Interview, bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
          { status: 'Waiting Stage', count: counts.Waiting, bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
          { status: 'Selected / Completed', count: counts.Selected, bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
          { status: 'Rejected / Cancelled', count: counts.Rejected, bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' }
        ].map((item, idx) => (
          <Card key={idx} padding="sm" className={`border ${item.bg} text-center`}>
            <span className="text-2xl font-bold font-heading block">{item.count}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.status}</span>
          </Card>
        ))}
      </div>

      {/* Filter Header Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Type:
          </span>
          {['All', 'application', 'registration'].map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilterChange(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t === 'All' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {pagination.total} Total Tracked
          </span>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
              Unable to Load Applications
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">{error}</p>
          </div>
          <Button size="sm" icon={RefreshCw} onClick={() => loadApplicationsData()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <LoadingState text="Loading applications..." />
      ) : applications.length > 0 ? (
        <div className="space-y-6">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {applications.map((appItem) => (
                <ApplicationCard
                  key={appItem._id || `${appItem.opportunity?._id}:${appItem.type}`}
                  application={{
                    id: appItem._id,
                    role: appItem.opportunity?.title || 'Role',
                    organization: appItem.opportunity?.organization || 'Organization',
                    appliedDate: appItem.appliedAt
                      ? new Date(appItem.appliedAt).toLocaleDateString()
                      : appItem.registeredAt
                      ? new Date(appItem.registeredAt).toLocaleDateString()
                      : new Date(appItem.createdAt).toLocaleDateString(),
                    status: appItem.status,
                    notes: appItem.notes,
                    type: appItem.type,
                  }}
                  onViewDetails={() => handleOpenDetails(appItem)}
                />
              ))}
            </div>
          ) : (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Opportunity & Organization</th>
                      <th className="px-4 py-3.5">Type</th>
                      <th className="px-4 py-3.5">Date Logged</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Notes</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {applications.map((appItem) => (
                      <tr
                        key={appItem._id || `${appItem.opportunity?._id}:${appItem.type}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetails(appItem)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <Link
                                to={`/opportunities/${appItem.opportunity?._id || appItem.opportunity?.id}`}
                                className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {appItem.opportunity?.title}
                              </Link>
                              <span className="text-xs text-slate-500">{appItem.opportunity?.organization}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase">
                            {appItem.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {appItem.appliedAt
                            ? new Date(appItem.appliedAt).toLocaleDateString()
                            : appItem.registeredAt
                            ? new Date(appItem.registeredAt).toLocaleDateString()
                            : new Date(appItem.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <StatusBadge status={appItem.status} />
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-xs max-w-[200px] truncate">
                          {appItem.notes || <span className="italic text-slate-400">No notes</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button size="sm" variant="ghost" icon={ChevronRight}>
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Showing Page <span className="font-bold text-slate-900 dark:text-white">{pagination.page}</span> of{' '}
                <span className="font-bold text-slate-900 dark:text-white">{pagination.pages}</span> ({pagination.total} records tracked)
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
                  icon={ChevronRightIcon}
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
          icon={Briefcase}
          title="No applications or registrations yet."
          description="Track the opportunities you've applied to or registered for."
          actionLabel="Explore opportunities"
          onAction={() => navigate('/opportunities')}
        />
      )}

      {/* Application Detail & Edit Drawer */}
      {selectedApp && selectedApp.opportunity && (
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`${selectedApp.opportunity.organization} — ${selectedApp.opportunity.title}`}
        >
          <div className="space-y-6 text-xs sm:text-sm">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-xs">Current Stage</span>
                <StatusBadge status={selectedApp.status} />
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-xs">Tracking Category</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{selectedApp.type}</span>
              </div>
            </div>

            {/* Stage Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Update Stage
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium text-xs sm:text-sm"
              >
                {(selectedApp.type === 'registration' ? REGISTRATION_STATUSES : APPLICATION_STATUSES).map((st) => (
                  <option key={st} value={st}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes Field */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Personal Tracking Notes
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add interview notes, portal link confirmation, etc..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm"
              />
            </div>

            {/* External URL Field */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                External Application Portal URL
              </label>
              <input
                type="url"
                value={editExternalUrl}
                onChange={(e) => setEditExternalUrl(e.target.value)}
                placeholder="https://company-portal.com/status/123"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                icon={Trash2}
                onClick={() => setDeleteModalOpen(true)}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={actionLoading} onClick={handleSaveAppUpdates}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Remove Tracking Record?"
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to remove your tracking record for{' '}
            <span className="font-bold">{selectedApp?.opportunity?.title}</span>? This will remove it from your personal application board.
          </p>
          <div className="pt-3 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={actionLoading}
              onClick={handleDeleteApp}
            >
              {actionLoading ? 'Removing...' : 'Confirm Remove'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
