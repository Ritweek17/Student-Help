import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Switch({
  checked = false,
  onChange,
  label,
  description,
  id,
  disabled = false,
  className = ''
}) {
  const switchId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={switchId}
      className={twMerge(
        clsx(
          'flex items-center justify-between gap-4 cursor-pointer select-none group',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )
      )}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>}
          {description && <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>}
        </div>
      )}
      <div className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          id={switchId}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={clsx(
            'w-11 h-6 rounded-full transition-colors duration-200 p-0.5 ease-in-out',
            checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
          )}
        >
          <div
            className={clsx(
              'w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </div>
      </div>
    </label>
  );
}
