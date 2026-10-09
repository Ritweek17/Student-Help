import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowRight,
  RefreshCw,
  Briefcase,
  Activity,
  Layers,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * Health visual configuration matching backend states.
 * States: 'Healthy' | 'Active Momentum' | 'Needs Attention' | 'Stalled' | 'Dormant'
 */
const HEALTH_CONFIG = {
  Healthy: {
    badgeVariant: 'success',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    icon: CheckCircle2,
  },
  'Active Momentum': {
    badgeVariant: 'primary',
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
    icon: TrendingUp,
  },
  'Needs Attention': {
    badgeVariant: 'warning',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
    icon: AlertTriangle,
  },
  Stalled: {
    badgeVariant: 'danger',
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60',
    icon: Clock,
  },
  Dormant: {
    badgeVariant: 'default',
    colorClass: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800',
    icon: Sparkles,
  },
};

/**
 * ApplicationHealthCard
 * 
 * Displays pipeline health state, operational metrics, stalled applications, and top follow-up action.
 * Renders backend data directly without computing scores or state in React.
 */
export function ApplicationHealthCard({
  overview,
  loading = false,
  error = null,
  onRetry,
  compact = false,
  onFollowUp,
}) {
  if (loading) {
    return (
      <Card padding="md" className="animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-20" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="md" className="border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">
                Application Intelligence Unavailable
              </h4>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                {error}
              </p>
            </div>
          </div>
          {onRetry && (
            <Button size="xs" variant="ghost" onClick={onRetry} icon={RefreshCw}>
              Retry
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (!overview) return null;

  const health = overview.health || {};
  const state = health.state || 'Dormant';
  const config = HEALTH_CONFIG[state] || HEALTH_CONFIG.Dormant;
  const StateIcon = config.icon;

  const stalledApps = Array.isArray(overview.stalledApplications) ? overview.stalledApplications : [];
  const actions = Array.isArray(overview.actions) ? overview.actions : [];
  const topAction = actions[0] || null;

  // Stalled or active count from backend
  const activeCount = health.activeCount ?? 0;
  const stalledCount = health.stalledCount ?? stalledApps.length;
  const recentCount = overview.recentActivity?.recentCount ?? 0;
  const velocity = overview.recentActivity?.velocity ?? 'none';

  return (
    <Card padding="md" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bgClass}`}>
            <StateIcon className={`w-4 h-4 ${config.colorClass}`} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Pipeline Health
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {state}
              </h3>
              <Badge variant={config.badgeVariant} size="sm">
                {state}
              </Badge>
            </div>
          </div>
        </div>

        {compact && (
          <Link to="/applications">
            <Button size="xs" variant="ghost" icon={ArrowRight}>
              Open Tracker
            </Button>
          </Link>
        )}
      </div>

      {/* Summary statement */}
      {health.summary && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {health.summary}
        </p>
      )}

      {/* Key Metric Counters */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <span className="text-lg font-bold font-heading text-slate-900 dark:text-slate-100 block">
            {activeCount}
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Active Roles
          </span>
        </div>

        <div className={`p-2.5 rounded-xl border ${
          stalledCount > 0
            ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100'
        }`}>
          <span className="text-lg font-bold font-heading block">
            {stalledCount}
          </span>
          <span className="text-[11px] font-medium">
            Stalled (&gt;14d)
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <span className="text-lg font-bold font-heading text-slate-900 dark:text-slate-100 block">
            {recentCount}
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Recent 30d ({velocity})
          </span>
        </div>
      </div>

      {/* Drivers List */}
      {!compact && Array.isArray(health.drivers) && health.drivers.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Pipeline Drivers
          </span>
          <ul className="space-y-1">
            {health.drivers.map((driver, idx) => (
              <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Follow-Up Action */}
      {topAction && (
        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge variant="warning" size="xs">
                {topAction.priority} Priority Follow-Up
              </Badge>
            </div>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {topAction.title}
            </p>
            {topAction.reason && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {topAction.reason}
              </p>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {onFollowUp ? (
              <Button size="xs" variant="primary" onClick={() => onFollowUp(topAction)}>
                Follow Up
              </Button>
            ) : (
              <Link to="/applications">
                <Button size="xs" variant="primary">
                  Follow Up
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
