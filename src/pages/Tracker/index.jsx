import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Flame,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  RefreshCw,
  Target,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { TargetItem } from '../../components/cards/TargetItem';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import * as trackerApi from '../../services/trackerApi';

const CATEGORIES = [
  'DSA',
  'Development',
  'Project',
  'Open Source',
  'Learning',
  'College',
  'Coding',
  'Application',
  'Other',
];

const DURATION_PRESETS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min (1 hr)' },
  { value: '90', label: '90 min (1.5 hrs)' },
  { value: '120', label: '120 min (2 hrs)' },
  { value: '180', label: '180 min (3 hrs)' },
  { value: '240', label: '240 min (4 hrs)' },
];

const PRIORITIES = ['Low', 'Medium', 'High'];

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

// Generate the past 7 days (YYYY-MM-DD) ending today
function getLast7Days() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
    days.push({ dateStr, dayLabel });
  }
  return days;
}

export function TrackerPage() {
  const { token, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(getTodayDateString);
  const [categoryFilter, setCategoryFilter] = useState(undefined);

  const [tasks, setTasks] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('DSA');
  const [formDuration, setFormDuration] = useState('60');
  const [formPriority, setFormPriority] = useState('Medium');
  const [formNotes, setFormNotes] = useState('');
  const [formDate, setFormDate] = useState(selectedDate);
  const [formCompleted, setFormCompleted] = useState(false);

  const abortControllerRef = useRef(null);

  // ─── Load Tracker Activities for Selected Date & 7-Day Window ─────
  const loadTracker = useCallback(async () => {
    if (!token) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setActionError(null);

    try {
      // 1. Fetch activities for selected date
      const dateParams = { date: selectedDate };
      if (categoryFilter) dateParams.category = categoryFilter;

      // 2. Fetch past 7 days for weekly activity chart
      const last7 = getLast7Days();
      const startDate = last7[0].dateStr;
      const endDate = last7[last7.length - 1].dateStr;

      const [dateRes, weekRes] = await Promise.all([
        trackerApi.getTrackerActivities(dateParams, token, controller.signal),
        trackerApi.getTrackerActivities({ startDate, endDate, limit: 100 }, token, controller.signal),
      ]);

      if (!controller.signal.aborted) {
        setTasks(dateRes.activities || []);

        // Aggregate real focus time per day for the 7-day sprint
        const weekActivities = weekRes.activities || [];
        const chartData = last7.map(({ dateStr, dayLabel }) => {
          const dayTotalMinutes = weekActivities
            .filter((a) => {
              const aDate = a.date ? a.date.split('T')[0] : '';
              return aDate === dateStr && a.completed;
            })
            .reduce((sum, a) => sum + (Number(a.durationMinutes) || 0), 0);

          return {
            dateStr,
            day: dayLabel,
            focusTimeMinutes: dayTotalMinutes,
          };
        });

        setWeeklyData(chartData);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        return;
      }
      if (!controller.signal.aborted) {
        setError(err.message || 'Unable to load daily tracker.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, selectedDate, categoryFilter, logout]);

  useEffect(() => {
    loadTracker();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadTracker]);

  // ─── Toggle Task Completion ───────────────────────────────────────
  const handleToggleTask = async (taskId) => {
    if (!token) return;

    const target = tasks.find((t) => (t._id || t.id) === taskId);
    if (!target) return;

    const newCompleted = !target.completed;
    const prevTasks = [...tasks];

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => ((t._id || t.id) === taskId ? { ...t, completed: newCompleted } : t))
    );

    try {
      await trackerApi.updateTrackerActivity(taskId, { completed: newCompleted }, token);
      // Refresh weekly chart in background to reflect change
      const last7 = getLast7Days();
      const startDate = last7[0].dateStr;
      const endDate = last7[last7.length - 1].dateStr;
      const weekRes = await trackerApi.getTrackerActivities({ startDate, endDate, limit: 100 }, token);
      const weekActivities = weekRes.activities || [];
      setWeeklyData(
        last7.map(({ dateStr, dayLabel }) => {
          const dayTotalMinutes = weekActivities
            .filter((a) => (a.date ? a.date.split('T')[0] : '') === dateStr && a.completed)
            .reduce((sum, a) => sum + (Number(a.durationMinutes) || 0), 0);
          return { dateStr, day: dayLabel, focusTimeMinutes: dayTotalMinutes };
        })
      );
    } catch (err) {
      // Rollback
      setTasks(prevTasks);
      setActionError(err.message || 'Unable to update task status.');
    }
  };

  // ─── Modal Openers ────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormCategory('DSA');
    setFormDuration('60');
    setFormPriority('Medium');
    setFormNotes('');
    setFormDate(selectedDate);
    setFormCompleted(false);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (task) => {
    setEditingTask(task);
    setFormTitle(task.title || '');
    setFormCategory(task.category || 'DSA');
    setFormDuration(String(task.durationMinutes || 60));
    setFormPriority(task.priority || 'Medium');
    setFormNotes(task.notes || '');
    setFormDate(task.date ? task.date.split('T')[0] : selectedDate);
    setFormCompleted(Boolean(task.completed));
    setFormError(null);
    setModalOpen(true);
  };

  // ─── Save / Update Task ───────────────────────────────────────────
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!token) return;

    const cleanTitle = formTitle.trim();
    if (!cleanTitle) {
      setFormError('Target title is required.');
      return;
    }

    const payload = {
      title: cleanTitle,
      category: formCategory,
      durationMinutes: Number(formDuration) || 0,
      priority: formPriority,
      notes: formNotes.trim() || undefined,
      date: new Date(`${formDate}T12:00:00.000Z`).toISOString(),
      completed: formCompleted,
    };

    setSaving(true);
    setFormError(null);

    try {
      if (editingTask) {
        const taskId = editingTask._id || editingTask.id;
        await trackerApi.updateTrackerActivity(taskId, payload, token);
      } else {
        await trackerApi.createTrackerActivity(payload, token);
      }
      setModalOpen(false);
      loadTracker();
    } catch (err) {
      setFormError(err.message || 'Failed to save activity.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Task ──────────────────────────────────────────────────
  const handleDeleteTask = async (taskId) => {
    if (!token || !taskId) return;

    setDeleting(true);
    try {
      await trackerApi.deleteTrackerActivity(taskId, token);
      setDeleteConfirmId(null);
      if (editingTask && (editingTask._id || editingTask.id) === taskId) {
        setModalOpen(false);
      }
      loadTracker();
    } catch (err) {
      setActionError(err.message || 'Failed to delete activity.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Metrics Computation ──────────────────────────────────────────
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalFocusMinutes = tasks
    .filter((t) => t.completed)
    .reduce((acc, curr) => acc + (Number(curr.durationMinutes) || 0), 0);

  // Derive real active days from weekly data (days with > 0 focus minutes)
  const activeDaysThisSprint = weeklyData.filter((d) => d.focusTimeMinutes > 0).length;

  const isToday = selectedDate === getTodayDateString();

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Daily Productivity Tracker"
        subtitle="Log daily coding hours, DSA problem targets, and learning milestones."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={loadTracker}>
              Refresh
            </Button>
            <Button size="sm" icon={Plus} onClick={handleOpenAddModal}>
              Add Target
            </Button>
          </div>
        }
      />

      {/* Action Error Alert */}
      {actionError && (
        <div
          className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date Selector & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Selected Date */}
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Selected Date</span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>{selectedDate}</span>
            </div>
            {isToday ? (
              <span className="text-[11px] text-emerald-500 font-medium">Today</span>
            ) : (
              <button
                onClick={() => setSelectedDate(getTodayDateString())}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Jump to Today
              </button>
            )}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium focus:outline-none border border-slate-200 dark:border-slate-700 cursor-pointer"
          />
        </Card>

        {/* Metric 2: Completed Targets */}
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Completed Targets</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {completedCount} / {tasks.length}
            </div>
            <span className="text-xs text-slate-500">
              {tasks.length > 0 ? `${Math.round((completedCount / tasks.length) * 100)}% Finished` : '0 targets set'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        {/* Metric 3: Focus Time Logged */}
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Focus Time Logged</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {totalFocusMinutes} min
            </div>
            <span className="text-xs text-indigo-500 font-medium">
              {(totalFocusMinutes / 60).toFixed(1)} hours today
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        {/* Metric 4: Active Sprint Days */}
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">7-Day Sprint Activity</span>
            <div className="text-2xl font-bold text-amber-500 mt-0.5">
              {activeDaysThisSprint} / 7 Days
            </div>
            <span className="text-xs text-slate-500">Active Sprint Days</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setCategoryFilter(undefined)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            categoryFilter === undefined
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          All Categories
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              categoryFilter === cat
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Delete Confirmation Banner */}
      {deleteConfirmId && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60"
          role="alert"
        >
          <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            Permanently delete this activity? This cannot be undone.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleDeleteTask(deleteConfirmId)} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      {/* Main Targets Checklist */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
              Targets Checklist for {selectedDate}
            </h3>
            <p className="text-xs text-slate-400">
              Click checkboxes to mark targets complete, or click any card to edit details.
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingState text="Loading targets..." />
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            title="Unable to load targets"
            description={error}
            actionLabel="Retry"
            onAction={loadTracker}
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No targets logged for this date"
            description="Stay on track with your career preparation. Log your coding practice, project tasks, or learning milestones."
            actionLabel="Add Target"
            onAction={handleOpenAddModal}
          />
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <TargetItem
                key={task._id || task.id}
                task={task}
                onToggleComplete={handleToggleTask}
                onEdit={handleOpenEditModal}
                onDelete={(id) => setDeleteConfirmId(id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Real Weekly Productivity Visual Chart */}
      <Card padding="lg" className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
            7-Day Productivity Overview
          </h3>
          <p className="text-xs text-slate-400">
            Real logged focus time across your past 7 days (completed targets).
          </p>
        </div>

        <div className="grid grid-cols-7 gap-3 pt-4 text-center">
          {weeklyData.map((stat, idx) => {
            const maxSprintMinutes = Math.max(
              240,
              ...weeklyData.map((s) => s.focusTimeMinutes)
            );
            const heightPercent =
              stat.focusTimeMinutes > 0
                ? Math.min(100, Math.round((stat.focusTimeMinutes / maxSprintMinutes) * 100))
                : 6;

            const isSelected = stat.dateStr === selectedDate;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(stat.dateStr)}
                className={`flex flex-col items-center gap-2 cursor-pointer p-1 rounded-xl transition-all ${
                  isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30' : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
                title={`${stat.day} (${stat.dateStr}): ${stat.focusTimeMinutes} min`}
              >
                <span className="text-[11px] text-slate-400 font-mono">
                  {stat.focusTimeMinutes > 0
                    ? `${(stat.focusTimeMinutes / 60).toFixed(1)}h`
                    : '0h'}
                </span>
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl h-32 relative flex items-end overflow-hidden p-1">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      stat.focusTimeMinutes > 0
                        ? 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                        : 'bg-slate-200 dark:bg-slate-700/40'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isSelected
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {stat.day}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Add / Edit Target Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Edit Target' : 'Add New Target'}
        subtitle={
          editingTask
            ? 'Update target title, duration, category, and priority.'
            : 'Create a new daily learning, coding, or project target.'
        }
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          <Input
            label="Target Title / Description"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="e.g. Implement JWT refresh tokens in Node.js"
            required
            disabled={saving}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              options={CATEGORIES}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              disabled={saving}
            />

            <Select
              label="Planned Duration"
              options={DURATION_PRESETS}
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority Level"
              options={PRIORITIES}
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value)}
              disabled={saving}
            />

            <Input
              label="Date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <Textarea
            label="Notes (Optional)"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Add specific problem numbers, GitHub branches, or notes..."
            disabled={saving}
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="formCompletedCheckbox"
              checked={formCompleted}
              onChange={(e) => setFormCompleted(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              disabled={saving}
            />
            <label
              htmlFor="formCompletedCheckbox"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Mark as already completed
            </label>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div>
              {editingTask && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setDeleteConfirmId(editingTask._id || editingTask.id)}
                  disabled={saving}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  icon={Trash2}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Target'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
