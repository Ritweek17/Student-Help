import React from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Checkbox({
  label,
  checked = false,
  onChange,
  className = '',
  id,
  disabled = false,
  description
}) {
  const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={checkboxId}
      className={twMerge(
        clsx(
          'inline-flex items-start gap-3 cursor-pointer select-none group',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )
      )}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={clsx(
            'w-5 h-5 rounded-md border transition-all duration-150 flex items-center justify-center',
            checked
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 group-hover:border-indigo-400'
          )}
        >
          {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col text-sm">
          {label && <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>}
          {description && <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>}
        </div>
      )}
    </label>
  );
}
