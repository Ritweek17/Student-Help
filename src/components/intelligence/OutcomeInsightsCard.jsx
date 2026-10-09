import React from 'react';
import {
  PieChart,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Clock,
  Briefcase,
  Globe,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

/**
 * Maps prep status to badge styling and readable label.
 */
const PREP_STATUS_MAP = {
  prep_completed_before_apply: {
    label: 'Prep Completed Before Apply',
    variant: 'success',
  },
  prep_pending_at_apply: {
    label: 'Prep Pending at Apply',
    variant: 'warning',
  },
  no_prep_record: {
    label: 'No Tracked Prep',
    variant: 'default',
  },
};

/**
 * OutcomeInsightsCard
 * 
 * Renders neutral application outcome counts, demonstrated skills in selected roles,
 * preparation-to-application observations, and role/work-mode pattern distributions.
 */
export function OutcomeInsightsCard({ outcomes, loading = false }) {
  if (loading) {
    return (
      <Card padding="md" className="animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </Card>
    );
  }

  if (!outcomes) return null;

  const outcomeCounts = outcomes.outcomes || {};
  const prepObservations = Array.isArray(outcomes.preparationOutcomeObservations)
    ? outcomes.preparationOutcomeObservations
    : [];
  const rolePatterns = Array.isArray(outcomes.rolePatterns) ? outcomes.rolePatterns : [];
  const selectedSkills = Array.isArray(outcomeCounts.selectedSkillsDemonstrated)
    ? outcomeCounts.selectedSkillsDemonstrated
    : [];

  const countItems = [
    { label: 'Selected', count: outcomeCounts.selected ?? 0, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
    { label: 'Interview', count: outcomeCounts.interview ?? 0, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
    { label: 'Active', count: outcomeCounts.active ?? 0, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
    { label: 'Rejected', count: outcomeCounts.rejected ?? 0, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' },
    { label: 'Withdrawn', count: outcomeCounts.withdrawn ?? 0, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800' },
  ];

  return (
    <Card padding="md" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Outcome Summary
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Application Outcomes & Patterns
            </h3>
          </div>
        </div>
      </div>

      {/* Outcome Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        {countItems.map((item) => (
          <div
            key={item.label}
            className={`p-2.5 rounded-xl border ${item.bg}`}
          >
            <span className={`text-xl font-bold font-heading block ${item.color}`}>
              {item.count}
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Skills Demonstrated in Selected Roles */}
      {selectedSkills.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
            Demonstrated Skills in Selected Roles
          </span>
          <div className="flex flex-wrap gap-1.5">
            {selectedSkills.map((s) => (
              <Badge key={s.canonicalKey} variant="success" size="xs">
                {s.displayName || s.canonicalKey} ({s.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Role / Work Mode Breakdown List */}
      {rolePatterns.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
            Role & Work-Mode Distribution
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rolePatterns.map((rp) => (
              <div
                key={rp.groupKey}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs flex flex-col justify-between space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    {rp.dimension === 'workMode' ? (
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    {rp.groupLabel}
                  </span>
                  <Badge variant="default" size="xs">
                    {rp.applications} app{rp.applications === 1 ? '' : 's'}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span>{rp.interviews} interview{rp.interviews === 1 ? '' : 's'}</span>
                  <span>•</span>
                  <span>{rp.selected} selected</span>
                  <span>•</span>
                  <span>{rp.rejected} rejected</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preparation Outcome Correlation Signals */}
      {prepObservations.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Preparation Timing Observations
            </span>
            <span className="text-[10px] text-slate-400">
              Non-causal correlation
            </span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
            {prepObservations.slice(0, 5).map((prep) => {
              const statusInfo = PREP_STATUS_MAP[prep.prepStatus] || PREP_STATUS_MAP.no_prep_record;

              return (
                <div
                  key={prep.applicationId}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {prep.title} · {prep.organization}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {prep.summary}
                    </span>
                  </div>
                  <Badge variant={statusInfo.variant} size="xs" className="shrink-0">
                    {statusInfo.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
