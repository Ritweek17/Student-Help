import React, { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, Filter, ExternalLink } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { CalendarView } from '../../components/calendar/CalendarView';
import { CalendarEventModal } from '../../components/calendar/CalendarEventModal';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchCalendarEvents } from '../../services/mockApi';

export function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [targetDate, setTargetDate] = useState('2026-08-31');

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await fetchCalendarEvents();
        setEvents(data);
      } catch (err) {
        console.error('Error loading calendar events:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const handleSaveEvent = (eventObj) => {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === eventObj.id);
      if (exists) {
        return prev.map((e) => (e.id === eventObj.id ? eventObj : e));
      }
      return [eventObj, ...prev];
    });
  };

  const handleSelectEvent = (evt) => {
    setSelectedEvent(evt);
    setModalOpen(true);
  };

  const handleAddForDate = (dateStr) => {
    setSelectedEvent(null);
    setTargetDate(dateStr);
    setModalOpen(true);
  };

  if (loading) {
    return <LoadingState text="Loading CareerOS Primary Calendar..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="CareerOS Calendar"
        subtitle="Manage career events, internship deadlines, interview rounds, and study schedules in your primary workspace."
        action={
          <Button
            icon={Plus}
            onClick={() => {
              setSelectedEvent(null);
              setTargetDate('2026-08-31');
              setModalOpen(true);
            }}
          >
            Add Event
          </Button>
        }
      />

      {/* Main Internal Calendar Component */}
      <CalendarView
        events={events}
        onSelectEvent={handleSelectEvent}
        onAddEventForDate={handleAddForDate}
      />

      {/* Add / Edit Event Modal */}
      <CalendarEventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEvent(null);
        }}
        onSaveEvent={handleSaveEvent}
        initialData={selectedEvent}
        initialDate={targetDate}
      />
    </div>
  );
}
