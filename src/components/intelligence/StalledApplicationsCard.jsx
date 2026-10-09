import React from 'react';
import { Clock, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * StalledApplicationsCard
 * 
 * Displays applications identified by the backend as stalled (>14 days without update or deadline passed).
 * Direct traceability to organization, title, ageDays, and reason.
 */
export function StalledApplicationsCard({
  stalledApplications = [],
  actions = [],
  onFollowUp,
  loading = false,
}) {
  if (loading) {
    return (
      <Card padding="md" className="animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </Card>
    );
  }

  const actionMap = new Map();
  for (const act of actions) {
    if (act.applicationId) {
      actionMap.set(act.applicationId, act);
    }
  }

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Attention Required
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Stalled Applications
            </h3>
          </div>
        </div>

        {stalledApplications.length > 0 && (
          <Badge variant="danger" size="xs">
            {stalledApplications.length} Stalled
          </Badge>
        )}
      </div>

      {stalledApplications.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold">Pipeline Active</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            No stalled applications. All active applications have had updates within the last 14 days.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {stalledApplications.map((app) => {
            const action = actionMap.get(app.applicationId);

            return (
              <div
                key={app.applicationId}
                className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {app.title} · {app.organization}
                    </span>
                    <Badge variant="danger" size="xs">
                      {app.ageDays}d Stalled
                    </Badge>
                  </div>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    {app.reason}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onFollowUp && onFollowUp(action || { applicationId: app.applicationId, title: `Follow up with ${app.organization}` })}
                    icon={ArrowRight}
                  >
                    Follow Up
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
