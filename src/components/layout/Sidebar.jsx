import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  Bookmark,
  Briefcase,
  User,
  CheckSquare,
  Target,
  Bell,
  Settings,
  LayoutDashboard,
  LogOut,
  Sparkles,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Calendar,
  Trophy
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';

export function Sidebar({ onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navGroups = [
    {
      title: 'OVERVIEW',
      items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }]
    },
    {
      title: 'DISCOVER',
      items: [
        { label: 'Opportunities', path: '/opportunities', icon: Compass },
        { label: 'Saved', path: '/saved', icon: Bookmark }
      ]
    },
    {
      title: 'CAREER',
      items: [
        { label: 'Applications', path: '/applications', icon: Briefcase },
        { label: 'Goals', path: '/goals', icon: Target },
        { label: 'Professional Profile', path: '/profile', icon: User }
      ]
    },
    {
      title: 'LEARNING',
      items: [
        { label: 'My Learning', path: '/learning', icon: BookOpen }
      ]
    },
    {
      title: 'PRODUCTIVITY',
      items: [
        { label: 'Daily Tracker', path: '/tracker', icon: CheckSquare },
        { label: 'Todos', path: '/todos', icon: CheckCircle2 },
        { label: 'Notes', path: '/notes', icon: FileText },
        { label: 'Calendar', path: '/calendar', icon: Calendar }
      ]
    },
    {
      title: 'CODING',
      items: [
        { label: 'Contests', path: '/contests', icon: Trophy }
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { label: 'Notifications', path: '/notifications', icon: Bell, badge: '8' },
        { label: 'Settings', path: '/settings', icon: Settings }
      ]
    }
  ];

  const userDisplayName = user?.email ? user.email.split('@')[0] : 'Alex Chen';
  const userSubtext = user?.email || 'CS Undergrad';

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full select-none text-slate-700 dark:text-slate-300">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-heading">
              Career<span className="text-blue-700 dark:text-blue-400">OS</span>
            </span>
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
              PRIMARY WORKSPACE
            </span>
          </div>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 no-scrollbar">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
              {group.title}
            </span>
            {group.items.map((item, iIdx) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));

              return (
                <NavLink
                  key={iIdx}
                  to={item.path}
                  onClick={() => onCloseMobile && onCloseMobile()}
                  className={({ isActive: linkActive }) => {
                    const active = isActive || linkActive;
                    return `flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all group ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`;
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {item.badge}
                    </span>
                  ) : (
                    isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 opacity-75" />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Profile Card */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={userDisplayName} size="sm" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">{userDisplayName}</span>
              <span className="text-[10px] text-slate-500 block truncate">{userSubtext}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

