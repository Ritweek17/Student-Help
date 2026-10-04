import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Briefcase,
  Calendar as CalendarIcon,
  Bookmark,
  Bell,
  ArrowRight,
  User,
  Compass,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../context/AuthContext';
import { useApplications } from '../../context/ApplicationContext';
import { useSavedOpportunities } from '../../context/SavedOpportunityContext';
import { useNotifications } from '../../context/NotificationContext';
import { useCalendar } from '../../context/CalendarContext';
import * as profileApi from '../../services/profileApi';
import * as savedOpportunityApi from '../../services/savedOpportunityApi';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, formatEventTime, getEventDateStr } from '../../components/calendar/CalendarView';

const STATUS_BADGE_VARIANTS = {
  applied: 'primary',
  reviewing: 'info',
  interviewing: 'warning',
  accepted: 'success',
  rejected: 'danger',
  registered: 'purple',
  waitlisted: 'warning',
  attended: 'success',
};

function calculateProfileCompletion(profile) {
  if (!profile) return 0;
  let score = 0;

  // 1. Personal Details (20%)
  if (profile.personal?.firstName && profile.personal?.lastName) {
    score += 20;
  } else if (profile.personal?.firstName || profile.personal?.displayName) {
    score += 10;
  }

  // 2. Education (20%)
  if (Array.isArray(profile.education) && profile.education.length > 0) {
    score += 20;
  }

  // 3. Skills (20%)
  if (Array.isArray(profile.skills) && profile.skills.length > 0) {
    score += 20;
  }

  // 4. Projects or Experience (20%)
  if (
    (Array.isArray(profile.projects) && profile.projects.length > 0) ||
    (Array.isArray(profile.experience) && profile.experience.length > 0)
  ) {
    score += 20;
  }

  // 5. Professional Links or Documents (20%)
  const hasLinks =
    profile.professionalLinks &&
    Object.values(profile.professionalLinks).some((val) => typeof val === 'string' && val.trim().length > 0);
  const hasDocs = Array.isArray(profile.documents) && profile.documents.length > 0;
  if (hasLinks || hasDocs) {
    score += 20;
  }

  return Math.min(100, score);
}

