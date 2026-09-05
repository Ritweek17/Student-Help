import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, Sun, Moon, Menu, Command, Calendar } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useCommand } from '../../context/CommandContext';
import { useNotifications } from '../../context/NotificationContext';

export function TopHeader({ onOpenMobile }) {
  const { theme, setTheme } = useTheme();
  const { openCommand } = useCommand();
  const { unreadCount } = useNotifications();
  const location = useLocation();

  const getPageTitle = (path) => {
    if (path.startsWith('/opportunities/')) return 'Opportunity Details';
    if (path.startsWith('/learning/')) return 'Learning Track Details';
    switch (path) {
      case '/dashboard':
        return 'Dashboard';
      case '/opportunities':
        return 'Opportunities';
      case '/saved':
        return 'Saved Opportunities';
      case '/applications':
        return 'Applications';
      case '/profile':
        return 'Professional Profile';
      case '/learning':
        return 'Learning Hub';
      case '/tracker':
        return 'Daily Productivity Tracker';
      case '/todos':
        return 'Todo List';
      case '/notes':
        return 'Personal Notes Workspace';
      case '/goals':
        return 'Career Goals';
      case '/calendar':
        return 'CareerOS Calendar';
      case '/contests':
        return 'Coding Contest Calendar';
      case '/notifications':
        return 'Notifications';
      case '/settings':
        return 'Settings';
      default:
        return 'CareerOS';
    }
  };

  const currentTitle = getPageTitle(location.pathname);
  const bellAriaLabel = unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications, no unread notifications';

  return (
    <header className="h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left side: Hamburger (mobile) + Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Open Mobile Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>CareerOS</span>
            <span>/</span>
            <span className="text-slate-600 dark:text-slate-300 capitalize">
              {location.pathname.split('/')[1] || 'Dashboard'}
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Right side: Search trigger, Calendar shortcut, Theme toggle, Notification bell */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search trigger (Cmd+K) */}
        <button
          onClick={openCommand}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 text-xs font-medium transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search or command...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-500 shadow-2xs">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Calendar Shortcut */}
        <Link
          to="/calendar"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="CareerOS Calendar"
        >
          <Calendar className="w-5 h-5" />
        </Link>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>

        {/* Notification bell with real unread badge */}
        <Link
          to="/notifications"
          className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={bellAriaLabel}
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-blue-700 dark:bg-blue-500 rounded-full ring-2 ring-white dark:ring-slate-900 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
