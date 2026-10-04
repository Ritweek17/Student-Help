import React, { useState, useCallback } from 'react';
import {
  Plus,
  Calendar as CalendarIcon,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { CalendarView } from '../../components/calendar/CalendarView';
import { CalendarEventModal } from '../../components/calendar/CalendarEventModal';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCalendar } from '../../context/CalendarContext';

const TYPE_FILTERS = [
  { value: undefined, label: 'All Types' },
  { value: 'deadline', label: 'Deadlines' },
  { value: 'interview', label: 'Interviews' },
  { value: 'event', label: 'Events' },
  { value: 'application', label: 'Applications' },
  { value: 'registration', label: 'Registrations' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'personal', label: 'Personal' },
];

const STATUS_FILTERS = [
  { value: undefined, label: 'All Status' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function CalendarPage() {
  const {
    events,
    loading,
    error,
    actionError,
    filters,
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setFilters,
    clearActionError,
  } = useCalendar();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);

  // ─── Filter Handlers ──────────────────────────────────────────────
  const handleTypeFilter = useCallback((typeValue) => {
    setFilters({ type: typeValue });
  }, [setFilters]);

  const handleStatusFilter = useCallback((statusValue) => {
    setFilters({ status: statusValue });
  }, [setFilters]);

  // ─── Event Modal Handlers ─────────────────────────────────────────
  const handleSelectEvent = useCallback((evt) => {
    setSelectedEvent(evt);
    setModalOpen(true);
  }, []);

  const handleAddForDate = useCallback((dateStr) => {
    setSelectedEvent(null);
    setTargetDate(dateStr || new Date().toISOString().split('T')[0]);
    setModalOpen(true);
  }, []);

  const handleOpenAddModal = useCallback(() => {
    setSelectedEvent(null);
    setTargetDate(new Date().toISOString().split('T')[0]);
    setModalOpen(true);
  }, []);

  const handleSaveEvent = useCallback(async (payload, isEdit, id) => {
    if (isEdit && id) {
      await updateEvent(id, payload);
    } else {
      await createEvent(payload);
    }
  }, [updateEvent, createEvent]);

  const handleDeleteEvent = useCallback(async (id) => {
    await deleteEvent(id);
  }, [deleteEvent]);

  const activeTypeValue = filters.type;
  const activeStatusValue = filters.status;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="CareerOS Calendar"
        subtitle="Manage career events, internship deadlines, interview rounds, and study schedules in your primary workspace."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              onClick={() => refreshEvents()}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              icon={Plus}
              onClick={handleOpenAddModal}
            >
              Add Event
            </Button>
          </div>
        }
      />

      {/* Action Error Alert Toast */}
      {actionError && (
        <div
          className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={clearActionError}
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="space-y-3">
        {/* Type Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {TYPE_FILTERS.map((tf) => (
            <button
              key={tf.label}
              onClick={() => handleTypeFilter(tf.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTypeValue === tf.value
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              aria-pressed={activeTypeValue === tf.value}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200 dark:border-slate-800">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.label}
              onClick={() => handleStatusFilter(sf.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeStatusValue === sf.value
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              aria-pressed={activeStatusValue === sf.value}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState text="Loading CareerOS Primary Calendar..." />
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Unable to load calendar events"
          description={error}
          actionLabel="Retry"
          onAction={() => refreshEvents()}
        />
      ) : events.length > 0 ? (
        <CalendarView
          events={events}
          onSelectEvent={handleSelectEvent}
          onAddEventForDate={handleAddForDate}
        />
      ) : (
        <EmptyState
          icon={CalendarIcon}
          title="No calendar events found"
          description={
            activeTypeValue || activeStatusValue
              ? 'No events match the selected filters. Try clearing filters or schedule a new event.'
              : 'Your schedule is clear. Create your first calendar event or track opportunities to sync deadlines automatically.'
          }
          actionLabel="Add Event"
          onAction={handleOpenAddModal}
        />
      )}

      {/* Add / Edit Event Modal */}
      <CalendarEventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEvent(null);
        }}
        onSaveEvent={handleSaveEvent}
        onDeleteEvent={handleDeleteEvent}
        initialData={selectedEvent}
        initialDate={targetDate}
      />
    </div>
  );
}
