import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

export function CalendarEventModal({
  isOpen,
  onClose,
  onSaveEvent,
  initialData = null,
  initialDate = '2026-08-31'
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Career');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('Registered');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setCategory(initialData.category || 'Career');
      setDate(initialData.date || initialDate);
      setStartTime(initialData.startTime || '10:00');
      setEndTime(initialData.endTime || '11:00');
      setLocation(initialData.location || '');
      setDescription(initialData.description || '');
      setRegistrationStatus(initialData.registrationStatus || 'Registered');
    } else {
      setTitle('');
      setCategory('Career');
      setDate(initialDate);
      setStartTime('10:00');
      setEndTime('11:00');
      setLocation('');
      setDescription('');
      setRegistrationStatus('Registered');
    }
  }, [initialData, initialDate, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const eventObj = {
      id: initialData?.id || `evt-${Date.now()}`,
      title,
      category,
      date,
      startTime,
      endTime,
      location,
      description,
      registrationStatus
    };

    onSaveEvent(eventObj);
    onClose();
  };

  const categoryColors = {
    Career: '#e11d48',
    Internship: '#4f46e5',
    Hackathon: '#8b5cf6',
    Workshop: '#0284c7',
    Meetup: '#0d9488',
    Conference: '#d97706',
    Contest: '#b45309',
    Learning: '#059669',
    Goal: '#ec4899',
    Task: '#64748b',
    Personal: '#3b82f6'
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Event' : 'Add Event to CareerOS Calendar'}
      subtitle="Events live inside CareerOS. Optional Google Calendar sync can be configured later in Settings."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Event Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. ScaleGrid Technical Interview Round 1"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            options={[
              'Career',
              'Internship',
              'Hackathon',
              'Workshop',
              'Meetup',
              'Conference',
              'Contest',
              'Learning',
              'Goal',
              'Task',
              'Personal'
            ]}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <Select
            label="Registration Status"
            options={['Not Registered', 'Registered', 'Attended']}
            value={registrationStatus}
            onChange={(e) => setRegistrationStatus(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Input
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="End Time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <Input
          label="Location / Platform Link"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Google Meet, Zoom, or Campus Lab 4"
        />

        <Textarea
          label="Description & Notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add agenda, preparation topics, or interview link..."
        />

        <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-400">
            Internal CareerOS Event • Sync ready
          </span>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
