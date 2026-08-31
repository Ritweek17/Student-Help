import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, Calendar, Award, CheckCircle2, AlertTriangle, Info, ArrowUpRight } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function NotificationItem({ notification, onToggleRead }) {
  const getIcon = (cat) => {
    switch (cat) {
      case 'DEADLINES':
        return <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />;
      case 'INTERNSHIPS':
      case 'APPLICATIONS':
        return <Award className="w-4 h-4 text-blue-700 dark:text-blue-400" />;
      case 'PRODUCTIVITY':
      case 'GOALS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />;
      case 'HACKATHONS':
      case 'WORKSHOPS & EVENTS':
        return <Calendar className="w-4 h-4 text-sky-700 dark:text-sky-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all flex items-start gap-4 ${
        !notification.isRead
          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/60'
          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
        {getIcon(notification.category)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <Badge variant={notification.badgeType || 'default'} size="sm">
            {notification.category}
          </Badge>
          <span className="text-[11px] text-slate-400 font-medium">{notification.timestamp}</span>
        </div>

        <h4
          className={`text-sm font-semibold ${
            !notification.isRead
              ? 'text-slate-900 dark:text-slate-100 font-bold'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {notification.title}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {notification.description}
        </p>

        {notification.actionUrl && (
          <div className="mt-3">
            <Link to={notification.actionUrl}>
              <Button size="sm" variant="outline" icon={ArrowUpRight}>
                {notification.actionText || 'View Details'}
              </Button>
            </Link>
          </div>
        )}
      </div>

      <button
        onClick={() => onToggleRead(notification.id)}
        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs shrink-0"
        title={notification.isRead ? 'Mark as Unread' : 'Mark as Read'}
      >
        <span
          className={`block w-2.5 h-2.5 rounded-full ${
            !notification.isRead ? 'bg-blue-700 dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        />
      </button>
    </div>
  );
}
