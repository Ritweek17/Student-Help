import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({
  children,
  className = '',
  hoverEffect = false,
  padding = 'md',
  onClick,
  ...props
}) {
  const paddings = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-5',
    lg: 'p-6'
  };

  return (
    <div
      onClick={onClick}
      className={twMerge(
        clsx(
          'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs transition-all duration-150',
          hoverEffect &&
            'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs cursor-pointer',
          paddings[padding],
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={twMerge('flex flex-col gap-1 mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={twMerge('text-base font-semibold text-slate-900 dark:text-slate-100 font-heading', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={twMerge('text-xs text-slate-500 dark:text-slate-400', className)}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={twMerge('mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}
