import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Compass,
  Code,
  GraduationCap,
  Briefcase,
  Bookmark,
  ArrowRight,
  RefreshCw,
  FolderGit2,
  Github,
  Target,
  ShieldCheck,
  Layers,
  Activity,
  Check,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { CareerCoachCard } from './CareerCoachCard';

/**
 * Maps backend readiness band to visual styles and badges.
 */
const BAND_CONFIG = {
  'Target Ready': {
    badgeVariant: 'success',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    icon: CheckCircle2,
  },
  Advancing: {
    badgeVariant: 'primary',
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
    icon: TrendingUp,
  },
  Developing: {
    badgeVariant: 'warning',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
    icon: AlertCircle,
  },
  'Early Stage': {
    badgeVariant: 'default',
    colorClass: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800',
    icon: Sparkles,
  },
};

/**
 * Maps backend gap priority codes to badges.
 */
const GAP_PRIORITY_BADGES = {
  P0: { variant: 'danger', label: 'P0 · Critical' },
  P1: { variant: 'warning', label: 'P1 · High' },
  P2: { variant: 'primary', label: 'P2 · Moderate' },
  P3: { variant: 'default', label: 'P3 · Secondary' },
};

/**
 * Resolves the destination route and label for a readiness action.
 * Uses existing CareerOS routes.
 */
function getActionRouteInfo(action) {
  const type = action?.type || '';

  switch (type) {
    case 'skill_gap':
      return { to: '/learning', ctaText: 'Learn in Catalog' };
    case 'strengthen_evidence':
      return { to: '/profile', ctaText: 'Add Project Proof' };
    case 'github_refresh':
      return { to: '/profile', ctaText: 'Sync GitHub Proof' };
    case 'prep_execution':
      return { to: '/todos', ctaText: 'Open Prep Tasks' };
    case 'application_followup':
      return { to: '/applications', ctaText: 'View Applications' };
    case 'submit_application':
      return { to: '/opportunities', ctaText: 'Explore Roles' };
    case 'explore_opportunities':
      return { to: '/opportunities', ctaText: 'Explore Roles' };
    default:
      return { to: '/dashboard', ctaText: 'View Details' };
  }
}

/**
 * CareerReadinessCard
 * 
 * Primary Dashboard Career Intelligence surface.
 * Displays the 5-dimensional Career Readiness Mission Control strictly from
 * backend-calculated intelligence data.
 * 
 * @param {Object} props
 * @param {Object} props.readiness - Backend readiness snapshot
 * @param {boolean} props.loading - Loading state
 * @param {string} [props.error] - Error message
 * @param {Function} [props.onRetry] - Retry callback
 * @param {boolean} [props.showCareerCoach=true] - Whether to render embedded Career Coach
 */
