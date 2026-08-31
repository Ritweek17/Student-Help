import React from 'react';
import { Calendar, Clock, ExternalLink, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function ContestCard({ contest, onAddToCalendar }) {
  return (
    <Card hoverEffect padding="md" className="flex flex-col justify-between h-full group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
              {contest.platformLogo || '💻'}
            </span>
            <div>
              <Badge variant="primary" size="sm">{contest.platform}</Badge>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mt-0.5">
                {contest.name}
              </h3>
            </div>
          </div>
          <Badge variant={contest.registrationStatus === 'Open' ? 'success' : 'info'} size="sm">
            {contest.registrationStatus}
          </Badge>
        </div>

        <div className="space-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">{contest.date}</span>
            <span>•</span>
            <span>{contest.startTime}</span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Duration: {contest.duration}</span>
            <span>•</span>
            <span>Difficulty: {contest.difficulty}</span>
          </div>
        </div>
      </div>

      {/* Action buttons: Add to Calendar & External Contest Link */}
      <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          icon={Plus}
          onClick={() => onAddToCalendar(contest)}
        >
          Add to Calendar
        </Button>

        <a href={contest.contestUrl} target="_blank" rel="noreferrer">
          <Button size="sm" variant="secondary" icon={ExternalLink}>
            Contest Link
          </Button>
        </a>
      </div>
    </Card>
  );
}
