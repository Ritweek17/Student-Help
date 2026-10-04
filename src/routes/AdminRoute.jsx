import React from 'react';
import { Navigate, useLocation, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

export function AdminRoute({ children }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold font-heading">
            Career<span className="text-blue-400">OS</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>Verifying administrator privileges...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 mb-3">
            <span>HTTP 403 — ACCESS FORBIDDEN</span>
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-heading">
            Administrator Access Required
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            The requested area is restricted to system administrators. Your active session is registered under{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{user?.email || 'this account'}</span> with role{' '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">"{user?.role || 'student'}"</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/dashboard"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Student Portal</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children ? children : <Outlet />;
}
