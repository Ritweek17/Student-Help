import React from 'react';
import { Clock } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';

export function TargetItem({ task, onToggleComplete }) {
  const categoryColors = {
    DSA: 'indigo',
    Learning: 'sky',
    Project: 'emerald',
    Coding: 'amber',
    Application: 'rose',
    GitHub: 'default'
  };

  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
        isCompleted
          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/40 opacity-75'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Checkbox checked={isCompleted} onChange={() => onToggleComplete(task.id)} />
        <div className="min-w-0">
          <p
            className={`text-xs sm:text-sm font-medium transition-all truncate ${
              isCompleted
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={categoryColors[task.category] || 'default'} size="sm">
              {task.category}
            </Badge>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.plannedDuration}
            </span>
          </div>
        </div>
      </div>

      {task.priority && (
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
            task.priority === 'High'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {task.priority}
        </span>
      )}
    </div>
  );
}
