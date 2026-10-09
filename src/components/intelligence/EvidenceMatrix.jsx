import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Github,
  FolderGit2,
  GraduationCap,
  User,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

/**
 * EvidenceMatrix Component
 * 
 * Renders the deterministic Evidence Strength Matrix in the Profile Skills & Stack area.
 * For each relevant skill, displays the strongest proof tier:
 * - GitHub Verified
 * - Project Demonstrated
 * - Curriculum Practicing
 * - Self-Claimed
 * 
 * @param {Object} props
 * @param {Array<Object>} props.evidence - Server-provided evidence array from readiness payload
 */
export function EvidenceMatrix({ evidence = [] }) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return null;
  }

  return (
    <Card padding="lg" className="space-y-4 border-slate-200 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading">
              Evidence Strength Matrix ({evidence.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Strongest verified proof for your target and claimed skills
            </p>
          </div>
        </div>
        <Badge variant="primary" size="sm">Evidence Hierarchy</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {evidence.map((item, idx) => {
          const strength = item.evidenceStrength || 'claimed';
          let badgeVariant = 'default';
          let badgeLabel = 'Self-Claimed';
          let TierIcon = User;
          let colorClass = 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40';

          if (strength === 'verified') {
            badgeVariant = 'success';
            badgeLabel = 'GitHub Verified';
            TierIcon = Github;
            colorClass = 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20';
          } else if (strength === 'demonstrated') {
            badgeVariant = 'primary';
            badgeLabel = 'Project Demonstrated';
            TierIcon = FolderGit2;
            colorClass = 'border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20';
          } else if (strength === 'practicing') {
            badgeVariant = 'warning';
            badgeLabel = 'Curriculum Practicing';
            TierIcon = GraduationCap;
            colorClass = 'border-amber-200 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/20';
          }

          return (
            <div
              key={item.canonicalKey || idx}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${colorClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate block">
                    {item.displayName || item.canonicalKey}
                  </span>
                  <span className="text-[11px] text-slate-400 capitalize">
                    {item.category || 'skill'}
                  </span>
                </div>
                <Badge variant={badgeVariant} size="sm">
                  <TierIcon className="w-3 h-3 mr-1 shrink-0" />
                  {badgeLabel}
                </Badge>
              </div>

              {/* Source details breakdown */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] space-y-1">
                {item.topProof && (
                  <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-500">Proof:</span>
                    {item.topProof.type === 'github' && (
                      <span className="truncate">Repo: {item.topProof.name}</span>
                    )}
                    {item.topProof.type === 'project' && (
                      <span className="truncate">Project: {item.topProof.title}</span>
                    )}
                    {item.topProof.type === 'curriculum' && (
                      <span>Enrolled Learning Track</span>
                    )}
                    {item.topProof.type === 'profile_claim' && (
                      <span>Listed with {item.topProof.proficiency} proficiency</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className={item.sources?.claimed ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-400 line-through'}>
                    Claimed
                  </span>
                  <span>•</span>
                  <span className={item.sources?.portfolioProject ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-400 line-through'}>
                    Project
                  </span>
                  <span>•</span>
                  <span className={item.sources?.githubVerified ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 line-through'}>
                    GitHub
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
