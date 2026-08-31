import React from 'react';
import { clsx } from 'clsx';

export function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((tab) => {
        const id = typeof tab === 'object' ? tab.id : tab;
        const label = typeof tab === 'object' ? tab.label : tab;
        const count = typeof tab === 'object' ? tab.count : undefined;
        const icon = typeof tab === 'object' ? tab.icon : undefined;
        const Icon = icon;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={clsx(
              'px-3.5 py-2 text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 border-b-2 -mb-px',
              isActive
                ? 'border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px]',
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