export function CareerReadinessCard({
  readiness,
  loading,
  error,
  onRetry,
  showCareerCoach = true,
}) {
  // ─── Loading State ────────────────────────────────────────────────
  if (loading) {
    return (
      <Card
        padding="lg"
        className="space-y-6 border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 shadow-xs"
      >
        <div className="flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/60" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-slate-850 rounded" />
            </div>
          </div>
          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-850/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────
  if (error) {
    return (
      <Card
        padding="lg"
        className="border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/20 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Career readiness is temporarily unavailable.
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                We couldn&apos;t load your personalized readiness intelligence.
              </p>
            </div>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" icon={RefreshCw} onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // ─── Unready State ────────────────────────────────────────────────
  if (!readiness) {
    return null;
  }

  const {
    readinessBand,
    targetProfile = {},
    dimensions = {},
    skillGaps = [],
    actions = [],
    sourceOpportunities = [],
  } = readiness;

  const bandName = readinessBand?.band || 'Early Stage';
  const bandCfg = BAND_CONFIG[bandName] || BAND_CONFIG['Early Stage'];
  const BandIcon = bandCfg.icon;

  const cohortSources = targetProfile.cohortSources || {
    savedCount: 0,
    appliedCount: 0,
    fallbackCount: 0,
    totalCount: 0,
  };

  const hasGuidance = Boolean(targetProfile.guidance);
  const isFallbackCohort = cohortSources.fallbackCount > 0 && cohortSources.savedCount === 0 && cohortSources.appliedCount === 0;

  return (
    <Card
      padding="lg"
      className="space-y-6 border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 shadow-xs"
    >
      {/* ─── 1. Header: Mission Control & Readiness Band ─────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-indigo-100/60 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <Target className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Career Profile Intelligence
              </span>
              <Badge variant={bandCfg.badgeVariant} size="sm">
                <BandIcon className="w-3 h-3 mr-1" />
                {readinessBand?.label || bandName}
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-heading">
              Career Readiness Mission Control
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {readinessBand?.summary || 'Deterministic evaluation of your preparedness across your target opportunities.'}
            </p>

            {/* Primary Drivers */}
            {Array.isArray(readinessBand?.primaryDrivers) && readinessBand.primaryDrivers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1.5">
                {readinessBand.primaryDrivers.map((driver, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                  >
                    <Check className="w-3 h-3 text-indigo-500 shrink-0" />
                    {driver}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Target Profile Cohort Indicator */}
        <div className="text-left sm:text-right shrink-0 bg-white/60 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-750">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Target Cohort
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {targetProfile.totalOpportunities || 0} Target Roles
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
            {cohortSources.savedCount} saved · {cohortSources.appliedCount} applied
            {cohortSources.fallbackCount > 0 && ` · ${cohortSources.fallbackCount} preference matches`}
          </span>
        </div>
      </div>

      {/* ─── 2. Cold-Start / Fallback Guidance Banner ────────────────── */}
      {hasGuidance && (
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Compass className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                {isFallbackCohort ? 'Estimated from Career Preferences' : 'Personalize Your Career Readiness'}
              </h4>
              <p>
                {targetProfile.guidance}
              </p>
              {isFallbackCohort && (
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
                  Target requirements are currently estimated from published postings matching your preferences.
                </p>
              )}
            </div>
          </div>
          <Link to="/opportunities" className="shrink-0 self-end sm:self-auto">
            <Button size="sm" variant="outline" className="border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50">
              Explore Opportunities
            </Button>
          </Link>
        </div>
      )}

      {/* ─── 3. The Five Dimensions Model ────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            5-Dimension Readiness Breakdown
          </h3>
          <span className="text-[11px] text-slate-400">Deterministic signals</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Dimension 1: Skill Coverage */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Skill Coverage</span>
              <Badge variant="primary" size="sm">
                {dimensions.skillCoverage?.percentage ?? 0}%
              </Badge>
            </div>
            <Progress value={dimensions.skillCoverage?.percentage ?? 0} color="blue" size="sm" />
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {dimensions.skillCoverage?.coveredCount ?? 0}
              </span>
              {' / '}
              {dimensions.skillCoverage?.totalCount ?? 0} core skills covered
            </div>
          </div>

          {/* Dimension 2: Evidence Strength */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Evidence Strength</span>
              <Badge variant="success" size="sm">
                {dimensions.evidenceStrength?.verificationRate ?? 0}%
              </Badge>
            </div>
            <Progress value={dimensions.evidenceStrength?.verificationRate ?? 0} color="emerald" size="sm" />
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {dimensions.evidenceStrength?.verifiedCount ?? 0}
              </span> verified · {dimensions.evidenceStrength?.demonstratedCount ?? 0} project
            </div>
          </div>

          {/* Dimension 3: Preparation Execution */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Preparation Tasks</span>
              <Badge variant="warning" size="sm">
                {dimensions.preparationExecution?.percentage ?? 0}%
              </Badge>
            </div>
            <Progress value={dimensions.preparationExecution?.percentage ?? 0} color="amber" size="sm" />
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {dimensions.preparationExecution?.completed ?? 0}
              </span>
              {' / '}
              {dimensions.preparationExecution?.total ?? 0} tasks done
            </div>
          </div>

          {/* Dimension 4: Learning Velocity */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Learning Velocity</span>
              <Badge variant={dimensions.learningVelocity?.status === 'active' ? 'success' : 'default'} size="sm">
                {dimensions.learningVelocity?.status || 'none'}
              </Badge>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${dimensions.learningVelocity?.recentProgress ? 'bg-indigo-500' : 'bg-slate-400'} rounded-full`}
                style={{ width: dimensions.learningVelocity?.relevantActiveItems > 0 ? '75%' : '20%' }}
              />
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {dimensions.learningVelocity?.relevantActiveItems ?? 0}
              </span> active · {dimensions.learningVelocity?.relevantCompletedItems ?? 0} finished
            </div>
          </div>

          {/* Dimension 5: Application Pipeline */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Application Pipeline</span>
              <Badge variant="primary" size="sm">
                {dimensions.applicationPipeline?.status || 'dormant'}
              </Badge>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${Math.min(100, (dimensions.applicationPipeline?.activeApplications || 0) * 25)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {dimensions.applicationPipeline?.activeApplications ?? 0}
              </span> active applications
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. Top Skill Gaps & Recommended Actions ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Left Sub-card: Top Skill Gaps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Code className="w-4 h-4 text-red-500" />
              High-Impact Skill Gaps
            </h3>
            <span className="text-[11px] text-slate-400">
              Ranked by target frequency
            </span>
          </div>

          {skillGaps.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No high-impact skill gaps identified!
              </p>
              <p className="text-[11px] text-slate-400">
                Your profile covers all core technical skills demanded by your current target cohort.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {skillGaps.map((gap) => {
                const pBadge = GAP_PRIORITY_BADGES[gap.priority] || GAP_PRIORITY_BADGES.P3;
                return (
                  <div
                    key={gap.canonicalKey}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-center justify-between gap-3 hover:border-indigo-400/50 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {gap.displayName}
                        </span>
                        <Badge variant={pBadge.variant} size="sm">
                          {pBadge.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Required by {gap.requiredByOpportunityCount} of {targetProfile.totalOpportunities} target roles ({gap.impactPercent}%)
                      </p>
                    </div>

                    <Link to="/learning" className="shrink-0">
                      <Button size="sm" variant="ghost" className="text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40">
                        Learn
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sub-card: Recommended Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Recommended Readiness Actions
            </h3>
            <span className="text-[11px] text-slate-400">Next high-leverage steps</span>
          </div>

          {actions.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
              <Check className="w-6 h-6 text-indigo-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                All recommended actions are up to date.
              </p>
              <p className="text-[11px] text-slate-400">
                Continue executing active applications and maintaining your proof of work.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map((act) => {
                const routeInfo = getActionRouteInfo(act);
                const priorityVariant = act.priority === 'High' ? 'danger' : act.priority === 'Medium' ? 'warning' : 'default';

                return (
                  <div
                    key={act.actionKey}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-400/50 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {act.title}
                        </span>
                        <Badge variant={priorityVariant} size="sm">
                          {act.priority}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                        {act.description}
                      </p>
                    </div>

                    <Link to={routeInfo.to} className="shrink-0 self-end sm:self-center">
                      <Button size="sm" variant="outline" className="text-xs py-1 px-2.5">
                        {routeInfo.ctaText}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── 4.5. AI Career Coach Guidance ─────────────────────────── */}
      {showCareerCoach && (
        <div className="pt-2">
          <CareerCoachCard
            contextType="readiness"
            defaultPrompt="What is my biggest career bottleneck right now?"
            compact
          />
        </div>
      )}

      {/* ─── 5. Target Cohort Source Transparency ──────────────────── */}
      <div className="pt-3 border-t border-indigo-100/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Targeting:</span>
          {targetProfile.targetRoles?.length > 0 ? (
            targetProfile.targetRoles.map((role, idx) => (
              <span key={idx} className="font-medium text-indigo-600 dark:text-indigo-400">
                {role}
              </span>
            ))
          ) : (
            <span>General Roles ({targetProfile.totalOpportunities} opportunities analyzed)</span>
          )}
          {sourceOpportunities.length > 0 && (
            <span className="text-slate-400 text-[11px]">
              • Top target: {sourceOpportunities[0].title} ({sourceOpportunities[0].organization})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/saved"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Manage Target Roles
          </Link>
        </div>
      </div>
    </Card>
  );
}
