import React, { useState, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { NotificationItem } from '../../components/cards/NotificationItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useNotifications } from '../../context/NotificationContext';

/**
 * Backend notification types — must match server/src/models/Notification.js
 */
const NOTIFICATION_TYPES = [
  { value: undefined, label: 'All Types' },
  { value: 'application_deadline', label: 'Application Deadline' },
  { value: 'registration_event', label: 'Registration Event' },
  { value: 'calendar_reminder', label: 'Calendar Reminder' },
  { value: 'opportunity_deadline', label: 'Opportunity Deadline' },
  { value: 'application_update', label: 'Application Update' },
  { value: 'registration_update', label: 'Registration Update' },
  { value: 'system', label: 'System' },
];

/**
 * Read/unread status filters
 */
const STATUS_FILTERS = [
  { value: undefined, label: 'All' },
  { value: false, label: 'Unread' },
  { value: true, label: 'Read' },
];

export function NotificationsPage() {
  const {
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
  } = useNotifications();

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // ─── Filter handlers ──────────────────────────────────────────────
  const handleStatusFilter = useCallback((readValue) => {
    setFilters({ read: readValue });
  }, [setFilters]);

  const handleTypeFilter = useCallback((typeValue) => {
    setFilters({ type: typeValue });
  }, [setFilters]);

  // ─── Pagination ───────────────────────────────────────────────────
  const handlePrevPage = useCallback(() => {
    if (pagination.page > 1) {
      setFilters({ page: pagination.page - 1 });
    }
  }, [pagination.page, setFilters]);

  const handleNextPage = useCallback(() => {
    if (pagination.page < pagination.pages) {
      setFilters({ page: pagination.page + 1 });
    }
  }, [pagination.page, pagination.pages, setFilters]);

  // ─── Retry ────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    refreshNotifications();
    refreshUnreadCount();
  }, [refreshNotifications, refreshUnreadCount]);

  // ─── Delete with confirmation ─────────────────────────────────────
  const handleDeleteRequest = useCallback((id) => {
    setDeleteConfirmId(id);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirmId) {
      deleteNotification(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, deleteNotification]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  // ─── Determine active status filter ───────────────────────────────
  const activeStatusValue = filters.read;
  const activeTypeValue = filters.type;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Notifications Center"
        subtitle="Stay on top of deadlines, application updates, and calendar reminders."
        action={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" icon={CheckCheck} onClick={markAllRead}>
                Mark All as Read
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={handleRetry}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Action error toast */}
      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60" role="alert">
          <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            Permanently delete this notification? This action cannot be undone.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Status filter pills */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.label}
              onClick={() => handleStatusFilter(sf.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeStatusValue === sf.value
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              aria-pressed={activeStatusValue === sf.value}
            >
              {sf.label}
              {sf.label === 'Unread' && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-white/20">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200 dark:border-slate-800">
          {NOTIFICATION_TYPES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => handleTypeFilter(tf.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTypeValue === tf.value
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              aria-pressed={activeTypeValue === tf.value}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        <LoadingState text="Loading notifications..." />
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Unable to load notifications"
          description={error}
          actionLabel="Retry"
          onAction={handleRetry}
        />
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <NotificationItem
              key={notif._id}
              notification={notif}
              onMarkRead={markRead}
              onDismiss={dismiss}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You're all caught up! New alerts will appear here as deadlines approach."
        />
      )}

      {/* Pagination */}
      {!loading && !error && pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page {pagination.page} of {pagination.pages} · {pagination.total} notification{pagination.total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={ChevronLeft}
              onClick={handlePrevPage}
              disabled={pagination.page <= 1}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextPage}
              disabled={pagination.page >= pagination.pages}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
