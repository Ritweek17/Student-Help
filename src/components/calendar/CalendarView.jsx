import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function CalendarView({ events = [], onSelectEvent, onAddEventForDate }) {
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day', 'agenda'
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 31)); // Aug 31, 2026

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper to generate month grid days
  const getMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

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
        isToday: i === 31 && month === 7 && year === 2026
      });
    }
    return days;
  };

  const monthDays = getMonthDays(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getEventsForDate = (dateStr) => {
    return events.filter((e) => e.date === dateStr);
  };

  const handlePrev = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date(2026, 7, 31))}
              className="px-2 py-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
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
                    {dateEvents.slice(0, 2).map((evt) => (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectEvent) onSelectEvent(evt);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white truncate shadow-2xs hover:opacity-90"
                        style={{ backgroundColor: evt.color || '#4f46e5' }}
                        title={evt.title}
                      >
                        {evt.title}
                      </div>
                    ))}
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
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Upcoming CareerOS Events Agenda ({events.length})
          </span>
          {events.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onSelectEvent && onSelectEvent(evt)}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-400 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: evt.color || '#4f46e5' }}
                />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="default" size="sm">{evt.category}</Badge>
                    <span className="text-xs font-bold text-slate-500">{evt.date}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{evt.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{evt.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {evt.startTime} - {evt.endTime}
                </span>
                {evt.location && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {evt.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
