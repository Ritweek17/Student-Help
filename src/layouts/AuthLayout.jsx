import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function AuthLayout() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Left visual branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden border-r border-slate-800">
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center text-white shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight font-heading">
              Career<span className="text-blue-400">OS</span>
            </span>
          </Link>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-950/80 border border-blue-800/80 text-blue-300 text-xs font-semibold">
            <span>Student Career + Learning + Productivity Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-heading leading-tight">
            "Your Career. Your Progress. One Place."
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed">
            Discover internships, hackathons, and workshops while keeping track of your daily targets, applications, learning tracks, and professional milestones.
          </p>

          <div className="space-y-3 pt-2">
            {[
              'Centralized Opportunity Feed & Match Scoring',
              'Structured Application Pipeline Tracker',
              'Course Playlists & Learning Progress',
              'Daily Task Tracker & Native CareerOS Calendar'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800 pt-4">
          <span>© 2026 CareerOS Inc. Professional Student Workspace</span>
          <Link to="/" className="text-blue-400 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Landing
          </Link>
        </div>
      </div>

      {/* Right form outlet panel */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white font-heading">CareerOS</span>
          </Link>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="ml-auto text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <div className="max-w-md w-full mx-auto my-auto animate-fadeIn">
          <Outlet />
        </div>

        <div className="text-center text-xs text-slate-400 mt-8">
          <span>CareerOS Workspace — Phase 1 Frontend Foundation</span>
        </div>
      </div>
    </div>
  );
}
