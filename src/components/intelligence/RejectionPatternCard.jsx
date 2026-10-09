import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, HelpCircle, ArrowRight, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * RejectionPatternCard
 * 
 * Renders recurring missing/unverified skills observed across rejected opportunities.
 * Strictly adheres to observational, non-causal language safeguards.
 */
export function RejectionPatternCard({ rejectionPatterns, loading = false }) {
  if (loading) {
    return (
      <Card padding="md" className="animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </Card>
    );
  }

  if (!rejectionPatterns) return null;

  const status = rejectionPatterns.status || 'insufficient_sample';
  const patterns = Array.isArray(rejectionPatterns.patterns) ? rejectionPatterns.patterns : [];
  const totalAnalyzed = rejectionPatterns.totalRejectedOpportunitiesAnalyzed || 0;

  return (
    <Card padding="md" className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Outcome Intelligence
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Recurring Skill Observations
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Observed patterns, not confirmed employer rejection reasons</span>
        </div>
      </div>

      {/* Insufficient Sample State */}
      {status === 'insufficient_sample' && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center space-y-1">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {rejectionPatterns.message ||
              'Rejection pattern analysis requires at least 3 rejected applications to identify recurring gaps.'}
          </p>
          <span className="text-[11px] text-slate-400 block">
            Currently analyzed: {totalAnalyzed} rejected application{totalAnalyzed === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Available but Zero Patterns */}
      {status === 'available' && patterns.length === 0 && (
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-center space-y-1">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            No recurring skill gaps detected across your {totalAnalyzed} analyzed rejections.
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">
            Your demonstrated skills align well with the target requirements for these roles.
          </span>
        </div>
      )}

      {/* Patterns List */}
      {status === 'available' && patterns.length > 0 && (
        <div className="space-y-2.5">
          {patterns.map((pattern) => {
            const isClaimedOnly = pattern.candidateEvidence === 'claimed_only';

            return (
              <div
                key={pattern.canonicalKey}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {pattern.displayName || pattern.canonicalKey}
                    </span>
                    <Badge variant={isClaimedOnly ? 'warning' : 'danger'} size="xs">
                      {isClaimedOnly ? 'Claimed Only · Demonstration Needed' : 'Unverified on Profile'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {pattern.rejectedOpportunityCount} of {pattern.totalRejectedOpportunitiesAnalyzed} roles
                    </span>
                    {typeof pattern.recurrencePercent === 'number' && (
                      <Badge variant="primary" size="xs">
                        {pattern.recurrencePercent}% Recurrence
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Non-Causal Observation Text */}
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  {pattern.observation}
                </p>

                {/* Growth CTA */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Recommended action: Add project evidence or explore curriculum
                  </span>
                  <div className="flex items-center gap-2">
                    <Link to="/profile">
                      <Button size="xs" variant="ghost" icon={ArrowRight}>
                        Add Evidence
                      </Button>
                    </Link>
                    <Link to="/learning">
                      <Button size="xs" variant="ghost" icon={BookOpen}>
                        Catalog
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
