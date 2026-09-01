import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin, Calendar, Sparkles, Building2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

function formatTypeLabel(typeStr) {
  if (!typeStr) return 'Opportunity';
  return typeStr
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatLocation(loc, workMode) {
  let locStr = '';
  if (typeof loc === 'string') {
    locStr = loc;
  } else if (loc && typeof loc === 'object') {
    locStr = [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
  }

  if (!locStr && workMode === 'remote') {
    locStr = 'Remote';
  } else if (!locStr) {
    locStr = 'Location specified';
  }

  if (workMode && !locStr.toLowerCase().includes(workMode.toLowerCase())) {
    locStr = `${locStr} (${workMode.charAt(0).toUpperCase() + workMode.slice(1)})`;
  }

  return locStr;
}

function formatStipend(stipend, prize) {
  if (typeof stipend === 'string') return stipend;
  if (stipend && typeof stipend === 'object' && stipend.amount) {
    const curr = stipend.currency || 'INR';
    const per = stipend.period ? ` / ${stipend.period}` : '';
    return `${curr} ${stipend.amount.toLocaleString()}${per}`;
  }

  if (typeof prize === 'string') return prize;
  if (prize && typeof prize === 'object' && prize.amount) {
    const curr = prize.currency || 'INR';
    return `Prize: ${curr} ${prize.amount.toLocaleString()}`;
  }

  return 'Unpaid / Free';
}

function formatDeadline(deadline) {
  if (!deadline) return null;
  if (typeof deadline === 'string' && !deadline.includes('-') && !deadline.includes('T')) {
    return deadline;
  }
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return String(deadline);
    return `Deadline: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return String(deadline);
  }
}

export function OpportunityCard({
  opportunity,
  onToggleSave,
  isSavedState
}) {
  const oppId = opportunity._id || opportunity.id;
  const isSaved = isSavedState !== undefined ? isSavedState : Boolean(opportunity.isSaved);

  const typeLabel = formatTypeLabel(opportunity.type || opportunity.category);
  const locationLabel = formatLocation(opportunity.location, opportunity.workMode);
  const stipendLabel = formatStipend(opportunity.stipend, opportunity.prize);
  const deadlineLabel = formatDeadline(opportunity.deadline);

  const skillsList = Array.isArray(opportunity.skills) ? opportunity.skills : [];

  return (
    <Card hoverEffect padding="md" className="flex flex-col justify-between h-full group">
      <div>
        {/* Top header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-xl shrink-0 overflow-hidden">
              {opportunity.organizationLogo ? (
                <img src={opportunity.organizationLogo} alt={opportunity.organization} className="w-full h-full object-cover" />
              ) : opportunity.logo ? (
                typeof opportunity.logo === 'string' ? opportunity.logo : <Building2 className="w-5 h-5 text-slate-400" />
              ) : (
                <Building2 className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  {typeLabel}
                </span>
                {opportunity.verified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" title="Verified Opportunity" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <Link to={`/opportunities/${oppId}`}>{opportunity.title}</Link>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {opportunity.organization}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              if (onToggleSave) onToggleSave(oppId);
            }}
            className={`p-2 rounded-lg border transition-all ${
              isSaved
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isSaved ? 'Remove from Saved' : 'Save Opportunity'}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Key Metadata Row */}
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-md">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {locationLabel}
          </span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-md">
            {stipendLabel}
          </span>
          {opportunity.featured && (
            <Badge variant="primary" size="sm" icon={Sparkles}>
              Featured
            </Badge>
          )}
        </div>

        {/* Skills Chips */}
        {skillsList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {skillsList.slice(0, 4).map((skill, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
              >
                {skill}
              </span>
            ))}
            {skillsList.length > 4 && (
              <span className="text-[11px] font-medium px-1 py-0.5 text-slate-400">
                +{skillsList.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer info & CTA */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-auto">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {deadlineLabel || 'Rolling Applications'}
        </span>
        <Link to={`/opportunities/${oppId}`}>
          <Button size="sm" variant="secondary" icon={ExternalLink}>
            View Details
          </Button>
        </Link>
      </div>
    </Card>
  );
}
