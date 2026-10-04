import React, { useState, useEffect } from 'react';
import { Trash2, AlertCircle, Briefcase, FileCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

const TYPE_OPTIONS = [
  { value: 'personal', label: 'Personal' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'event', label: 'Event / Session' },
  { value: 'interview', label: 'Interview' },
  { value: 'application', label: 'Application Deadline' },
  { value: 'registration', label: 'Registration Event' },
  { value: 'reminder', label: 'Reminder' },
];

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const REMINDER_OPTIONS = [
  { value: '', label: 'No Reminder' },
  { value: '0', label: 'At time of event' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

function extractDateAndTimes(evt, fallbackDate) {
  const defaultDate = fallbackDate || new Date().toISOString().split('T')[0];

  if (!evt) {
    return {
      date: defaultDate,
      startTime: '10:00',
      endTime: '11:00',
      allDay: false,
    };
  }

  let date = defaultDate;
  let startTime = '10:00';
  let endTime = '11:00';
  let allDay = Boolean(evt.allDay);

  if (evt.startAt) {
    const s = new Date(evt.startAt);
    if (!isNaN(s.getTime())) {
      const year = s.getFullYear();
      const month = String(s.getMonth() + 1).padStart(2, '0');
      const day = String(s.getDate()).padStart(2, '0');
      date = `${year}-${month}-${day}`;
      startTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  } else if (evt.date) {
    date = evt.date;
  }

  if (evt.endAt) {
    const e = new Date(evt.endAt);
    if (!isNaN(e.getTime())) {
      endTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  } else if (evt.endTime) {
    endTime = evt.endTime;
  }

  return { date, startTime, endTime, allDay };
}

export function CalendarEventModal({
  isOpen,
  onClose,
  onSaveEvent,
  onDeleteEvent,
  initialData = null,
  initialDate = '',
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('personal');
  const [status, setStatus] = useState('scheduled');
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState('');
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      setShowDeleteConfirm(false);
      setSaving(false);
      setDeleting(false);

      if (initialData) {
        setTitle(initialData.title || '');
        setType(initialData.type || 'personal');
        setStatus(initialData.status || 'scheduled');
        setLocation(initialData.location || '');
        setUrl(initialData.url || '');
        setReminderMinutes(
          initialData.reminderMinutes !== undefined && initialData.reminderMinutes !== null
            ? String(initialData.reminderMinutes)
            : ''
        );
        setDescription(initialData.description || '');

        const dt = extractDateAndTimes(initialData, initialDate);
        setDate(dt.date);
        setStartTime(dt.startTime);
        setEndTime(dt.endTime);
        setAllDay(dt.allDay);
      } else {
        setTitle('');
        setType('personal');
        setStatus('scheduled');
        setLocation('');
        setUrl('');
        setReminderMinutes('');
        setDescription('');

        const dt = extractDateAndTimes(null, initialDate);
        setDate(dt.date);
        setStartTime(dt.startTime);
        setEndTime(dt.endTime);
        setAllDay(dt.allDay);
      }
    }
  }, [initialData, initialDate, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setValidationError('Event title is required.');
      return;
    }

    if (!date) {
      setValidationError('Event date is required.');
      return;
    }

    let startAtDate;
    let endAtDate = undefined;

    if (allDay) {
      startAtDate = new Date(`${date}T00:00:00`);
      endAtDate = new Date(`${date}T23:59:59`);
    } else {
      if (!startTime) {
        setValidationError('Start time is required for timed events.');
        return;
      }
      startAtDate = new Date(`${date}T${startTime}:00`);

      if (endTime) {
        endAtDate = new Date(`${date}T${endTime}:00`);
        if (endAtDate < startAtDate) {
          setValidationError('End time cannot be earlier than start time.');
          return;
        }
      }
    }

    if (isNaN(startAtDate.getTime())) {
      setValidationError('Invalid start date or time.');
      return;
    }

    let cleanUrl = url.trim();
    if (cleanUrl) {
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      try {
        const parsed = new URL(cleanUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setValidationError('URL must use http:// or https://');
          return;
        }
      } catch {
        setValidationError('Please enter a valid URL.');
        return;
      }
    } else {
      cleanUrl = undefined;
    }

    const payload = {
      title: cleanTitle,
      type,
      status,
      allDay,
      startAt: startAtDate.toISOString(),
      endAt: endAtDate ? endAtDate.toISOString() : undefined,
      location: location.trim() || undefined,
      url: cleanUrl,
      description: description.trim() || undefined,
      reminderMinutes: reminderMinutes !== '' ? Number(reminderMinutes) : undefined,
    };

    setSaving(true);
    try {
      await onSaveEvent(payload, Boolean(initialData), initialData?._id || initialData?.id);
      onClose();
    } catch (err) {
      setValidationError(err.message || 'Failed to save calendar event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    const eventId = initialData._id || initialData.id;
    if (!eventId) return;

    setDeleting(true);
    try {
      await onDeleteEvent(eventId);
      onClose();
    } catch (err) {
      setValidationError(err.message || 'Failed to delete calendar event.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isEdit = Boolean(initialData);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Calendar Event' : 'Add Event to CareerOS Calendar'}
      subtitle={
        isEdit
          ? 'Update event timing, status, reminders, and details.'
          : 'Schedule career deadlines, interview rounds, prep sessions, and reminders.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Validation or API error alert */}
        {validationError && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Linked Entity Badges (for synced events) */}
        {isEdit && (initialData.opportunity || initialData.application || initialData.source !== 'manual') && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Event Linkage
            </span>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {initialData.opportunity && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 font-medium">
                  <Briefcase className="w-3.5 h-3.5" />
                  {initialData.opportunity.title || 'Opportunity'}
                </span>
              )}
              {initialData.application && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 font-medium">
                  <FileCheck className="w-3.5 h-3.5" />
                  Application ({initialData.application.status || 'applied'})
                </span>
              )}
              {initialData.source && initialData.source !== 'manual' && (
                <Badge variant="default" size="sm">
                  Auto-synced ({initialData.source})
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Event Title */}
        <Input
          label="Event Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. ScaleGrid Technical Interview Round 1"
          required
          disabled={saving || deleting}
        />

        {/* Event Type & Status */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Event Type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={saving || deleting}
          />

          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={saving || deleting}
          />
        </div>

        {/* Date and All Day Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Date & Time
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                disabled={saving || deleting}
              />
              <span>All Day Event</span>
            </label>
          </div>

          <div className={`grid gap-3 ${allDay ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={saving || deleting}
            />

            {!allDay && (
              <>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={saving || deleting}
                  label="Start Time"
                />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={saving || deleting}
                  label="End Time"
                />
              </>
            )}
          </div>
        </div>

        {/* Location and URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Location / Platform"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Google Meet, Zoom, Campus Lab 4"
            disabled={saving || deleting}
          />

          <Input
            label="Event URL / Link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meet.google.com/..."
            disabled={saving || deleting}
          />
        </div>

        {/* Reminder Options */}
        <Select
          label="Reminder Alert"
          options={REMINDER_OPTIONS}
          value={reminderMinutes}
          onChange={(e) => setReminderMinutes(e.target.value)}
          disabled={saving || deleting}
        />

        {/* Description */}
        <Textarea
          label="Description & Preparation Notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add agenda, topics to revise, interviewer name, or prep checklist..."
          disabled={saving || deleting}
        />

        {/* Delete Confirmation Alert */}
        {showDeleteConfirm && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Permanently delete this calendar event? This action cannot be undone.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                type="button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <div>
            {isEdit && !showDeleteConfirm && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
                className="text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                icon={Trash2}
              >
                Delete
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || deleting}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
