import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  ExternalLink,
  Briefcase,
  FileCheck,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const EVENT_TYPE_COLORS = {
  interview: '#4f46e5',    // indigo
  deadline: '#e11d48',     // rose
  event: '#0284c7',        // sky
  application: '#059669',  // emerald
  registration: '#8b5cf6', // purple
  reminder: '#d97706',     // amber
  personal: '#3b82f6',     // blue
};

export const EVENT_TYPE_LABELS = {
  interview: 'Interview',
  deadline: 'Deadline',
  event: 'Event',
  application: 'Application',
  registration: 'Registration',
  reminder: 'Reminder',
  personal: 'Personal',
};

export const EVENT_TYPE_BADGE_VARIANTS = {
  interview: 'primary',
  deadline: 'warning',
  event: 'info',
  application: 'success',
  registration: 'purple',
  reminder: 'warning',
  personal: 'default',
};

/**
 * Format local YYYY-MM-DD from an event object (supports real startAt or mock date)
 */
export function getEventDateStr(evt) {
  if (evt.date) return evt.date;
  if (evt.startAt) {
    const d = new Date(evt.startAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return '';
}

/**
 * Format human-readable start and end time strings
 */
export function formatEventTime(evt) {
  if (evt.allDay) return 'All day';
  if (evt.startTime && evt.endTime) return `${evt.startTime} - ${evt.endTime}`;

  if (evt.startAt) {
    const start = new Date(evt.startAt);
    const startTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (evt.endAt) {
      const end = new Date(evt.endAt);
      const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${startTimeStr} - ${endTimeStr}`;
    }
    return startTimeStr;
  }
  return '';
}

export function CalendarView({ events = [], onSelectEvent, onAddEventForDate }) {
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day', 'agenda'
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper to generate month grid days
  const getMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const now = new Date();
    const isCurrentYearMonth = now.getFullYear() === year && now.getMonth() === month;

    const days = [];
    // Previous month padding
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: '', isCurrentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        day: i,
        dateStr,
        isCurrentMonth: true,
        isToday: isCurrentYearMonth && now.getDate() === i,
      });
    }
    return days;
  };

  const monthDays = getMonthDays(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getEventsForDate = (dateStr) => {
    return events.filter((e) => getEventDateStr(e) === dateStr);
  };

  const handlePrev = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <Card padding="lg" className="space-y-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-heading">
            {monthName}
          </h2>
          <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Switches */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          {['month', 'week', 'day', 'agenda'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="space-y-2">
          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
            {daysOfWeek.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((item, idx) => {
              if (!item.isCurrentMonth) {
                return (
                  <div
                    key={idx}
                    className="h-24 bg-slate-50/40 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-900 rounded-xl"
                  />
                );
              }

              const dateEvents = getEventsForDate(item.dateStr);

              return (
                <div
                  key={idx}
                  onClick={() => onAddEventForDate && onAddEventForDate(item.dateStr)}
                  className={`h-28 p-1.5 border rounded-xl flex flex-col justify-between transition-all group cursor-pointer ${
                    item.isToday
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-500/40 ring-1 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60 hover:border-indigo-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        item.isToday
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.day}
                    </span>
                    <Plus className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Event Chips */}
                  <div className="space-y-1 overflow-y-auto no-scrollbar">
                    {dateEvents.slice(0, 2).map((evt) => {
                      const eventId = evt._id || evt.id;
                      const eventColor = evt.color || EVENT_TYPE_COLORS[evt.type] || '#4f46e5';
                      return (
                        <div
                          key={eventId}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectEvent) onSelectEvent(evt);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white truncate shadow-2xs hover:opacity-90"
                          style={{ backgroundColor: eventColor }}
                          title={`${evt.title} (${EVENT_TYPE_LABELS[evt.type] || evt.type || 'Event'})`}
                        >
                          {evt.title}
                        </div>
                      );
                    })}
                    {dateEvents.length > 2 && (
                      <span className="text-[9px] font-bold text-slate-400 block px-1">
                        +{dateEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA / LIST VIEW */}
      {(viewMode === 'agenda' || viewMode === 'week' || viewMode === 'day') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Upcoming CareerOS Events Agenda ({events.length})
            </span>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No events found for this view. Click 'Add Event' above or click on any calendar date to schedule one.
              </p>
            </div>
          ) : (
            events.map((evt) => {
              const eventId = evt._id || evt.id;
              const eventColor = evt.color || EVENT_TYPE_COLORS[evt.type] || '#4f46e5';
              const eventLabel = EVENT_TYPE_LABELS[evt.type] || evt.type || evt.category || 'Event';
              const eventBadgeVariant = EVENT_TYPE_BADGE_VARIANTS[evt.type] || 'default';
              const dateDisplay = getEventDateStr(evt);
              const timeDisplay = formatEventTime(evt);

              return (
                <div
                  key={eventId}
                  onClick={() => onSelectEvent && onSelectEvent(evt)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 mt-1"
                      style={{ backgroundColor: eventColor }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge variant={eventBadgeVariant} size="sm">
                          {eventLabel}
                        </Badge>
                        {evt.status && evt.status !== 'scheduled' && (
                          <Badge
                            variant={evt.status === 'completed' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {evt.status}
                          </Badge>
                        )}
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {dateDisplay}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {evt.title}
                      </h4>
                      {evt.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {evt.description}
                        </p>
                      )}

                      {/* Linked Entities */}
                      {(evt.opportunity || evt.application) && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                          {evt.opportunity && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                              <Briefcase className="w-3 h-3 text-indigo-500" />
                              {evt.opportunity.title || 'Opportunity'}
                            </span>
                          )}
                          {evt.application && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                              <FileCheck className="w-3 h-3 text-emerald-500" />
                              Application ({evt.application.status || 'applied'})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    {timeDisplay && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {timeDisplay}
                      </span>
                    )}
                    {evt.location && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {evt.location}
                      </span>
                    )}
                    {evt.url && (
                      <a
                        href={evt.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Open event link"
                        aria-label="Open event link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}
