import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  MapPin,
  Calendar as CalendarIcon,
  Sparkles,
  Building2,
  ExternalLink,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { CalendarEventModal } from '../../components/calendar/CalendarEventModal';
import { fetchOpportunityById } from '../../services/mockApi';

export function OpportunityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [eventToCalendar, setEventToCalendar] = useState(null);

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      try {
        const data = await fetchOpportunityById(id);
        setOpportunity(data);
        setIsSaved(data.isSaved);
      } catch (err) {
        setError(err.message || 'Opportunity not found');
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [id]);

  const handleAddToCalendar = () => {
    if (!opportunity) return;
    const evt = {
      title: `${opportunity.category}: ${opportunity.title} Deadline`,
      category: 'Career',
      date: opportunity.deadline,
      startTime: '23:59',
      endTime: '23:59',
      location: opportunity.location,
      description: `Application deadline for ${opportunity.title} at ${opportunity.organization}. Stipend: ${opportunity.stipend}.`,
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
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Opportunity Not Found</h2>
        <p className="text-sm text-slate-500">{error || 'The requested opportunity could not be located.'}</p>
        <Link to="/opportunities">
          <Button icon={ArrowLeft}>Back to Opportunities</Button>
        </Link>
      </div>
    );
  }

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
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-3xl flex items-center justify-center shrink-0 shadow-xs">
              {opportunity.logo || <Building2 className="w-7 h-7 text-indigo-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="primary">{opportunity.category}</Badge>
                <Badge variant="success" icon={Sparkles}>
                  {opportunity.matchScore}% Match
                </Badge>
                {opportunity.applicationStatus && (
                  <Badge variant="info">Status: {opportunity.applicationStatus}</Badge>
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
              onClick={() => setIsSaved(!isSaved)}
              className={`p-2.5 rounded-xl border transition-all ${
                isSaved
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border-indigo-200 dark:border-indigo-800'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title={isSaved ? 'Remove from Saved' : 'Save Role'}
            >
              <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <Button
              size="md"
              variant="outline"
              icon={CalendarIcon}
              onClick={handleAddToCalendar}
            >
              Add to Calendar
            </Button>

            <Button
              size="md"
              onClick={() => setApplyModalOpen(true)}
              icon={ExternalLink}
              className="shadow-lg shadow-indigo-600/30"
            >
              Apply / Register
            </Button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Work Mode & Location</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {opportunity.location} ({opportunity.workMode})
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Stipend / Prize</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {opportunity.stipend}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Application Deadline</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
              {opportunity.deadlineTag || opportunity.deadline}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 block font-medium">Posted Date</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {opportunity.postedDate}
            </span>
          </div>
        </div>
      </Card>

      {/* Main Details Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
              About the Role
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {opportunity.description}
            </p>

            {opportunity.responsibilities && (
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Key Responsibilities:
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  {opportunity.responsibilities.map((resp, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {opportunity.perks && (
            <Card padding="lg" className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Perks & Student Benefits
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                {opportunity.perks.map((perk, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
              Required Tech Stack
            </h3>
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

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Eligibility Criteria
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                {opportunity.eligibility}
              </p>
            </div>
          </Card>

          <Card padding="lg" className="bg-slate-900 text-white space-y-4">
            <h3 className="text-base font-bold font-heading">Track This Opportunity</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add this opportunity to your CareerOS Application Tracker to receive deadline alerts and log interview rounds.
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
            You are initiating a demo application for <span className="font-bold">{opportunity.title}</span>. In Phase 2, this will submit your verified CareerOS profile & resume directly to the employer portal.
          </p>

          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
            <span className="font-semibold block">Resume attached:</span>
            <span>Alex_Chen_Software_Engineering_Resume_2026.pdf</span>
          </div>

          <div className="pt-3 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                alert('Demo Application Logged! Opportunity added to Application Tracker.');
                setApplyModalOpen(false);
                navigate('/applications');
              }}
            >
              Confirm & Add to Tracker
            </Button>
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
