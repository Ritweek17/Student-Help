import React from 'react';
import { Clock, Trash2, Edit2 } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';

const CATEGORY_BADGE_VARIANTS = {
  DSA: 'indigo',
  Development: 'purple',
  Project: 'emerald',
  'Open Source': 'cyan',
  Learning: 'sky',
  College: 'default',
  Coding: 'amber',
  Application: 'rose',
  Other: 'default',
};

export function TargetItem({ task, onToggleComplete, onEdit, onDelete }) {
  const isCompleted = Boolean(task.completed || task.status === 'completed');
  const taskId = task._id || task.id;

  const durationDisplay =
    task.durationMinutes !== undefined && task.durationMinutes !== null
      ? `${task.durationMinutes} min`
      : task.plannedDuration || '0 min';

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onToggleComplete) {
      onToggleComplete(taskId);
    }
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(task);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(taskId);
    }
  };

  return (
    <div
      onClick={handleEditClick}
      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
        isCompleted
          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/40 opacity-85'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Checkbox
          checked={isCompleted}
          onChange={handleCheckboxClick}
          aria-label={`Mark ${task.title} as ${isCompleted ? 'incomplete' : 'complete'}`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs sm:text-sm font-medium transition-all truncate ${
              isCompleted
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={CATEGORY_BADGE_VARIANTS[task.category] || 'default'} size="sm">
              {task.category}
            </Badge>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {durationDisplay}
            </span>
            {task.notes && (
              <span className="text-[11px] text-slate-400 italic truncate max-w-[200px]">
                • {task.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {task.priority && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
              task.priority === 'High'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                : task.priority === 'Low'
                ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            {task.priority}
          </span>
        )}

        {/* Action icons on hover */}
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center gap-1">
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Edit target"
              aria-label="Edit target"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-1 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Delete target"
              aria-label="Delete target"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
