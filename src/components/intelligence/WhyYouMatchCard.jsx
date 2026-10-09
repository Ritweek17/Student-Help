import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  Github,
  ExternalLink,
  Loader2,
  Info
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function WhyYouMatchCard({ match, loading, error, onRetry }) {
  if (loading) {
    return (
      <Card padding="lg" className="border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 dark:from-indigo-950/20 dark:via-slate-900 dark:to-purple-950/10">
        <div className="flex items-center gap-3 text-slate-500 py-4 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium">Analyzing personalized match against your profile...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return null; // Fail open: do not disrupt opportunity page if intelligence match fails
  }

  if (!match) {
    return null;
  }

  const { score, fitLevel, summary, matchedSkills = [], skillGaps = [], evidence = [], explanations } = match;

  // Fit Level Badge Variant
  let badgeVariant = 'primary';
  let scoreColorClass = 'text-indigo-600 dark:text-indigo-400';
  let progressBgClass = 'bg-indigo-600';

  if (score >= 85) {
    badgeVariant = 'success';
    scoreColorClass = 'text-emerald-600 dark:text-emerald-400';
    progressBgClass = 'bg-emerald-500';
  } else if (score >= 70) {
    badgeVariant = 'primary';
    scoreColorClass = 'text-indigo-600 dark:text-indigo-400';
    progressBgClass = 'bg-indigo-600';
  } else if (score >= 50) {
    badgeVariant = 'warning';
    scoreColorClass = 'text-amber-600 dark:text-amber-400';
    progressBgClass = 'bg-amber-500';
  } else {
    badgeVariant = 'neutral';
    scoreColorClass = 'text-slate-600 dark:text-slate-400';
    progressBgClass = 'bg-slate-400';
  }

  return (
    <Card
      padding="lg"
      className="space-y-5 border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 shadow-xs"
    >
      {/* Header with Title & Fit Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100/60 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
              Why You Match
              <Badge variant={badgeVariant}>{fitLevel}</Badge>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalized candidate fit based on your profile skills, projects, and preferences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Fit Score</span>
            <span className={`text-2xl font-black font-heading ${scoreColorClass}`}>
              {score}<span className="text-sm font-semibold text-slate-400">/100</span>
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBgClass}`}
            style={{ width: `${score}%` }}
          />
        </div>
        {summary && (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
            {summary}
          </p>
        )}
      </div>

      {/* Matched Skills & Skill Gaps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Matched Skills */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Matched Skills ({matchedSkills.length})
            </span>
          </div>

          {matchedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {matchedSkills.map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-semibold"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{skill.displayName}</span>
                  {skill.hasGitHubEvidence && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-medium tracking-tight ml-0.5"
                      title="Verified in public GitHub repositories"
                    >
                      <Github className="w-2.5 h-2.5 shrink-0" />
                      GitHub Verified
                    </span>
                  )}
                  {skill.proficiency && (
                    <span className="text-[10px] opacity-75 font-normal">({skill.proficiency})</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No matching skills detected on your profile yet.</p>
          )}
        </div>

        {/* Skill Gaps */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Skill Gaps ({skillGaps.length})
            </span>
          </div>

          {skillGaps.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {skillGaps.map((gap, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 text-xs font-semibold"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  {gap.displayName}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No skill gaps! You match all identified technical requirements.</p>
          )}
        </div>
      </div>

      {/* Demonstrated Project & GitHub Evidence */}
      {evidence.length > 0 && (
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <FolderGit2 className="w-4 h-4 text-indigo-500" />
            Demonstrated Evidence ({evidence.length})
          </span>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {evidence.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                {item.type === 'github_verified' ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shrink-0 mt-0.5">
                    <Github className="w-2.5 h-2.5 shrink-0" />
                    GitHub Verified
                  </span>
                ) : (
                  <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
                )}
                <span className="flex-1">
                  <strong className="text-slate-900 dark:text-slate-100">{item.skill}:</strong>{' '}
                  <span>{item.description}</span>
                  {item.repository?.url && (
                    <a
                      href={item.repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 ml-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      aria-label={`View repository ${item.repository.name} on GitHub (opens in new tab)`}
                    >
                      <span>{item.repository.name}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Explanations List */}
      {explanations?.positive?.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Match Signals</span>
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {explanations.positive.map((signal, idx) => (
              <p key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{signal}</span>
              </p>
            ))}
            {explanations.gaps?.map((gapSignal, idx) => (
              <p key={idx} className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{gapSignal}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
