import React from 'react';
import { Filter, Info, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';

/**
 * ApplicationFunnelCard
 * 
 * Renders the 4-stage application conversion funnel strictly from backend metrics.
 * Adheres strictly to the sample-size protection contract:
 * Never calculates percentage or divides numerator by denominator on the client.
 */
export function ApplicationFunnelCard({ funnel, loading = false, error = null }) {
  if (loading) {
    return (
      <Card padding="md" className="animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </Card>
    );
  }

  if (error || !funnel) return null;

  const stages = [
    {
      key: 'savedToApplied',
      label: 'Saved → Applied',
      data: funnel.savedToApplied,
      description: 'Saved opportunities converted to applications',
    },
    {
      key: 'appliedToInterview',
      label: 'Applied → Interview',
      data: funnel.appliedToInterview,
      description: 'Submitted applications progressing to interview',
    },
    {
      key: 'interviewToSelected',
      label: 'Interview → Selection',
      data: funnel.interviewToSelected,
      description: 'Interviews advancing to offers or selection',
    },
    {
      key: 'overallSelected',
      label: 'Overall Selection',
      data: funnel.overallSelected,
      description: 'Total tracked applications selected',
    },
  ];

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Conversion Funnel
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Pipeline Conversion Metrics
            </h3>
          </div>
        </div>
        <Badge variant="default" size="xs">
          Sample Threshold: 5+ Apps
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stages.map((stage) => {
          const item = stage.data || {
            numerator: 0,
            denominator: 0,
            percentage: null,
            status: 'insufficient_sample',
          };
          const isAvailable = item.status === 'available' && typeof item.percentage === 'number';

          return (
            <div
              key={stage.key}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-2.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {stage.label}
                  </span>
                  {isAvailable ? (
                    <Badge variant="success" size="xs">
                      {item.percentage}%
                    </Badge>
                  ) : (
                    <Badge variant="default" size="xs">
                      Small Sample
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  {stage.description}
                </p>
              </div>

              <div className="space-y-1.5">
                {isAvailable ? (
                  <>
                    <Progress value={item.percentage} max={100} size="sm" variant="primary" />
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                      <span>{item.numerator} succeeded</span>
                      <span className="text-slate-400">{item.denominator} total</span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {item.numerator} of {item.denominator} tracked
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      {item.message || 'Conversion percentages unlock after tracking 5 applications in this stage.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