function formatDeadlineCountdown(deadlineStr) {
  if (!deadlineStr) return null;
  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) return null;

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Passed', urgent: false };
  if (diffDays === 0) return { label: 'Closes Today', urgent: true };
  if (diffDays === 1) return { label: 'Closes Tomorrow', urgent: true };
  if (diffDays <= 3) return { label: `${diffDays} days left`, urgent: true };
  if (diffDays <= 7) return { label: `${diffDays} days left`, urgent: false };

  return {
    label: deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    urgent: false,
  };
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DashboardPage() {
  const { user, token } = useAuth();

  // Connected contexts
  const {
    applicationsMap,
    initialLoading: appsLoading,
    error: appsError,
    refreshApplications,
  } = useApplications();

  const {
    savedIds,
    initialLoading: savedIdsLoading,
    error: savedIdsError,
    refreshSaved,
  } = useSavedOpportunities();

  const {
    events,
    loading: calendarLoading,
    error: calendarError,
    refreshEvents: refreshCalendar,
  } = useCalendar();

  const {
    notifications,
    unreadCount,
    loading: notifsLoading,
    error: notifsError,
    refreshNotifications,
  } = useNotifications();

  // Local state for profile and recent saved items
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const [recentSaved, setRecentSaved] = useState([]);
  const [recentSavedLoading, setRecentSavedLoading] = useState(true);
  const [recentSavedError, setRecentSavedError] = useState(null);

  const abortControllerRef = useRef(null);

  // ─── Fetch Profile ────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    try {
      const res = await profileApi.getProfile(token);
      setProfile(res.profile || null);
    } catch (err) {
      setProfileError(err.message || 'Unable to load profile summary.');
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  // ─── Fetch Recent Saved Opportunities ─────────────────────────────
  const loadRecentSaved = useCallback(async (signal) => {
    if (!token) {
      setRecentSaved([]);
      setRecentSavedLoading(false);
      return;
    }

    setRecentSavedLoading(true);
    setRecentSavedError(null);

    try {
      const res = await savedOpportunityApi.getSavedOpportunities({ page: 1, limit: 3 }, token, signal);
      setRecentSaved(res.savedOpportunities || []);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setRecentSavedError(err.message || 'Unable to load saved opportunities.');
    } finally {
      setRecentSavedLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    loadProfile();
    loadRecentSaved(controller.signal);

    return () => controller.abort();
  }, [loadProfile, loadRecentSaved]);

  // ─── Global Refresh ───────────────────────────────────────────────
  const handleRefreshAll = useCallback(() => {
    loadProfile();
    loadRecentSaved();
    if (refreshApplications) refreshApplications();
    if (refreshSaved) refreshSaved();
    if (refreshCalendar) refreshCalendar();
    if (refreshNotifications) refreshNotifications();
  }, [loadProfile, loadRecentSaved, refreshApplications, refreshSaved, refreshCalendar, refreshNotifications]);

  // ─── Derived Business Metrics ─────────────────────────────────────
  const applications = Array.from(applicationsMap?.values() || []);
  const totalApplicationsCount = applications.length;

  const activeApplications = applications.filter(
    (app) => !['rejected', 'accepted', 'attended'].includes(app.status)
  );
  const activeApplicationsCount = activeApplications.length;

  // Status breakdown
  const statusCounts = applications.reduce((acc, app) => {
    const s = app.status || 'applied';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  // Recent 3 applications
  const recentApplications = [...applications]
    .sort(
      (a, b) =>
        new Date(b.appliedAt || b.createdAt || 0).getTime() -
        new Date(a.appliedAt || a.createdAt || 0).getTime()
    )
    .slice(0, 3);

  // Profile completion
  const profileCompletion = calculateProfileCompletion(profile);

  // Total saved count
  const totalSavedCount = savedIds?.size || 0;

  // Upcoming calendar events (sorted ascending by startAt, >= today)
  const now = new Date();
  const upcomingCalendarEvents = (events || [])
    .filter((evt) => {
      if (evt.status === 'cancelled') return false;
      const d = new Date(evt.startAt || evt.endAt);
      return !isNaN(d.getTime()) && d >= now;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  const upcomingEventsCount = (events || []).filter((evt) => {
    if (evt.status === 'cancelled') return false;
    const d = new Date(evt.startAt || evt.endAt);
    return !isNaN(d.getTime()) && d >= now;
  }).length;

  // Greeting name
  const greetingName =
    profile?.personal?.firstName ||
    profile?.personal?.displayName ||
    user?.firstName ||
    (user?.email ? user.email.split('@')[0] : 'Student');

  // Initial full page loading indicator (when everything is freshly loading)
  const isInitialWorkspaceLoading =
    appsLoading && savedIdsLoading && calendarLoading && profileLoading && applications.length === 0;

  if (isInitialWorkspaceLoading) {
    return <LoadingState text="Loading CareerOS Student Workspace..." />;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ─── Welcome Banner ────────────────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950/70 border border-indigo-500/20 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden shadow-sm">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Student Career Workspace
            </span>
            {profileCompletion === 100 ? (
              <Badge variant="success" size="sm">Profile Complete 🎯</Badge>
            ) : (
              <Badge variant="primary" size="sm">{profileCompletion}% Profile Score</Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading">
            Welcome back, {greetingName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            You have{' '}
            <span className="font-semibold text-white">
              {activeApplicationsCount} active application{activeApplicationsCount === 1 ? '' : 's'}
            </span>
            ,{' '}
            <span className="font-semibold text-white">
              {totalSavedCount} saved opportunit{totalSavedCount === 1 ? 'y' : 'ies'}
            </span>
            , and{' '}
            <span className="font-semibold text-white">
              {upcomingEventsCount} scheduled calendar event{upcomingEventsCount === 1 ? '' : 's'}
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-white/10"
            icon={RefreshCw}
            onClick={handleRefreshAll}
          >
            Refresh
          </Button>
          <Link to="/opportunities">
            <Button variant="primary" size="sm" icon={Sparkles}>
              Explore Roles
            </Button>
          </Link>
          <Link to="/calendar">
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-400/40 text-slate-200 hover:bg-indigo-950/40"
              icon={CalendarIcon}
            >
              Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Primary Real Metrics Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Profile Status */}
        <Link to="/profile" className="block group">
          <Card
            padding="md"
            className="flex items-center justify-between transition-all group-hover:border-indigo-400 dark:group-hover:border-indigo-500/50"
          >
            <div className="min-w-0 pr-2">
              <span className="text-xs font-semibold text-slate-400 uppercase truncate block">
                Profile Readiness
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {profileLoading ? '...' : `${profileCompletion}%`}
              </div>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                {profileCompletion === 100 ? 'All sections filled' : 'Update resume & skills'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
          </Card>
        </Link>

        {/* Metric 2: Active Applications */}
        <Link to="/applications" className="block group">
          <Card
            padding="md"
            className="flex items-center justify-between transition-all group-hover:border-purple-400 dark:group-hover:border-purple-500/50"
          >
            <div className="min-w-0 pr-2">
              <span className="text-xs font-semibold text-slate-400 uppercase truncate block">
                Active Applications
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {appsLoading ? '...' : activeApplicationsCount}
              </div>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {totalApplicationsCount} Total Tracked
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
          </Card>
        </Link>

        {/* Metric 3: Saved Opportunities */}
        <Link to="/saved" className="block group">
          <Card
            padding="md"
            className="flex items-center justify-between transition-all group-hover:border-emerald-400 dark:group-hover:border-emerald-500/50"
          >
            <div className="min-w-0 pr-2">
              <span className="text-xs font-semibold text-slate-400 uppercase truncate block">
                Saved Bookmarks
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {savedIdsLoading ? '...' : totalSavedCount}
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Saved Roles & Events
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
          </Card>
        </Link>

        {/* Metric 4: Calendar Events */}
        <Link to="/calendar" className="block group">
          <Card
            padding="md"
            className="flex items-center justify-between transition-all group-hover:border-amber-400 dark:group-hover:border-amber-500/50"
          >
            <div className="min-w-0 pr-2">
              <span className="text-xs font-semibold text-slate-400 uppercase truncate block">
                Upcoming Events
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {calendarLoading ? '...' : upcomingEventsCount}
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Deadlines & Interviews
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
          </Card>
        </Link>
      </div>

      {/* ─── Main Two-Column Layout ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ─── Left Column (2/3 Width) ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION B: APPLICATIONS SUMMARY */}
          <Card padding="lg">
            <SectionHeader
              title="Application Tracker Summary"
              subtitle="Live status of opportunities and events you're tracking"
              action={
                <Link to="/applications">
                  <Button size="sm" variant="ghost" icon={ArrowRight}>
                    View All ({totalApplicationsCount})
                  </Button>
                </Link>
              }
            />

            {appsError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex items-center justify-between">
                <span className="text-xs text-red-600 dark:text-red-400">{appsError}</span>
                <Button size="sm" variant="ghost" onClick={() => refreshApplications && refreshApplications()}>
                  Retry
                </Button>
              </div>
            ) : appsLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading applications...</div>
            ) : totalApplicationsCount === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <Briefcase className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No applications tracked yet
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Start applying to opportunities or register for events to track your progress here.
                  </p>
                </div>
                <Link to="/opportunities">
                  <Button size="sm" variant="outline" icon={Compass}>
                    Browse Opportunities
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status Pills Breakdown */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div
                      key={status}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0"
                    >
                      <Badge variant={STATUS_BADGE_VARIANTS[status] || 'default'} size="sm">
                        {status}
                      </Badge>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Recent Application Items */}
                <div className="space-y-2.5 pt-1">
                  {recentApplications.map((app) => {
                    const opp = app.opportunity || {};
                    return (
                      <div
                        key={app._id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-400/50 transition-all"
                      >
                        <div className="min-w-0 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                            {(opp.organization || 'CO').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {opp.title || 'Tracked Role'}
                            </h4>
                            <span className="text-xs text-slate-400 block truncate">
                              {opp.organization || 'Organization'} •{' '}
                              {app.appliedAt
                                ? `Applied ${new Date(app.appliedAt).toLocaleDateString()}`
                                : `Added ${new Date(app.createdAt).toLocaleDateString()}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Badge variant={STATUS_BADGE_VARIANTS[app.status] || 'default'} size="sm">
                            {app.status}
                          </Badge>
                          {opp._id && (
                            <Link
                              to={`/opportunities/${opp._id}`}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              title="View opportunity"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* SECTION C & D: SAVED OPPORTUNITIES & DEADLINES */}
          <Card padding="lg">
            <SectionHeader
              title="Saved Opportunities Closing Soon"
              subtitle="Priority roles bookmarked in your career backlog"
              action={
                <Link to="/saved">
                  <Button size="sm" variant="ghost" icon={ArrowRight}>
                    All Saved ({totalSavedCount})
                  </Button>
                </Link>
              }
            />

            {recentSavedError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex items-center justify-between">
                <span className="text-xs text-red-600 dark:text-red-400">{recentSavedError}</span>
                <Button size="sm" variant="ghost" onClick={() => loadRecentSaved()}>
                  Retry
                </Button>
              </div>
            ) : recentSavedLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading saved roles...</div>
            ) : recentSaved.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <Bookmark className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No saved opportunities
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click the bookmark icon on any opportunity to save it here for deadline tracking.
                  </p>
                </div>
                <Link to="/opportunities">
                  <Button size="sm" variant="outline" icon={Sparkles}>
                    Discover Roles
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSaved.map((item) => {
                  const opp = item.opportunity || {};
                  const deadlineInfo = formatDeadlineCountdown(opp.deadline);

                  return (
                    <div
                      key={item._id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-400/50 transition-all"
                    >
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                          {(opp.organization || 'CO').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {opp.title || 'Saved Opportunity'}
                          </h4>
                          <span className="text-xs text-slate-400 block truncate">
                            {opp.organization || 'Organization'} • {opp.type || 'Internship'}
                            {opp.location ? ` • ${opp.location}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        {deadlineInfo && (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              deadlineInfo.urgent
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {deadlineInfo.label}
                          </span>
                        )}
                        {opp._id && (
                          <Link to={`/opportunities/${opp._id}`}>
                            <Button size="sm" variant="outline">
                              View
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ─── Right Column (1/3 Width) ────────────────────────────── */}
        <div className="space-y-6">
          {/* SECTION A: PROFILE READINESS SUMMARY */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Profile Readiness
                </h3>
              </div>
              <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                {profileCompletion}%
              </span>
            </div>

            <Progress value={profileCompletion} color="indigo" size="sm" />

            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span>Education Record</span>
                <span className="font-semibold">
                  {profile?.education?.length > 0 ? '✓ Completed' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span>Skills Listed</span>
                <span className="font-semibold">
                  {profile?.skills?.length > 0 ? `${profile.skills.length} skills` : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Projects / Experience</span>
                <span className="font-semibold">
                  {(profile?.projects?.length || 0) + (profile?.experience?.length || 0) > 0
                    ? '✓ Active'
                    : 'None'}
                </span>
              </div>
            </div>

            <Link to="/profile" className="block pt-1">
              <Button size="sm" variant="outline" className="w-full" icon={ArrowRight}>
                Manage Profile
              </Button>
            </Link>
          </Card>

          {/* SECTION E: CALENDAR PREVIEW */}
          <Card padding="lg" className="space-y-4">
            <SectionHeader
              title="Upcoming Calendar"
              subtitle="Deadlines & scheduled events"
              action={
                <Link to="/calendar" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  Full Calendar
                </Link>
              }
            />

            {calendarError ? (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400">
                {calendarError}
              </div>
            ) : calendarLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading calendar events...</div>
            ) : upcomingCalendarEvents.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <CalendarIcon className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-400">No upcoming events scheduled</p>
                <Link to="/calendar">
                  <Button size="sm" variant="ghost">
                    + Add Event
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingCalendarEvents.map((evt) => {
                  const eventColor = evt.color || EVENT_TYPE_COLORS[evt.type] || '#4f46e5';
                  const eventLabel = EVENT_TYPE_LABELS[evt.type] || evt.type || 'Event';
                  const dateStr = getEventDateStr(evt);
                  const timeStr = formatEventTime(evt);

                  return (
                    <div
                      key={evt._id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="default" size="sm">
                          {eventLabel}
                        </Badge>
                        <span className="text-[11px] text-slate-400 font-medium">{dateStr}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {evt.title}
                      </h4>
                      {timeStr && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                          {timeStr}
                          {evt.location ? ` • ${evt.location}` : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* SECTION F: NOTIFICATION SUMMARY */}
          <Card padding="lg" className="space-y-4">
            <SectionHeader
              title="Recent Alerts"
              subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications caught up'}
              action={
                <Link to="/notifications" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  View All
                </Link>
              }
            />

            {notifsError ? (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400">
                {notifsError}
              </div>
            ) : notifsLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <Bell className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-400">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {notifications.slice(0, 3).map((notif) => (
                  <div
                    key={notif._id}
                    className={`p-3 rounded-xl border text-xs transition-colors ${
                      !notif.read
                        ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40'
                        : 'bg-slate-50/30 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* SECTION G: QUICK ACTIONS HUB */}
          <Card padding="lg" className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-indigo-500" />
              Quick Navigation
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                to="/opportunities"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="font-medium truncate">Explore Roles</span>
              </Link>

              <Link
                to="/applications"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-800 transition-colors flex items-center gap-2"
              >
                <Briefcase className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="font-medium truncate">Applications</span>
              </Link>

              <Link
                to="/saved"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors flex items-center gap-2"
              >
                <Bookmark className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-medium truncate">Saved Roles</span>
              </Link>

              <Link
                to="/calendar"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800 transition-colors flex items-center gap-2"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-medium truncate">Calendar</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
