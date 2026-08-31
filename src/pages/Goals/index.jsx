import React, { useState, useEffect } from 'react';
import { Target, Plus, CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/ui/Progress';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchGoals } from '../../services/mockApi';

export function GoalsPage() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);
  const [newGoalModal, setNewGoalModal] = useState(false);

  // New Goal State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('Career');
  const [goalTargetDate, setGoalTargetDate] = useState('2026-12-31');
  const [goalDesc, setGoalDesc] = useState('');

  useEffect(() => {
    async function loadGoalData() {
      try {
        const data = await fetchGoals();
        setGoals(data);
      } catch (err) {
        console.error('Error loading goals:', err);
      } finally {
        setLoading(false);
      }
    }
    loadGoalData();
  }, []);

  const handleToggleMilestone = (goalId, milestoneId) => {
    setGoals((prevGoals) =>
      prevGoals.map((g) => {
        if (g.id !== goalId) return g;
        const updatedMilestones = g.milestones.map((m) => {
          if (m.id !== milestoneId) return m;
          return {
            ...m,
            status: m.status === 'completed' ? 'in_progress' : 'completed'
          };
        });
        const compCount = updatedMilestones.filter((m) => m.status === 'completed').length;
        const newProgress = Math.round((compCount / updatedMilestones.length) * 100);

        return {
          ...g,
          milestones: updatedMilestones,
          progress: newProgress
        };
      })
    );
  };

  const handleCreateGoal = (e) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    const newG = {
      id: `goal-${Date.now()}`,
      title: goalTitle,
      category: goalCategory,
      targetDate: goalTargetDate,
      progress: 0,
      status: 'In Progress',
      description: goalDesc,
      milestones: [
        { id: `m-${Date.now()}-1`, title: 'Define core learning curriculum', status: 'completed' },
        { id: `m-${Date.now()}-2`, title: 'Build capstone portfolio project', status: 'in_progress' },
        { id: `m-${Date.now()}-3`, title: 'Verify skills with peer code review', status: 'pending' }
      ]
    };

    setGoals([newG, ...goals]);
    setGoalTitle('');
    setGoalDesc('');
    setNewGoalModal(false);
  };

  if (loading) {
    return <LoadingState text="Loading career goals and roadmaps..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Career Goals & Roadmaps"
        subtitle="Set macro career objectives, break down skill milestones, and track long-term progress."
        action={
          <Button icon={Plus} onClick={() => setNewGoalModal(true)}>
            New Goal
          </Button>
        }
      />

      {/* Main Active Goals */}
      <div className="space-y-6">
        {goals.map((goal) => (
          <Card key={goal.id} padding="lg" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="primary">{goal.category}</Badge>
                  <Badge variant="success">{goal.status}</Badge>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-heading">
                  {goal.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{goal.description}</p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400 block">Target Completion</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {goal.targetDate}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <Progress value={goal.progress} showLabel color="indigo" size="md" />

            {/* Milestones Checklist */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Roadmap Milestones ({goal.milestones.filter((m) => m.status === 'completed').length} / {goal.milestones.length})
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {goal.milestones.map((m) => {
                  const isDone = m.status === 'completed';
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleToggleMilestone(goal.id, m.id)}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer select-none ${
                        isDone
                          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : m.status === 'in_progress' ? (
                        <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs sm:text-sm font-medium ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {m.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* New Goal Modal */}
      <Modal
        isOpen={newGoalModal}
        onClose={() => setNewGoalModal(false)}
        title="Create New Career Goal"
        subtitle="Define a target objective and milestone roadmap."
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <Input
            label="Goal Title"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="e.g. Master Open Source Contributions on GitHub"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              options={['Career', 'Learning', 'Project', 'DSA', 'Internship', 'Hackathon']}
              value={goalCategory}
              onChange={(e) => setGoalCategory(e.target.value)}
            />
            <Input
              label="Target Completion Date"
              type="date"
              value={goalTargetDate}
              onChange={(e) => setGoalTargetDate(e.target.value)}
            />
          </div>

          <Textarea
            label="Goal Description"
            value={goalDesc}
            onChange={(e) => setGoalDesc(e.target.value)}
            placeholder="Describe the milestone steps and intended outcomes..."
          />

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setNewGoalModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Goal Roadmap</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
