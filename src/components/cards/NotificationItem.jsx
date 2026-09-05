import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Calendar,
  Award,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowUpRight,
  Eye,
  EyeOff,
  Trash2,
  Clock,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * Notification type → display label mapping
 */
const TYPE_LABELS = {
  application_deadline: 'Application Deadline',
  registration_event: 'Registration Event',
  calendar_reminder: 'Calendar Reminder',
  opportunity_deadline: 'Opportunity Deadline',
  application_update: 'Application Update',
  registration_update: 'Registration Update',
  system: 'System',
};

/**
 * Notification type → badge variant mapping
 */
const TYPE_BADGE_VARIANT = {
  application_deadline: 'warning',
  registration_event: 'info',
  calendar_reminder: 'primary',
  opportunity_deadline: 'warning',
  application_update: 'success',
  registration_update: 'success',
  system: 'default',
};

/**
 * Format ISO date string as relative time
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 30) return `${diffDay} days ago`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

/**
 * Get icon for notification type
 */
function getTypeIcon(type) {
  switch (type) {
    case 'application_deadline':
    case 'opportunity_deadline':
      return <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />;
    case 'application_update':
      return <Award className="w-4 h-4 text-blue-700 dark:text-blue-400" />;
    case 'registration_event':
    case 'registration_update':
      return <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />;
    case 'calendar_reminder':
      return <Calendar className="w-4 h-4 text-sky-700 dark:text-sky-400" />;
    case 'system':
      return <Bell className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />;
    default:
      return <Info className="w-4 h-4 text-slate-500" />;
  }
}

/**
 * Build navigation link from notification's linked entities
 */
function getEntityLink(notification) {
  if (notification.opportunity && notification.opportunity._id) {
    return {
      url: `/opportunities/${notification.opportunity._id}`,
      text: notification.opportunity.title || 'View Opportunity',
    };
  }
  if (notification.application && notification.application._id) {
    return {
      url: '/applications',
      text: 'View Application',
    };
  }
  if (notification.calendarEvent && notification.calendarEvent._id) {
    return {
      url: '/calendar',
      text: notification.calendarEvent.title || 'View Calendar Event',
    };
  }
  return null;
}

export function NotificationItem({ notification, onMarkRead, onDismiss, onDelete }) {
  const entityLink = getEntityLink(notification);
  const isUnread = !notification.read;

  const handleMarkRead = (e) => {
    e.stopPropagation();
    if (onMarkRead && isUnread) {
      onMarkRead(notification._id);
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss(notification._id);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notification._id);
    }
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all flex items-start gap-4 group ${
        isUnread
          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/60'
          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
      }`}
      role="article"
      aria-label={`${isUnread ? 'Unread notification: ' : 'Notification: '}${notification.title}`}
    >
      {/* Type icon */}
      <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
        {getTypeIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <Badge
            variant={TYPE_BADGE_VARIANT[notification.type] || 'default'}
            size="sm"
          >
            {TYPE_LABELS[notification.type] || notification.type}
          </Badge>
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>

        <h4
          className={`text-sm font-semibold ${
            isUnread
              ? 'text-slate-900 dark:text-slate-100 font-bold'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {notification.title}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {notification.message}
        </p>

        {/* Entity link and actions row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {entityLink && (
            <Link to={entityLink.url}>
              <Button size="sm" variant="outline" icon={ArrowUpRight}>
                {entityLink.text}
              </Button>
            </Link>
          )}

          {/* Action buttons — visible on hover/focus and always accessible */}
          <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
            {isUnread && (
              <button
                onClick={handleMarkRead}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                title="Mark as read"
                aria-label="Mark as read"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Delete"
              aria-label="Delete notification"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Unread indicator dot */}
      <div className="shrink-0 mt-1.5">
        <span
          className={`block w-2.5 h-2.5 rounded-full transition-colors ${
            isUnread ? 'bg-blue-700 dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-700'
          }`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
