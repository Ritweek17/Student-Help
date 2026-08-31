import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, Flame, CheckCircle2, Award } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { TargetItem } from '../../components/cards/TargetItem';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchDailyTasks, fetchWeeklyActivity } from '../../services/mockApi';

export function TrackerPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2026-08-31');
  const [addModalOpen, setAddModalOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('DSA');
  const [newDuration, setNewDuration] = useState('60 min');
  const [newPriority, setNewPriority] = useState('Medium');

  useEffect(() => {
    async function loadTracker() {
      try {
        const [taskData, weekData] = await Promise.all([
          fetchDailyTasks(),
          fetchWeeklyActivity()
        ]);
        setTasks(taskData);
        setWeeklyData(weekData);
      } catch (err) {
        console.error('Error fetching tracker:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTracker();
  }, []);

  const handleToggleTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
          : t
      )
    );
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask = {
      id: `task-${Date.now()}`,
      title: newTitle,
      category: newCategory,
      plannedDuration: newDuration,
      actualDuration: newDuration,
      status: 'pending',
      priority: newPriority,
      date: selectedDate
    };

    setTasks([newTask, ...tasks]);
    setNewTitle('');
    setAddModalOpen(false);
  };

  if (loading) {
    return <LoadingState text="Loading Daily Tracker..." />;
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalFocusMinutes = tasks
    .filter((t) => t.status === 'completed')
    .reduce((acc, curr) => acc + parseInt(curr.plannedDuration || '0'), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Daily Productivity Tracker"
        subtitle="Log daily coding hours, DSA problem targets, and learning milestones."
        action={
          <Button icon={Plus} onClick={() => setAddModalOpen(true)}>
            Add Target
          </Button>
        }
      />

      {/* Date Selector & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Selected Date</span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>{selectedDate}</span>
            </div>
            <span className="text-[11px] text-emerald-500 font-medium">Today</span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium focus:outline-none border border-slate-200 dark:border-slate-700"
          />
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Completed Targets</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {completedCount} / {tasks.length}
            </div>
            <span className="text-xs text-slate-500">
              {Math.round((completedCount / tasks.length) * 100)}% Completed
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Focus Time Logged</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {totalFocusMinutes} min
            </div>
            <span className="text-xs text-indigo-500 font-medium">{(totalFocusMinutes / 60).toFixed(1)} hours today</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Current Streak</span>
            <div className="text-2xl font-bold text-amber-500 mt-0.5">7 Days</div>
            <span className="text-xs text-slate-500">Personal Best: 14 Days</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Main Targets List */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
              Targets Checklist for {selectedDate}
            </h3>
            <p className="text-xs text-slate-400">Click checkboxes to mark tasks as finished.</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {tasks.map((task) => (
            <TargetItem key={task.id} task={task} onToggleComplete={handleToggleTask} />
          ))}
        </div>
      </Card>

      {/* Weekly Productivity Visual Chart */}
      <Card padding="lg" className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
            Weekly Productivity Overview
          </h3>
          <p className="text-xs text-slate-400">Logged focus time across the current 7-day sprint.</p>
        </div>

        <div className="grid grid-cols-7 gap-3 pt-4 text-center">
          {weeklyData.map((stat, idx) => {
            const heightPercent = Math.min(100, Math.round((stat.focusTimeMinutes / 450) * 100));
            return (
              <div key={idx} className="flex flex-col items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  {Math.round(stat.focusTimeMinutes / 60)}h
                </span>
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl h-32 relative flex items-end overflow-hidden p-1">
                  <div
                    className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-lg transition-all duration-500"
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{stat.day}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Add Target Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Target"
        subtitle="Create a new daily learning or coding target."
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Target Title / Description"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Implement JWT refresh tokens in Node.js"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              options={['DSA', 'Learning', 'Project', 'Coding', 'GitHub', 'Application', 'Reading', 'Workshop', 'Other']}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Select
              label="Planned Duration"
              options={['30 min', '45 min', '60 min', '90 min', '120 min', '180 min']}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
          </div>

          <Select
            label="Priority Level"
            options={['Low', 'Medium', 'High']}
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
          />

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Target</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
