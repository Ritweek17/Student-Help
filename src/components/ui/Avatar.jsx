import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Avatar({
  src,
  name = 'User',
  size = 'md',
  className = '',
  status
}) {
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl'
  };

  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = str.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.substring(0, 2).toUpperCase();
  };

  return (
    <div className="relative inline-block shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={twMerge(
            clsx(
              'rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-800',
              sizes[size],
              className
            )
          )}
        />
      ) : (
        <div
          className={twMerge(
            clsx(
              'rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-semibold flex items-center justify-center ring-2 ring-slate-200 dark:ring-slate-800',
              sizes[size],
              className
            )
          )}
        >
          {getInitials(name)}
        </div>
      )}

      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-950',
            status === 'online' && 'bg-emerald-500',
            status === 'offline' && 'bg-slate-400',
            status === 'busy' && 'bg-rose-500'
          )}
        />
      )}
    </div>
  );
}
