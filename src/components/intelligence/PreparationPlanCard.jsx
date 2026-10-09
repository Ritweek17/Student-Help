import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ListChecks,
  CheckCircle2,
  Clock,
  ExternalLink,
  BookOpen,
  Calendar,
  Sparkles,
  Loader2,
  AlertCircle,
  PlusCircle,
  Layers,
  Github,
  FolderGit2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import * as opportunityApi from '../../services/opportunityApi';

export function PreparationPlanCard({ opportunityId, token }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  const loadPlan = async (abortSignal) => {
    if (!token || !opportunityId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await opportunityApi.getOpportunityPreparationPlan(
        opportunityId,
        token,
        abortSignal
      );
      setPlan(response.plan);
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Fail open: don't disrupt view if plan preview fails
      setError(err.message || 'Unable to load preparation plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadPlan(controller.signal);
    return () => controller.abort();
  }, [opportunityId, token]);

  const handleGeneratePlan = async () => {
    if (!token || !opportunityId || generating) return;
    setGenerating(true);
    setActionMessage('');
    try {
      const response = await opportunityApi.generateOpportunityPreparationPlan(
        opportunityId,
        { createCalendarEvent: true },
        token
      );
      setPlan(response.plan);
      if (response.createdCount > 0) {
        setActionMessage(`Added ${response.createdCount} new action item${response.createdCount > 1 ? 's' : ''} to your Todos!`);
      } else {
        setActionMessage('All preparation tasks are already up-to-date in your Todos.');
      }
    } catch (err) {
      setActionMessage(err.message || 'Failed to generate preparation plan.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card padding="lg" className="border-indigo-100 dark:border-indigo-900/40">
        <div className="flex items-center gap-3 text-slate-500 py-3 justify-center text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span>Generating actionable preparation plan...</span>
        </div>
      </Card>
    );
  }

  if (error || !plan) {
    return null; // Fail open
  }

  const { tasks = [], stats = {}, urgency, summary } = plan;

  return (
    <Card
      padding="lg"
      className="space-y-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Opportunity Action Plan
              </h3>
              {urgency?.urgency === 'urgent' && (
                <Badge variant="warning">{urgency.label}</Badge>
              )}
              {urgency?.urgency === 'moderate' && (
                <Badge variant="neutral">{urgency.label}</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {summary}
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="shrink-0 flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGeneratePlan}
            disabled={generating}
            icon={generating ? Loader2 : stats.createdTasks === stats.totalTasks ? CheckCircle2 : PlusCircle}
            variant={stats.createdTasks === stats.totalTasks ? 'outline' : 'primary'}
          >
            {generating
              ? 'Saving to Todos...'
              : stats.createdTasks === stats.totalTasks
              ? 'Synced to Todos'
              : 'Add to My Todos'}
          </Button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <Link to="/todos" className="font-semibold underline ml-2">
            View in Todos →
          </Link>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Recommended Next Steps ({tasks.length})
        </span>

        <div className="space-y-2">
          {tasks.map((task, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-3 ${
                task.isCompleted
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 opacity-80'
                  : task.isExistingTodo
                  ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {task.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : task.isExistingTodo ? (
                    <Clock className="w-4 h-4 text-indigo-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {task.title}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {task.category}
                    </Badge>
                    {task.type === 'github_showcase' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                        <Github className="w-2.5 h-2.5" />
                        GitHub Showcase
                      </span>
                    )}
                    {task.type === 'github_refresh' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        <Github className="w-2.5 h-2.5" />
                        GitHub Refresh
                      </span>
                    )}
                    {task.priority === 'High' && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                        High Priority
                      </span>
                    )}
                  </div>

                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                    {task.description.replace(/\[CareerOS Prep:.*?\]/, '').trim()}
                  </p>

                  {/* GitHub Repository Reference Link */}
                  {task.repository?.url && (
                    <div className="pt-1 flex items-center gap-2">
                      <a
                        href={task.repository.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                        aria-label={`View repository ${task.repository.name} on GitHub (opens in new tab)`}
                      >
                        <FolderGit2 className="w-3 h-3 text-slate-400" />
                        <span>Repository: {task.repository.name}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}

                  {/* Real Learning Resource Link */}
                  {task.learningLink && (
                    <div className="pt-1 flex items-center gap-2">
                      <Link
                        to="/learning"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <BookOpen className="w-3 h-3" />
                        Explore Track: {task.learningLink.trackTitle}
                      </Link>
                      {task.learningLink.resourceUrl && (
                        <a
                          href={task.learningLink.resourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> Source
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="shrink-0 text-right">
                {task.isCompleted ? (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Done
                  </span>
                ) : task.isExistingTodo ? (
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    In Todos
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Proposed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
