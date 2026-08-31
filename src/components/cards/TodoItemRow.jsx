import React from 'react';
import { Calendar, Trash2, Tag } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';

export function TodoItemRow({ todo, onToggleComplete, onDelete }) {
  const isDone = todo.status === 'completed';

  const priorityVariants = {
    High: 'danger',
    Medium: 'warning',
    Low: 'default'
  };

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
        isDone
          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/40 opacity-75'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Checkbox checked={isDone} onChange={() => onToggleComplete(todo.id)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant={priorityVariants[todo.priority] || 'default'} size="sm">
              {todo.priority} Priority
            </Badge>
            <Badge variant="primary" size="sm">
              {todo.category}
            </Badge>
          </div>

          <h4
            className={`text-sm font-semibold transition-all ${
              isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {todo.title}
          </h4>

          {todo.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {todo.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
            {todo.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Due: {todo.dueDate}
              </span>
            )}
            {todo.relatedOpportunityId && (
              <span className="text-indigo-500 font-medium">Linked to Opportunity</span>
            )}
            {todo.relatedGoalId && (
              <span className="text-emerald-500 font-medium">Linked to Career Goal</span>
            )}
          </div>
        </div>
      </div>

      {onDelete && (
        <button
          onClick={() => onDelete(todo.id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          title="Delete Todo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
