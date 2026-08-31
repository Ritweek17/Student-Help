import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';

export function LearningTrackCard({ track }) {
  return (
    <Card hoverEffect padding="md" className="flex flex-col justify-between h-full group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
              {track.image || '📖'}
            </span>
            <div>
              <Badge variant="primary" size="sm">{track.category}</Badge>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mt-0.5">
                <Link to={`/learning/${track.id}`}>{track.title}</Link>
              </h3>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
          {track.description}
        </p>

        {/* Progress */}
        <div className="mt-4 space-y-1">
          <Progress value={track.progress} showLabel color="indigo" size="sm" />
          <span className="text-[11px] text-slate-400 font-medium block">
            {track.completedItems} / {track.totalItems} topics completed
          </span>
        </div>

        {/* Current & Next Suggested Topic */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Topic</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{track.currentTopic}</span>
          </div>
          {track.nextSuggestedTopic && (
            <div className="pt-1 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="truncate">Next: {track.nextSuggestedTopic}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
        <span className="text-slate-400">Target: {track.targetDate}</span>
        <Link to={`/learning/${track.id}`}>
          <Button size="sm" variant="ghost" icon={ArrowRight}>
            View Track
          </Button>
        </Link>
      </div>
    </Card>
  );
}
