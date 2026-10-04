import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  LayoutDashboard,
  Compass,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  CheckCircle2,
  Database,
  Activity,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../context/AuthContext';

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    {
      label: 'Overview',
      path: '/admin',
      exact: true,
      icon: LayoutDashboard,
      description: 'Platform metrics & recent activity',
    },
    {
      label: 'Opportunities',
      path: '/admin/opportunities',
      exact: false,
      icon: Compass,
      description: 'Curation, creation & archives',
    },
    {
      label: 'Sources',
      path: '/admin/sources',
      exact: false,
      icon: Database,
      description: 'Opportunity ingestion sources',
    },
    {
      label: 'Ingestion Runs',
      path: '/admin/ingestion-runs',
      exact: false,
      icon: Activity,
      description: 'Pipeline execution history',
    },
  ];

  const adminEmail = user?.email || 'admin@careeros.com';
  const adminName = adminEmail.split('@')[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row transition-colors">
      {/* Desktop Sidebar (Left) */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 z-40 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none">
        {/* Brand & Console Badge */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <Link to="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-heading">
                  Career<span className="text-indigo-600 dark:text-indigo-400">OS</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  Admin
                </span>
              </div>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                V1 MANAGEMENT CONSOLE
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div>
            <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
              ADMINISTRATION
            </span>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900/60 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'group-hover:scale-105'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.label}</div>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Quick Context Switch: Return to Student Portal */}
          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Student Workspace</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5 leading-relaxed">
              Switch from Admin Console to preview opportunities as an active student.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 transition-colors"
            >
              <span>Launch Student View</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
            </Link>
          </div>

          {/* System Status Pill */}
          <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
              API Server Connected
            </span>
          </div>
        </div>

        {/* User Identity Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={adminName} size="sm" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                  {adminName}
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block truncate">
                  ADMINISTRATOR
                </span>
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

      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Career<span className="text-indigo-600 dark:text-indigo-400">OS</span> Admin
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
          >
            Student View
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl p-6 border-t border-slate-200 dark:border-slate-800 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white font-heading uppercase tracking-wide">
                Admin Menu
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">{adminEmail}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fadeIn">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
