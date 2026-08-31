import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin, Calendar, Sparkles, Building2, ExternalLink } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function OpportunityCard({
  opportunity,
  onToggleSave,
  isSavedState
}) {
  const isSaved = isSavedState !== undefined ? isSavedState : opportunity.isSaved;

  return (
    <Card hoverEffect padding="md" className="flex flex-col justify-between h-full group">
      <div>
        {/* Top header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-xl shrink-0">
              {opportunity.logo || <Building2 className="w-5 h-5 text-slate-400" />}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                {opportunity.category}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                <Link to={`/opportunities/${opportunity.id}`}>{opportunity.title}</Link>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {opportunity.organization}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              if (onToggleSave) onToggleSave(opportunity.id);
            }}
            className={`p-2 rounded-lg border transition-all ${
              isSaved
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
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
            {opportunity.location} ({opportunity.workMode})
          </span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-md">
            {opportunity.stipend}
          </span>
          {opportunity.matchScore && (
            <Badge variant="success" size="sm" icon={Sparkles}>
              {opportunity.matchScore}% Match
            </Badge>
          )}
        </div>

        {/* Skills Chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {opportunity.skills.slice(0, 4).map((skill, idx) => (
            <span
              key={idx}
              className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
            >
              {skill}
            </span>
          ))}
          {opportunity.skills.length > 4 && (
            <span className="text-[11px] font-medium px-1 py-0.5 text-slate-400">
              +{opportunity.skills.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Footer info & CTA */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-auto">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {opportunity.deadlineTag || `Deadline: ${opportunity.deadline}`}
        </span>
        <Link to={`/opportunities/${opportunity.id}`}>
          <Button size="sm" variant="secondary" icon={ExternalLink}>
            View Details
          </Button>
        </Link>
      </div>
    </Card>
  );
}
