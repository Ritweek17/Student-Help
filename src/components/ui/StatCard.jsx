import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType = 'up',
  color = 'indigo'
}) {
  const iconColors = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
    sky: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
  };

  return (
    <Card padding="md" className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-heading">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${iconColors[color]} shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-2">
          <Badge variant={trendType === 'up' ? 'success' : 'danger'} size="sm">
            {trend}
          </Badge>
          <span className="text-[11px] text-slate-400">vs last week</span>
        </div>
      )}
    </Card>
  );
}
