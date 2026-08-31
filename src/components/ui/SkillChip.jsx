import React from 'react';
import { clsx } from 'clsx';

export function SkillChip({
  skill,
  selected = false,
  onClick,
  removable = false,
  onRemove,
  size = 'md'
}) {
  const name = typeof skill === 'object' ? skill.name : skill;
  const level = typeof skill === 'object' ? skill.level : null;

  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-xs sm:text-sm',
    lg: 'px-3.5 py-1.5 text-sm'
  };

  return (
    <span
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-lg border transition-all duration-150 select-none cursor-pointer',
        sizes[size],
        selected
          ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      )}
    >
      <span>{name}</span>
      {level && (
        <span
          className={clsx(
            'text-[10px] px-1.5 py-0.2 rounded font-normal',
            selected
              ? 'bg-blue-800 text-blue-100'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          )}
        >
          {level}
        </span>
      )}
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onRemove) onRemove();
          }}
          className="hover:text-red-600 transition-colors ml-0.5"
        >
          ×
        </button>
      )}
    </span>
  );
}
