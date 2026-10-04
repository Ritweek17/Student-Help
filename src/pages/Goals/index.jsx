import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Edit2,
  RefreshCw,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/ui/Progress';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import * as goalApi from '../../services/goalApi';

const CATEGORIES = [
  'DSA',
  'Development',
  'Project',
  'Learning',
  'Career',
  'Open Source',
  'Placement',
  'Other',
];

const STATUSES = ['active', 'completed', 'paused', 'cancelled'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const CATEGORY_BADGES = {
  DSA: 'indigo',
  Development: 'purple',
  Project: 'emerald',
  Learning: 'sky',
  Career: 'primary',
  'Open Source': 'cyan',
  Placement: 'amber',
  Other: 'default',
};

const STATUS_BADGES = {
  active: 'primary',
  completed: 'success',
  paused: 'warning',
  cancelled: 'default',
};

function computeProgress(current, target) {
  if (!target || target <= 0) return 0;
  const pct = (current / target) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

function checkIsOverdue(deadline, status) {
  if (!deadline || status !== 'active') return false;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function GoalsPage() {
  const { token, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [goals, setGoals] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    completed: 0,
    paused: 0,
    overdue: 0,
    averageProgress: 0,
  });

  const [activeTab, setActiveTab] = useState('active');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Quick progress update modal
  const [progressModalGoal, setProgressModalGoal] = useState(null);
  const [quickProgressValue, setQuickProgressValue] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Career');
  const [targetValue, setTargetValue] = useState('100');
  const [currentValue, setCurrentValue] = useState('0');
  const [unit, setUnit] = useState('problems');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('active');

  const abortControllerRef = useRef(null);

  // ─── Fetch Goals ──────────────────────────────────────────────────
  const loadGoals = useCallback(async () => {
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
      const params = { limit: 100 };
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedPriority !== 'All') params.priority = selectedPriority;

      const res = await goalApi.getGoals(params, token, controller.signal);

      if (!controller.signal.aborted) {
        setGoals(res.goals || []);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        return;
      }
      if (!controller.signal.aborted) {
        setError(err.message || 'Unable to load goals.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, selectedCategory, selectedPriority, logout]);

  useEffect(() => {
    loadGoals();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadGoals]);

  // ─── Modal Openers ────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingGoal(null);
    setTitle('');
    setDescription('');
    setCategory('Career');
    setTargetValue('100');
    setCurrentValue('0');
    setUnit('items');
    setDeadline('');
    setPriority('Medium');
    setStatus('active');
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (goal) => {
    setEditingGoal(goal);
    setTitle(goal.title || '');
    setDescription(goal.description || '');
    setCategory(goal.category || 'Career');
    setTargetValue(String(goal.targetValue || 100));
    setCurrentValue(String(goal.currentValue || 0));
    setUnit(goal.unit || 'items');
    setDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
    setPriority(goal.priority || 'Medium');
    setStatus(goal.status || 'active');
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenProgressModal = (goal) => {
    setProgressModalGoal(goal);
    setQuickProgressValue(String(goal.currentValue || 0));
  };

  // ─── Save / Update Goal ───────────────────────────────────────────
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!token) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Goal title is required.');
      return;
    }

    const tVal = Number(targetValue);
    if (isNaN(tVal) || tVal <= 0) {
      setFormError('Target value must be a positive number greater than 0.');
      return;
    }

    const cVal = Number(currentValue);
    if (isNaN(cVal) || cVal < 0) {
      setFormError('Current progress value cannot be negative.');
      return;
    }

    const payload = {
      title: cleanTitle,
      description: description.trim(),
      category,
      targetValue: tVal,
      currentValue: cVal,
      unit: unit.trim() || 'items',
      deadline: deadline ? new Date(`${deadline}T12:00:00.000Z`).toISOString() : null,
      priority,
      status,
    };

    setSaving(true);
    setFormError(null);

    try {
      if (editingGoal) {
        const goalId = editingGoal._id || editingGoal.id;
        await goalApi.updateGoal(goalId, payload, token);
      } else {
        await goalApi.createGoal(payload, token);
      }
      setModalOpen(false);
      loadGoals();
    } catch (err) {
      setFormError(err.message || 'Failed to save goal.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Direct Increment / Decrement Progress ────────────────────────
  const handleStepProgress = async (goal, delta) => {
    if (!token) return;
    const goalId = goal._id || goal.id;
    const newCurrent = Math.max(0, (goal.currentValue || 0) + delta);

    // Optimistic UI update
    setGoals((prev) =>
      prev.map((g) =>
        (g._id || g.id) === goalId
          ? {
              ...g,
              currentValue: newCurrent,
              status: newCurrent >= g.targetValue ? 'completed' : g.status,
            }
          : g
      )
    );

    try {
      await goalApi.updateGoalProgress(goalId, newCurrent, token);
      // Silently refresh summary
      const silentRes = await goalApi.getGoals({ limit: 100 }, token);
      if (silentRes?.summary) setSummary(silentRes.summary);
    } catch (err) {
      // Rollback
      loadGoals();
      setActionError(err.message || 'Failed to update progress.');
    }
  };

  // ─── Save Quick Progress Modal ────────────────────────────────────
  const handleSaveProgressModal = async (e) => {
    e.preventDefault();
    if (!token || !progressModalGoal) return;

    const val = Number(quickProgressValue);
    if (isNaN(val) || val < 0) {
      setActionError('Progress value must be a non-negative number.');
      return;
    }

    setSavingProgress(true);
    const goalId = progressModalGoal._id || progressModalGoal.id;

    try {
      await goalApi.updateGoalProgress(goalId, val, token);
      setProgressModalGoal(null);
      loadGoals();
    } catch (err) {
      setActionError(err.message || 'Failed to update progress.');
    } finally {
      setSavingProgress(false);
    }
  };

  // ─── Delete Goal ──────────────────────────────────────────────────
  const handleDeleteGoal = async (goalId) => {
    if (!token || !goalId) return;

    setDeleting(true);
    try {
      await goalApi.deleteGoal(goalId, token);
      setDeleteConfirmId(null);
      if (editingGoal && (editingGoal._id || editingGoal.id) === goalId) {
        setModalOpen(false);
      }
      loadGoals();
    } catch (err) {
      setActionError(err.message || 'Failed to delete goal.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Filter & Group Goals ─────────────────────────────────────────
  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');
  const pausedGoals = goals.filter((g) => g.status === 'paused');

  const tabs = [
    { id: 'active', label: 'Active', count: activeGoals.length },
    { id: 'completed', label: 'Completed', count: completedGoals.length },
    { id: 'paused', label: 'Paused', count: pausedGoals.length },
    { id: 'all', label: 'All Goals', count: goals.length },
  ];

  let filteredGoals = goals;
  if (activeTab === 'active') filteredGoals = activeGoals;
  else if (activeTab === 'completed') filteredGoals = completedGoals;
  else if (activeTab === 'paused') filteredGoals = pausedGoals;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Career Goals & Roadmaps"
        subtitle="Set macro career objectives, break down target milestones, and track real quantitative progress."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={loadGoals}>
              Refresh
            </Button>
            <Button size="sm" icon={Plus} onClick={handleOpenAddModal}>
              New Goal
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

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Goals</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {summary.total}
            </div>
            <span className="text-xs text-slate-500">Tracked outcomes</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active</span>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {summary.active}
            </div>
            <span className="text-xs text-slate-500">In progress</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {summary.completed}
            </div>
            <span className="text-xs text-slate-500">
              {summary.total > 0 ? `${Math.round((summary.completed / summary.total) * 100)}% achieved` : '0%'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue</span>
            <div className={`text-2xl font-bold mt-0.5 ${summary.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {summary.overdue}
            </div>
            <span className="text-xs text-slate-500">{summary.overdue > 0 ? 'Past deadline' : 'On schedule'}</span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${summary.overdue > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Progress</span>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              {summary.averageProgress}%
            </div>
            <span className="text-xs text-slate-500">Overall pace</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Banner */}
      {deleteConfirmId && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60"
          role="alert"
        >
          <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="text-sm text-rose-800 dark:text-rose-200 flex-1">
            Permanently delete this career goal? This cannot be undone.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleDeleteGoal(deleteConfirmId)} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      {/* Filters and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
            aria-label="Filter by category"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
            aria-label="Filter by priority"
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState text="Loading career goals and roadmaps..." />
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Unable to load goals"
          description={error}
          actionLabel="Retry"
          onAction={loadGoals}
        />
      ) : filteredGoals.length > 0 ? (
        <div className="space-y-4">
          {filteredGoals.map((goal) => {
            const goalId = goal._id || goal.id;
            const progressPct = computeProgress(goal.currentValue, goal.targetValue);
            const isOverdue = checkIsOverdue(goal.deadline, goal.status);
            const isDone = goal.status === 'completed';

            return (
              <Card key={goalId} padding="lg" className="space-y-4 group">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={CATEGORY_BADGES[goal.category] || 'default'} size="sm">
                        {goal.category}
                      </Badge>
                      <Badge variant={STATUS_BADGES[goal.status] || 'default'} size="sm">
                        {goal.status}
                      </Badge>
                      <Badge
                        variant={
                          goal.priority === 'High' ? 'danger' : goal.priority === 'Medium' ? 'warning' : 'default'
                        }
                        size="sm"
                      >
                        {goal.priority}
                      </Badge>

                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                          <AlertCircle className="w-3 h-3" />
                          Overdue
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-lg font-bold transition-all font-heading ${
                        isDone
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {goal.title}
                    </h3>

                    {goal.description && (
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    {goal.deadline && (
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-slate-400 block">Target Deadline</span>
                        <span
                          className={`text-xs font-bold ${
                            isOverdue
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {goal.deadline.split('T')[0]}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(goal)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Goal"
                        aria-label="Edit Goal"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(goalId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete Goal"
                        aria-label="Delete Goal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Numeric Indicator */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Progress:{' '}
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {goal.currentValue} / {goal.targetValue} {goal.unit}
                      </span>
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {progressPct}%
                    </span>
                  </div>

                  <Progress
                    value={progressPct}
                    color={isDone ? 'emerald' : progressPct > 70 ? 'indigo' : 'primary'}
                    size="md"
                  />
                </div>

                {/* Progress Quick-Action Controls */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-400">Quick adjust progress</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStepProgress(goal, -1)}
                      disabled={goal.currentValue <= 0}
                      className="px-2 py-1 h-7 text-xs"
                    >
                      -1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStepProgress(goal, 1)}
                      className="px-2 py-1 h-7 text-xs"
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenProgressModal(goal)}
                      className="px-2.5 py-1 h-7 text-xs text-indigo-600 dark:text-indigo-400"
                    >
                      Set Exact Value
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title={
            activeTab === 'completed'
              ? 'No completed goals yet'
              : activeTab === 'paused'
              ? 'No paused goals'
              : 'No goals in this view'
          }
          description={
            activeTab === 'completed'
              ? 'Keep making steady progress! Goals reach 100% when your target is achieved.'
              : 'Define macro targets like "Complete 150 DSA Problems" or "Build a Full-Stack MERN App" to keep yourself focused.'
          }
          actionLabel="Create New Goal"
          onAction={handleOpenAddModal}
        />
      )}

      {/* Add / Edit Goal Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGoal ? 'Edit Career Goal' : 'Create New Career Goal'}
        subtitle={
          editingGoal
            ? 'Update target metrics, deadlines, category, or status.'
            : 'Define a quantitative outcome and set your target metrics.'
        }
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          <Input
            label="Goal Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Solve 150 LeetCode Medium DSA Problems"
            required
            disabled={saving}
          />

          <Textarea
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain why this goal matters and what resources you will use..."
            disabled={saving}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Category"
              options={CATEGORIES}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
            />

            <Select
              label="Priority"
              options={PRIORITIES}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={saving}
            />

            {editingGoal ? (
              <Select
                label="Status"
                options={STATUSES}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={saving}
              />
            ) : (
              <Input
                label="Target Deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={saving}
              />
            )}
          </div>

          {editingGoal && (
            <Input
              label="Target Deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={saving}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Target Value"
              type="number"
              min="1"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="150"
              required
              disabled={saving}
            />

            <Input
              label="Current Progress"
              type="number"
              min="0"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="0"
              required
              disabled={saving}
            />

            <Input
              label="Measurement Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. problems, hours, apps"
              disabled={saving}
            />
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div>
              {editingGoal && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setDeleteConfirmId(editingGoal._id || editingGoal.id)}
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
                {saving ? 'Saving...' : editingGoal ? 'Save Changes' : 'Create Goal'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Quick Progress Update Modal */}
      <Modal
        isOpen={Boolean(progressModalGoal)}
        onClose={() => setProgressModalGoal(null)}
        title="Update Goal Progress"
        subtitle={
          progressModalGoal
            ? `${progressModalGoal.title} (Target: ${progressModalGoal.targetValue} ${progressModalGoal.unit})`
            : ''
        }
      >
        <form onSubmit={handleSaveProgressModal} className="space-y-4">
          <Input
            label={`Current Value (${progressModalGoal?.unit || 'units'})`}
            type="number"
            min="0"
            value={quickProgressValue}
            onChange={(e) => setQuickProgressValue(e.target.value)}
            required
            disabled={savingProgress}
          />

          <p className="text-xs text-slate-400">
            Progress will automatically calculate as (Current / Target) × 100%. Reaching target marks
            the goal completed.
          </p>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => setProgressModalGoal(null)}
              disabled={savingProgress}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingProgress}>
              {savingProgress ? 'Saving...' : 'Update Progress'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
