import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Compass,
  Briefcase,
  User,
  CheckSquare,
  Clock,
  Target,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Bell,
  Github,
  Linkedin,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Calendar
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useTheme } from '../../context/ThemeContext';

export function LandingPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Marketing Header */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 px-6 sm:px-12 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-50">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            Career<span className="text-blue-700 dark:text-blue-400">OS</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors">Features</a>
          <a href="#opportunities" className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors">Opportunities</a>
          <a href="#productivity" className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors">Productivity</a>
          <a href="#profile" className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors">Profile</a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-300">
              Log In
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" icon={ArrowRight}>
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* SECTION 1: HERO */}
      <section className="pt-16 pb-20 px-6 sm:px-12 max-w-7xl mx-auto text-center">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <span>Student Career + Learning + Productivity Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading leading-tight">
            Your Career. Your Progress. <span className="text-blue-700 dark:text-blue-400">One Place.</span>
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Discover opportunities, organize your professional profile, track learning and applications, plan your career, and manage your daily progress from one unified workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto px-8" icon={ArrowRight}>
                Get Started
              </Button>
            </Link>
            <Link to="/opportunities" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8" icon={Compass}>
                Explore Opportunities
              </Button>
            </Link>
          </div>
        </div>

        {/* Product Preview in Flagship Light Theme */}
        <div className="mt-14 max-w-5xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden text-left">
          <div className="h-10 bg-slate-100 dark:bg-slate-950 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>
            <div className="px-3 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs font-mono border border-slate-200 dark:border-slate-800">
              app.careeros.dev/dashboard
            </div>
            <Badge variant="primary" size="sm">Student Workspace Preview</Badge>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-950">
            {/* Widget 1: Today's targets */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Today's Progress</span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">4 / 5 Completed</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-700 dark:bg-blue-500 w-[80%]" />
              </div>
              <div className="space-y-2 pt-1 text-xs">
                {['Solve 3 DSA Graph Problems', 'React 19 Hooks Practice', 'Express Middleware Deep Dive', 'Apply to Vortex Labs Role'].map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 2: Opportunity recommendation */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 md:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Badge variant="primary" size="sm">Featured Role</Badge>
                <Badge variant="success" size="sm">94% Match</Badge>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Frontend Developer Intern</h4>
                <p className="text-xs text-slate-500">Vortex Labs • Remote • ₹35,000 / mo</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 dark:text-slate-300">
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">React</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">TypeScript</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Tailwind CSS</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-amber-700 dark:text-amber-400 font-semibold">Closing in 2 days</span>
                <Link to="/opportunities/opp-1" className="text-blue-700 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1">
                  View Role Details <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY CAREEROS */}
      <section className="py-16 px-6 sm:px-12 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Why CareerOS</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
              A Structured Workspace for Career & Learning Growth
            </h2>
            <p className="text-slate-500 text-sm">
              Navigating internships, course playlists, application deadlines, and daily tasks shouldn't require 20 separate browser tabs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'All Opportunities in One Place',
                desc: 'Hackathons, internships, workshops, and open-source programs matched to your tech stack.',
                icon: Compass
              },
              {
                title: 'Structured Application Tracking',
                desc: 'Kanban pipeline tracker from Applied to Interview and Selection. Never miss a follow-up step.',
                icon: Briefcase
              },
              {
                title: 'Integrated Learning & Productivity',
                desc: 'Log course progress, daily DSA practice, personal notes, and internal calendar events.',
                icon: CheckSquare
              }
            ].map((problem, idx) => {
              const Icon = problem.icon;
              return (
                <div key={idx} className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">{problem.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{problem.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: CORE CAPABILITIES */}
      <section id="features" className="py-20 px-6 sm:px-12 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Product Scope</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
            Built for Serious Career & Skill Development
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: '1. Discover Opportunities',
              desc: 'Internships, hackathons, workshops, conferences, and open-source programs.',
              icon: Compass
            },
            {
              title: '2. Track Applications',
              desc: 'Pipeline stages from Applied to Interview, Waiting, Selected, and Rejected.',
              icon: Briefcase
            },
            {
              title: '3. Professional Profile',
              desc: 'Academic records, verified skills matrix, projects, achievements, and resume uploads.',
              icon: User
            },
            {
              title: '4. My Learning Tracks',
              desc: 'Course playlists, Chai aur Code / Documentation resources, and lesson completion states.',
              icon: BookOpen
            },
            {
              title: '5. Daily Tracker & Todos',
              desc: 'Log daily focus hours, DSA problem targets, and interactive todo action items.',
              icon: CheckSquare
            },
            {
              title: '6. CareerOS Primary Calendar',
              desc: 'Internal productivity calendar for interview rounds, deadlines, and contest reminders.',
              icon: Calendar
            }
          ].map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <Card key={idx} padding="lg">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 font-heading">{cap.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{cap.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 px-6 sm:px-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center">
        <div className="max-w-3xl mx-auto space-y-5">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading leading-tight">
            Stop searching everywhere.<br />Start building in one place.
          </h2>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Join thousands of student developers organizing their career opportunities, course playlists, and daily goals.
          </p>
          <div className="pt-2">
            <Link to="/signup">
              <Button size="lg" className="px-8" icon={ArrowRight}>
                Create your CareerOS
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6 sm:px-12 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span className="font-bold text-slate-900 dark:text-white font-heading">CareerOS</span>
            <span className="text-slate-400">© 2026 CareerOS Inc. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <Link to="/opportunities" className="hover:text-slate-900 dark:hover:text-white">Opportunities</Link>
            <Link to="/learning" className="hover:text-slate-900 dark:hover:text-white">Learning Hub</Link>
            <Link to="/applications" className="hover:text-slate-900 dark:hover:text-white">Applications</Link>
            <Link to="/calendar" className="hover:text-slate-900 dark:hover:text-white">Calendar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
