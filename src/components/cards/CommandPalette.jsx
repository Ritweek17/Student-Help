import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Compass,
  Bookmark,
  Briefcase,
  User,
  CheckSquare,
  Target,
  Bell,
  Settings,
  X,
  Command,
  BookOpen,
  CheckCircle2,
  FileText,
  Calendar,
  Trophy
} from 'lucide-react';
import { useCommand } from '../../context/CommandContext';

export function CommandPalette() {
  const { isOpen, closeCommand } = useCommand();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  const commands = [
    { label: 'Go to Dashboard', path: '/dashboard', category: 'Navigation', icon: Compass },
    { label: 'Discover Opportunities', path: '/opportunities', category: 'Navigation', icon: Compass },
    { label: 'View Saved Roles', path: '/saved', category: 'Navigation', icon: Bookmark },
    { label: 'Application Tracker', path: '/applications', category: 'Navigation', icon: Briefcase },
    { label: 'Professional Profile', path: '/profile', category: 'Navigation', icon: User },
    { label: 'My Learning Hub', path: '/learning', category: 'Learning', icon: BookOpen },
    { label: 'Daily Tracker & Streaks', path: '/tracker', category: 'Productivity', icon: CheckSquare },
    { label: 'Todo List Manager', path: '/todos', category: 'Productivity', icon: CheckCircle2 },
    { label: 'Personal Notes Workspace', path: '/notes', category: 'Productivity', icon: FileText },
    { label: 'CareerOS Primary Calendar', path: '/calendar', category: 'Productivity', icon: Calendar },
    { label: 'Coding Contest Calendar', path: '/contests', category: 'Coding', icon: Trophy },
    { label: 'Career Goals & Roadmaps', path: '/goals', category: 'Career', icon: Target },
    { label: 'Notifications Center', path: '/notifications', category: 'System', icon: Bell },
    { label: 'Account & Sync Settings', path: '/settings', category: 'System', icon: Settings }
  ];

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleSelect = (path) => {
    navigate(path);
    closeCommand();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={closeCommand} />

      {/* Palette Container */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden z-10 animate-fadeIn">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search product area..."
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none"
            autoFocus
          />
          <button onClick={closeCommand} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length > 0 ? (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(cmd.path)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-400 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-400" />
                    <span className="font-medium">{cmd.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{cmd.category}</span>
                </button>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-500">No matching commands found</div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Command className="w-3 h-3 text-blue-700 dark:text-blue-400" />
            <span>CareerOS Command Palette</span>
          </div>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
