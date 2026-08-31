import React, { useState } from 'react';

export function Tooltip({ text, children, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);

  const positionStyles = {
    top: '-top-9 left-1/2 -translate-x-1/2',
    bottom: '-bottom-9 left-1/2 -translate-x-1/2',
    left: 'top-1/2 -left-2 -translate-x-full -translate-y-1/2',
    right: 'top-1/2 -right-2 translate-x-full -translate-y-1/2'
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-30 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-md shadow-md whitespace-nowrap pointer-events-none transition-opacity animate-fadeIn ${positionStyles[position]}`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
