import React from 'react';
import { Building2, Calendar, FileText, ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';

export function ApplicationCard({ application, onViewDetails }) {
  return (
    <Card hoverEffect padding="md" className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {application.organization}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {application.role}
            </h3>
          </div>
          <StatusBadge status={application.status} />
        </div>

        <div className="space-y-2 mt-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Applied: {application.appliedDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[200px]">{application.resumeUsed}</span>
          </div>
          {application.nextAction && (
            <div className="mt-2 p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">
              <span className="block text-[10px] text-indigo-500 uppercase tracking-wider">Next Step</span>
              {application.nextAction}
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <span className="text-xs text-slate-500">{application.stipend}</span>
        <Button size="sm" variant="ghost" onClick={() => onViewDetails(application)} icon={ArrowRight}>
          Details
        </Button>
      </div>
    </Card>
  );
}
