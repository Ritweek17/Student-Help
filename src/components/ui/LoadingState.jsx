import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingState({ text = 'Loading content...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 gap-3 ${className}`}>
      <Loader2 className="w-7 h-7 animate-spin text-indigo-600 dark:text-indigo-400" />
      <span className="text-xs font-medium">{text}</span>
    </div>
  );
}
