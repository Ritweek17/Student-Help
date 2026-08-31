import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, FileText, ChevronRight, Plus, Building2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Drawer';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ApplicationCard } from '../../components/cards/ApplicationCard';
import { fetchApplications } from '../../services/mockApi';

export function ApplicationsPage() {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  useEffect(() => {
    async function loadApps() {
      try {
        const data = await fetchApplications();
        setApplications(data);
      } catch (err) {
        console.error('Error loading applications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadApps();
  }, []);

  const counts = {
    Applied: applications.filter((a) => a.status === 'Applied').length,
    Interview: applications.filter((a) => a.status === 'Interview').length,
    Waiting: applications.filter((a) => a.status === 'Waiting').length,
    Selected: applications.filter((a) => a.status === 'Selected').length,
    Rejected: applications.filter((a) => a.status === 'Rejected').length
  };

  const handleOpenDetails = (app) => {
    setSelectedApp(app);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Application Tracker"
        subtitle="Manage your active job applications, interview timelines, and resumes."
        action={
          <Button icon={Plus} onClick={() => alert('Phase 1 Demo UI: Add Application modal template.')}>
            Add Application
          </Button>
        }
      />

      {/* Summary Pipeline Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { status: 'Applied', count: counts.Applied, bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
          { status: 'Interview', count: counts.Interview, bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
          { status: 'Waiting', count: counts.Waiting, bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
          { status: 'Selected', count: counts.Selected, bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
          { status: 'Rejected', count: counts.Rejected, bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' }
        ].map((item, idx) => (
          <Card key={idx} padding="sm" className={`border ${item.bg} text-center`}>
            <span className="text-2xl font-bold font-heading block">{item.count}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.status}</span>
          </Card>
        ))}
      </div>

      {/* Toggle View Mode (Table / Grid) */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {applications.length} Total Applications
        </span>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              viewMode === 'table' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              viewMode === 'grid' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Grid Cards
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState text="Loading applications pipeline..." />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} onViewDetails={handleOpenDetails} />
          ))}
        </div>
      ) : (
        /* Main Responsive Table */
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Organization & Role</th>
                  <th className="px-4 py-3.5">Applied Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Resume Tag</th>
                  <th className="px-4 py-3.5">Next Action</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
                    onClick={() => handleOpenDetails(app)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {app.role}
                          </span>
                          <span className="text-xs text-slate-500">{app.organization} • {app.stipend}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {app.appliedDate}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs">
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md max-w-[150px] truncate">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                        {app.resumeUsed}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {app.nextAction}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="ghost" icon={ChevronRight}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Application Detail Drawer */}
      {selectedApp && (
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`${selectedApp.organization} — ${selectedApp.role}`}
        >
          <div className="space-y-6 text-xs sm:text-sm">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-xs">Current Stage</span>
                <StatusBadge status={selectedApp.status} />
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-xs">Stipend / Offer</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedApp.stipend}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Application Overview</h4>
              <div className="space-y-2 text-slate-600 dark:text-slate-400">
                <p><span className="font-semibold text-slate-800 dark:text-slate-200">Applied Date:</span> {selectedApp.appliedDate}</p>
                <p><span className="font-semibold text-slate-800 dark:text-slate-200">Location:</span> {selectedApp.location}</p>
                <p><span className="font-semibold text-slate-800 dark:text-slate-200">Resume Attached:</span> {selectedApp.resumeUsed}</p>
              </div>
            </div>

            {selectedApp.timeline && (
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-slate-100">Timeline & Steps</h4>
                <div className="space-y-3 pl-2 border-l-2 border-slate-200 dark:border-slate-800">
                  {selectedApp.timeline.map((step, idx) => (
                    <div key={idx} className="relative pl-4">
                      <span
                        className={`absolute -left-[9px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                          step.completed ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{step.title}</span>
                      <span className="text-xs text-slate-400">{step.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <Button size="sm" variant="outline" className="w-full" onClick={() => alert('Phase 1 demo UI: Status update feature.')}>
                Update Status
              </Button>
              <Button size="sm" className="w-full" onClick={() => setDrawerOpen(false)}>
                Close Panel
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
