import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  CheckSquare,
  AlertCircle,
  X,
  Trash2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import { TodoItemRow } from '../../components/cards/TodoItemRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../context/AuthContext';
import * as todoApi from '../../services/todoApi';

const PRIORITIES = ['High', 'Medium', 'Low'];

const CATEGORIES = [
  'DSA',
  'Development',
  'Learning',
  'Application',
  'Hackathon',
  'Backend',
  'Project',
  'College',
  'General',
  'Other',
];

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

export function TodosPage() {
  const { token, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [todos, setTodos] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    today: 0,
    upcoming: 0,
    overdue: 0,
  });

  const [activeTab, setActiveTab] = useState('Today');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('General');
  const [dueDate, setDueDate] = useState(getTodayDateString);
  const [formCompleted, setFormCompleted] = useState(false);

  const abortControllerRef = useRef(null);

  // ─── Fetch Todos ──────────────────────────────────────────────────
  const loadTodos = useCallback(async () => {
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
      if (categoryFilter !== 'All') params.category = categoryFilter;
      if (priorityFilter !== 'All') params.priority = priorityFilter;

      const res = await todoApi.getTodos(params, token, controller.signal);

      if (!controller.signal.aborted) {
        setTodos(res.todos || []);
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
        setError(err.message || 'Unable to load todos.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, categoryFilter, priorityFilter, logout]);

  useEffect(() => {
    loadTodos();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadTodos]);

  // ─── Toggle Complete / Incomplete (Optimistic with Rollback) ──────
  const handleToggleComplete = async (todoId) => {
    if (!token) return;

    const target = todos.find((t) => (t._id || t.id) === todoId);
    if (!target) return;

    const newCompleted = !target.completed;
    const prevTodos = [...todos];

    // Optimistically update
    setTodos((prev) =>
      prev.map((t) =>
        (t._id || t.id) === todoId
          ? {
              ...t,
              completed: newCompleted,
              completedAt: newCompleted ? new Date().toISOString() : null,
            }
          : t
      )
    );

    try {
      const res = await todoApi.updateTodo(todoId, { completed: newCompleted }, token);
      if (res?.todo) {
        setTodos((prev) =>
          prev.map((t) => ((t._id || t.id) === todoId ? res.todo : t))
        );
      }
      // Re-fetch summary silently
      const silentRes = await todoApi.getTodos({ limit: 100 }, token);
      if (silentRes?.summary) {
        setSummary(silentRes.summary);
      }
    } catch (err) {
      // Rollback optimistic state
      setTodos(prevTodos);
      setActionError(err.message || 'Failed to update todo status.');
    }
  };

  // ─── Modal Openers ────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingTodo(null);
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setCategory('General');
    setDueDate(getTodayDateString());
    setFormCompleted(false);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (todo) => {
    setEditingTodo(todo);
    setTitle(todo.title || '');
    setDescription(todo.description || '');
    setPriority(todo.priority || 'Medium');
    setCategory(todo.category || 'General');
    setDueDate(todo.dueDate ? todo.dueDate.split('T')[0] : '');
    setFormCompleted(Boolean(todo.completed));
    setFormError(null);
    setModalOpen(true);
  };

  // ─── Save / Update Todo ───────────────────────────────────────────
  const handleSaveTodo = async (e) => {
    e.preventDefault();
    if (!token) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Todo title is required.');
      return;
    }

    const payload = {
      title: cleanTitle,
      description: description.trim(),
      priority,
      category,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00.000Z`).toISOString() : null,
      completed: formCompleted,
    };

    setSaving(true);
    setFormError(null);

    try {
      if (editingTodo) {
        const todoId = editingTodo._id || editingTodo.id;
        await todoApi.updateTodo(todoId, payload, token);
      } else {
        await todoApi.createTodo(payload, token);
      }
      setModalOpen(false);
      loadTodos();
    } catch (err) {
      setFormError(err.message || 'Failed to save todo.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Todo ──────────────────────────────────────────────────
  const handleDeleteTodo = async (todoId) => {
    if (!token || !todoId) return;

    setDeleting(true);
    try {
      await todoApi.deleteTodo(todoId, token);
      setDeleteConfirmId(null);
      if (editingTodo && (editingTodo._id || editingTodo.id) === todoId) {
        setModalOpen(false);
      }
      loadTodos();
    } catch (err) {
      setActionError(err.message || 'Failed to delete todo.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Tab & Group Filter Logic ─────────────────────────────────────
  const todayStr = getTodayDateString();

  const todayTodos = todos.filter((t) => {
    if (t.completed) return false;
    if (!t.dueDate) return false;
    const dueStr = t.dueDate.split('T')[0];
    return dueStr === todayStr;
  });

  const upcomingTodos = todos.filter((t) => {
    if (t.completed) return false;
    if (!t.dueDate) return true; // Undated tasks show under upcoming
    const dueStr = t.dueDate.split('T')[0];
    return dueStr > todayStr;
  });

  const overdueTodos = todos.filter((t) => {
    if (t.completed) return false;
    if (!t.dueDate) return false;
    const dueStr = t.dueDate.split('T')[0];
    return dueStr < todayStr;
  });

  const completedTodos = todos.filter((t) => Boolean(t.completed));

  const tabs = [
    { id: 'Today', label: 'Today', count: todayTodos.length },
    { id: 'Upcoming', label: 'Upcoming', count: upcomingTodos.length },
    { id: 'Overdue', label: 'Overdue', count: overdueTodos.length },
    { id: 'Completed', label: 'Completed', count: completedTodos.length },
    { id: 'All', label: 'All Tasks', count: todos.length },
  ];

  let filteredTodos = todos;
  if (activeTab === 'Today') filteredTodos = todayTodos;
  else if (activeTab === 'Upcoming') filteredTodos = upcomingTodos;
  else if (activeTab === 'Overdue') filteredTodos = overdueTodos;
  else if (activeTab === 'Completed') filteredTodos = completedTodos;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Action Items & Tasks"
        subtitle="Organize upcoming study items, project tasks, and career preparation action items."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={loadTodos}>
              Refresh
            </Button>
            <Button size="sm" icon={Plus} onClick={handleOpenAddModal}>
              Add Todo
            </Button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {summary.total}
            </div>
            <span className="text-xs text-slate-500">{summary.pending} pending</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Due Today</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {summary.today}
            </div>
            <span className="text-xs text-slate-500">Scheduled for today</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue</span>
            <div className={`text-2xl font-bold mt-0.5 ${summary.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {summary.overdue}
            </div>
            <span className="text-xs text-slate-500">{summary.overdue > 0 ? 'Needs attention' : 'All clear'}</span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${summary.overdue > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {summary.completed}
            </div>
            <span className="text-xs text-slate-500">
              {summary.total > 0 ? `${Math.round((summary.completed / summary.total) * 100)}% done` : '0% done'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
      </div>

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

      {/* Delete Confirmation Banner */}
      {deleteConfirmId && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60"
          role="alert"
        >
          <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="text-sm text-rose-800 dark:text-rose-200 flex-1">
            Permanently delete this task? This cannot be undone.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleDeleteTodo(deleteConfirmId)} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Grouping Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Priority & Category Dropdown Filters */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
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

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState text="Loading Todo Manager..." />
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Unable to load todos"
          description={error}
          actionLabel="Retry"
          onAction={loadTodos}
        />
      ) : filteredTodos.length > 0 ? (
        <div className="space-y-2.5">
          {filteredTodos.map((todo) => (
            <TodoItemRow
              key={todo._id || todo.id}
              todo={todo}
              onToggleComplete={handleToggleComplete}
              onEdit={handleOpenEditModal}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title={
            activeTab === 'Completed'
              ? 'No completed tasks yet'
              : activeTab === 'Overdue'
              ? 'No overdue tasks!'
              : activeTab === 'Today'
              ? 'No tasks due today'
              : 'No todos in this view'
          }
          description={
            activeTab === 'Overdue'
              ? 'Great job keeping up with your scheduled items!'
              : activeTab === 'Completed'
              ? 'Mark tasks as done as you complete them to track your productivity.'
              : 'Stay organized with your career preparation. Create a new task to track your daily progress.'
          }
          actionLabel="Add New Todo"
          onAction={handleOpenAddModal}
        />
      )}

      {/* Add / Edit Todo Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTodo ? 'Edit Todo' : 'Create New Todo'}
        subtitle={
          editingTodo
            ? 'Update task details, due date, priority, or category.'
            : 'Add a new action item to your study and career prep queue.'
        }
      >
        <form onSubmit={handleSaveTodo} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          <Input
            label="Todo Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Master React 19 useEffect Hook"
            required
            disabled={saving}
          />

          <Textarea
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context, tutorial links, or notes..."
            disabled={saving}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Priority"
              options={PRIORITIES}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={saving}
            />

            <Select
              label="Category"
              options={CATEGORIES}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
            />

            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="todoCompletedCheckbox"
              checked={formCompleted}
              onChange={(e) => setFormCompleted(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              disabled={saving}
            />
            <label
              htmlFor="todoCompletedCheckbox"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Mark as already completed
            </label>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div>
              {editingTodo && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setDeleteConfirmId(editingTodo._id || editingTodo.id)}
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
                {saving ? 'Saving...' : editingTodo ? 'Save Changes' : 'Create Todo'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
