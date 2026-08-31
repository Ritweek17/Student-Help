import React from 'react';
import { clsx } from 'clsx';

export function Progress({
  value = 0,
  max = 100,
  size = 'md',
  color = 'blue',
  showLabel = false,
  className = ''
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3.5'
  };

  const colors = {
    blue: 'bg-blue-700 dark:bg-blue-500',
    emerald: 'bg-emerald-700 dark:bg-emerald-500',
    amber: 'bg-amber-700 dark:bg-amber-500',
    red: 'bg-red-700 dark:bg-red-500',
    sky: 'bg-sky-700 dark:bg-sky-500'
  };

  return (
    <div className={`w-full flex flex-col gap-1 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
          <span>Progress</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${colors[color] || colors.blue}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
