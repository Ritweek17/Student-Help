import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Calendar as CalendarIcon,
  Sparkles,
  Building2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { CalendarEventModal } from '../../components/calendar/CalendarEventModal';
import { useAuth } from '../../context/AuthContext';
import { useSavedOpportunities } from '../../context/SavedOpportunityContext';
import * as opportunityApi from '../../services/opportunityApi';

function formatTypeLabel(typeStr) {
  if (!typeStr) return 'Opportunity';
  return typeStr
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatLocation(loc, workMode) {
  let locStr = '';
  if (typeof loc === 'string') locStr = loc;
  else if (loc && typeof loc === 'object') {
    locStr = [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
  }

  if (!locStr && workMode === 'remote') locStr = 'Remote';
  else if (!locStr) locStr = 'Location specified';

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
    return `Prize Pool: ${curr} ${prize.amount.toLocaleString()}`;
  }

  return 'Unpaid / Free Entry';
}

function formatDate(dateVal) {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(dateVal);
  }
}

export function OpportunityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const { isSaved: checkIsSaved, isSaving: checkIsSaving, toggleSave } = useSavedOpportunities();

  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [eventToCalendar, setEventToCalendar] = useState(null);

  const oppId = opportunity?._id || opportunity?.id || id;
  const isSaved = checkIsSaved(oppId);
  const saving = checkIsSaving(oppId);

  const fetchDetail = async (abortSignal) => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await opportunityApi.getOpportunityById(id, token, abortSignal);
      setOpportunity(response.opportunity);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        setError('Your session has expired. Please sign in again.');
      } else if (err.status === 404) {
        setError('Opportunity not found.');
      } else {
        setError(err.message || 'Unable to load opportunity details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [id, token]);

  const handleAddToCalendar = () => {
    if (!opportunity) return;
    const evt = {
      title: `${formatTypeLabel(opportunity.type)}: ${opportunity.title} Deadline`,
      category: 'Career',
      date: opportunity.deadline ? new Date(opportunity.deadline).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      startTime: '23:59',
      endTime: '23:59',
      location: formatLocation(opportunity.location, opportunity.workMode),
      description: `Application deadline for ${opportunity.title} at ${opportunity.organization}.`,
      registrationStatus: 'Registered'
    };
    setEventToCalendar(evt);
    setCalendarModalOpen(true);
  };

  if (loading) {
    return <LoadingState text="Loading opportunity details..." />;
  }

  if (error || !opportunity) {
    return (
      <div className="p-8 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-heading">
            Opportunity Not Found
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">{error || 'The requested opportunity could not be located.'}</p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link to="/opportunities">
            <Button size="sm" variant="outline" icon={ArrowLeft}>
              Back to Opportunities
            </Button>
          </Link>
          <Button size="sm" icon={RefreshCw} onClick={() => fetchDetail()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const externalUrl = opportunity.applicationUrl || opportunity.registrationUrl || opportunity.organizationWebsite || opportunity.source?.url;

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* Back link */}
      <div>
        <Link to="/opportunities" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Opportunities Feed
        </Link>
      </div>

      {/* Main Banner Card */}
      <Card padding="lg" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-3xl flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              {opportunity.organizationLogo ? (
                <img src={opportunity.organizationLogo} alt={opportunity.organization} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="primary">{formatTypeLabel(opportunity.type)}</Badge>
                {opportunity.verified && (
                  <Badge variant="success" icon={CheckCircle2}>
                    Verified
                  </Badge>
                )}
                {opportunity.featured && (
                  <Badge variant="warning" icon={Sparkles}>
                    Featured
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-heading">
                {opportunity.title}
              </h1>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
                {opportunity.organization}
              </p>
            </div>
          </div>

          {/* Action Buttons: Save, Add to Calendar, Apply */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={() => !saving && toggleSave(oppId)}
              className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-semibold ${
                saving
                  ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800'
                  : isSaved
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={saving ? 'Saving...' : isSaved ? 'Remove from Saved' : 'Save Opportunity'}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current text-indigo-600 dark:text-indigo-400' : ''}`} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </>
              )}
            </button>


            {opportunity.deadline && (
              <Button
                size="md"
                variant="outline"
                icon={CalendarIcon}
                onClick={handleAddToCalendar}
              >
                Add to Calendar
              </Button>
            )}

            {externalUrl ? (
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  size="md"
                  icon={ExternalLink}
                  className="shadow-lg shadow-indigo-600/30"
                >
                  Apply / Register
                </Button>
              </a>
            ) : (
              <Button
                size="md"
                onClick={() => setApplyModalOpen(true)}
                icon={ExternalLink}
                className="shadow-lg shadow-indigo-600/30"
              >
                Apply / Register
              </Button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Work Mode & Location</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {formatLocation(opportunity.location, opportunity.workMode)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Stipend / Prize</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {formatStipend(opportunity.stipend, opportunity.prize)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Application Deadline</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
              {formatDate(opportunity.deadline) || 'Rolling Basis'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Event Date</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {formatDate(opportunity.eventDate) || 'TBA'}
            </span>
          </div>
        </div>
      </Card>

      {/* Main Details Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
              About the Opportunity
            </h3>
            {opportunity.shortDescription && (
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed border-l-4 border-indigo-600 pl-3">
                {opportunity.shortDescription}
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {opportunity.description}
            </p>
          </Card>

          {/* Eligibility Section */}
          {opportunity.eligibility && (
            <Card padding="lg" className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Eligibility Requirements
              </h3>
              <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {opportunity.eligibility.educationLevels?.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Education Levels:</span>
                    <span>{opportunity.eligibility.educationLevels.join(', ')}</span>
                  </div>
                )}
                {opportunity.eligibility.branches?.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Branches:</span>
                    <span>{opportunity.eligibility.branches.join(', ')}</span>
                  </div>
                )}
                {opportunity.eligibility.graduationYears?.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Graduation Years:</span>
                    <span>{opportunity.eligibility.graduationYears.join(', ')}</span>
                  </div>
                )}
                {opportunity.eligibility.locations?.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Eligible Locations:</span>
                    <span>{opportunity.eligibility.locations.join(', ')}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
              Skills & Tags
            </h3>
            {opportunity.skills?.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Tech Stack:</span>
                <div className="flex flex-wrap gap-2">
                  {opportunity.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {opportunity.tags?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {opportunity.tags.map((tag, idx) => (
                    <span key={idx} className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {opportunity.source?.name && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Source Platform
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center justify-between">
                  <span>{opportunity.source.name}</span>
                  {opportunity.source.url && (
                    <a href={opportunity.source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline inline-flex items-center gap-1">
                      Source Link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </p>
              </div>
            )}
          </Card>

          <Card padding="lg" className="bg-slate-900 text-white space-y-4">
            <h3 className="text-base font-bold font-heading">Track This Opportunity</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add this opportunity to your CareerOS Application Tracker to receive deadline alerts and log application status.
            </p>
            <Button size="md" className="w-full" onClick={() => navigate('/applications')}>
              Go to Applications Board
            </Button>
          </Card>
        </div>
      </div>

      {/* Apply Modal */}
      <Modal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title={`Apply to ${opportunity.title}`}
        subtitle={`Organization: ${opportunity.organization}`}
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            You are viewing the application link for <span className="font-bold">{opportunity.title}</span>.
          </p>

          {externalUrl ? (
            <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 space-y-2">
              <span className="font-semibold block">Official Application Link:</span>
              <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 hover:underline break-all inline-flex items-center gap-1">
                {externalUrl} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <p className="text-slate-500 italic">No external URL provided for this opportunity.</p>
          )}

          <div className="pt-3 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setApplyModalOpen(false)}>
              Close
            </Button>
            {externalUrl && (
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <Button onClick={() => setApplyModalOpen(false)} icon={ExternalLink}>
                  Open Application Site
                </Button>
              </a>
            )}
          </div>
        </div>
      </Modal>

      {/* Add Event to CareerOS Calendar Modal */}
      <CalendarEventModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        onSaveEvent={() => {
          alert('Opportunity deadline event successfully added to your CareerOS Calendar!');
          setCalendarModalOpen(false);
        }}
        initialData={eventToCalendar}
      />
    </div>
  );
}
