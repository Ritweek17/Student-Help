import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Briefcase,
  Target,
  ArrowRight,
  BookOpen,
  Calendar as CalendarIcon,
  Trophy,
  CheckSquare,
  Bookmark
} from 'lucide-react';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { OpportunityCard } from '../../components/cards/OpportunityCard';
import { TargetItem } from '../../components/cards/TargetItem';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../context/AuthContext';
import {
  fetchOpportunities,
  fetchDailyTasks,
  fetchApplications,
  fetchGoals,
  fetchLearningTracks,
  fetchTodos,
  fetchCalendarEvents,
  fetchCodingContests,
  fetchStudentProfile
} from '../../services/mockApi';

export function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [goals, setGoals] = useState([]);
  const [learningTracks, setLearningTracks] = useState([]);
  const [todos, setTodos] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [contests, setContests] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [profData, taskData, oppData, appData, goalData, learnData, todoData, calData, contestData] =
          await Promise.all([
            fetchStudentProfile(),
            fetchDailyTasks(),
            fetchOpportunities(),
            fetchApplications(),
            fetchGoals(),
            fetchLearningTracks(),
            fetchTodos(),
            fetchCalendarEvents(),
            fetchCodingContests()
          ]);
        setProfile(profData);
        setTasks(taskData);
        setOpportunities(oppData);
        setApplications(appData);
        setGoals(goalData);
        setLearningTracks(learnData);
        setTodos(todoData);
        setCalendarEvents(calData);
        setContests(contestData);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleToggleTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t))
    );
  };

  if (loading) {
    return <LoadingState text="Loading CareerOS Student Workspace..." />;
  }

  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const greetingName = user?.email ? user.email.split('@')[0] : (profile?.personal?.fullName || 'Alex');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/80 via-slate-900 to-indigo-950/60 border border-indigo-500/20 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Student Workspace
            </span>
            <Badge variant="success" size="sm">7-Day Streak 🔥</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading">
            Good morning, {greetingName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            You have <span className="font-semibold text-white">{todos.filter(t => t.status !== 'completed').length} active todos</span>, <span className="font-semibold text-white">2 learning tracks in progress</span>, and <span className="font-semibold text-white">1 interview scheduled</span>.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Link to="/opportunities">
            <Button variant="primary" size="sm" icon={Sparkles}>
              Explore Roles
            </Button>
          </Link>
          <Link to="/calendar">
            <Button variant="outline" size="sm" className="border-indigo-400/40 text-slate-200 hover:bg-indigo-950/40" icon={CalendarIcon}>
              Open Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Today's Progress</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {completedTasksCount} / {tasks.length}
            </div>
            <span className="text-xs text-slate-500">Daily Targets Logged</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Learning Tracks</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {learningTracks.length} Active
            </div>
            <span className="text-xs text-indigo-500 font-medium">React & DSA Progress</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Active Applications</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {applications.length} Submitted
            </div>
            <span className="text-xs text-purple-500 font-medium">1 Interview Stage</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Upcoming Contests</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {contests.length} Listed
            </div>
            <span className="text-xs text-amber-500 font-medium">LeetCode & CodeChef</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Main Grid: Learning & Tasks vs Calendar & Contests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* LEARNING TRACKS SUMMARY */}
          <Card padding="lg">
            <SectionHeader
              title="My Learning Tracks"
              subtitle="Course progress & next suggested lesson"
              action={
                <Link to="/learning">
                  <Button size="sm" variant="ghost" icon={ArrowRight}>
                    Learning Hub
                  </Button>
                </Link>
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {learningTracks.slice(0, 2).map((track) => (
                <div key={track.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="primary" size="sm">{track.category}</Badge>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{track.progress}%</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{track.title}</h4>
                  <Progress value={track.progress} color="indigo" size="sm" />
                  <span className="text-[11px] text-slate-400 block truncate">Next: {track.nextSuggestedTopic}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* TODAY'S TARGETS */}
          <Card padding="lg">
            <SectionHeader
              title="Today's Daily Targets"
              subtitle="Logged learning, coding, and application tasks"
              action={
                <Link to="/tracker">
                  <Button size="sm" variant="ghost" icon={ArrowRight}>
                    Daily Tracker
                  </Button>
                </Link>
              }
            />
            <div className="space-y-2.5">
              {tasks.map((task) => (
                <TargetItem key={task.id} task={task} onToggleComplete={handleToggleTask} />
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* UPCOMING CALENDAR EVENTS */}
          <Card padding="lg">
            <SectionHeader
              title="CareerOS Calendar Events"
              subtitle="Upcoming deadlines & interview rounds"
              action={
                <Link to="/calendar" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  Full Calendar
                </Link>
              }
            />

            <div className="space-y-3">
              {calendarEvents.slice(0, 3).map((evt) => (
                <div key={evt.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" size="sm">{evt.category}</Badge>
                    <span className="text-slate-400 font-medium">{evt.date}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">{evt.title}</h4>
                  <span className="text-[11px] text-slate-500 block">{evt.startTime} - {evt.endTime} • {evt.location}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* CODING CONTEST REMINDERS */}
          <Card padding="lg">
            <SectionHeader
              title="Upcoming Coding Contests"
              subtitle="LeetCode & CodeChef schedules"
              action={
                <Link to="/contests" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  Contests Page
                </Link>
              }
            />

            <div className="space-y-3">
              {contests.slice(0, 2).map((contest) => (
                <div key={contest.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">{contest.name}</span>
                    <span className="text-slate-400">{contest.date} • {contest.startTime}</span>
                  </div>
                  <Badge variant="primary" size="sm">{contest.platform}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
