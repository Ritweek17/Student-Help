import React from 'react';
import { Calendar, Trash2, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';

const PRIORITY_VARIANTS = {
  High: 'danger',
  Medium: 'warning',
  Low: 'default',
};

const CATEGORY_VARIANTS = {
  DSA: 'indigo',
  Development: 'purple',
  Learning: 'sky',
  Application: 'rose',
  Hackathon: 'amber',
  Backend: 'cyan',
  Project: 'emerald',
  College: 'default',
  General: 'default',
  Other: 'default',
};

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return String(dueDate);
  return d.toISOString().split('T')[0];
}

function checkIsOverdue(dueDate, isDone) {
  if (!dueDate || isDone) return false;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function checkIsDueToday(dueDate) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  const dueStr = due.toISOString().split('T')[0];
  return todayStr === dueStr;
}

export function TodoItemRow({ todo, onToggleComplete, onEdit, onDelete }) {
  const isDone = Boolean(todo.completed || todo.status === 'completed');
  const todoId = todo._id || todo.id;
  const formattedDate = formatDueDate(todo.dueDate);
  const isOverdue = checkIsOverdue(todo.dueDate, isDone);
  const isToday = checkIsDueToday(todo.dueDate);

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onToggleComplete) {
      onToggleComplete(todoId);
    }
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(todo);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(todoId);
    }
  };

  return (
    <div
      onClick={handleEditClick}
      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
        isDone
          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/40 opacity-75'
          : isOverdue
          ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/40 hover:border-rose-300 dark:hover:border-rose-800 shadow-xs'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isDone}
            onChange={handleCheckboxClick}
            aria-label={`Mark ${todo.title} as ${isDone ? 'incomplete' : 'complete'}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={PRIORITY_VARIANTS[todo.priority] || 'default'} size="sm">
              {todo.priority || 'Medium'} Priority
            </Badge>

            <Badge variant={CATEGORY_VARIANTS[todo.category] || 'default'} size="sm">
              {todo.category || 'General'}
            </Badge>

            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                <AlertCircle className="w-3 h-3" />
                Overdue
              </span>
            )}

            {!isOverdue && isToday && !isDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
                Due Today
              </span>
            )}

            {isDone && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Completed
              </span>
            )}
          </div>

          <h4
            className={`text-sm font-semibold transition-all ${
              isDone
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {todo.title}
          </h4>

          {todo.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
              {todo.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
            {formattedDate && (
              <span
                className={`flex items-center gap-1 ${
                  isOverdue ? 'text-rose-600 dark:text-rose-400 font-medium' : ''
                }`}
              >
                <Calendar className="w-3 h-3" />
                Due: {formattedDate}
              </span>
            )}
            {todo.completedAt && (
              <span className="text-slate-400">
                Finished: {new Date(todo.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Action icons */}
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center gap-1">
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Edit Todo"
              aria-label="Edit Todo"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Delete Todo"
              aria-label="Delete Todo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
