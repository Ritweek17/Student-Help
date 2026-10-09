import React, { useState, useEffect } from 'react';
import { Trophy, Calendar as CalendarIcon, Filter, Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { ContestCard } from '../../components/cards/ContestCard';
import { CalendarEventModal } from '../../components/calendar/CalendarEventModal';
import { LoadingState } from '../../components/ui/LoadingState';
import { getContests } from '../../services/contestApi';
import { useAuth } from '../../context/AuthContext';

export function ContestsPage() {
  const [loading, setLoading] = useState(true);
  const [contests, setContests] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [contestToCalendar, setContestToCalendar] = useState(null);

  const { token, logout } = useAuth();

  const platforms = ['All', 'LeetCode', 'CodeChef', 'Codeforces', 'AtCoder', 'HackerRank'];

  useEffect(() => {
    async function loadContestsData() {
      if (!token) return;
      try {
        const data = await getContests({}, token);
        const mapped = (data.contests || []).map(c => ({
          ...c,
          id: c._id,
          date: c.eventDate ? new Date(c.eventDate).toLocaleDateString('en-CA') : '',
          startTime: c.eventDate ? new Date(c.eventDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''
        }));
        setContests(mapped);
      } catch (err) {
        console.error('Error fetching coding contests:', err);
        if (err.status === 401) logout();
      } finally {
        setLoading(false);
      }
    }
    loadContestsData();
  }, [token, logout]);

  const handleAddToCalendar = (contest) => {
    const eventObj = {
      title: `${contest.platform} - ${contest.name}`,
      category: 'Contest',
      date: contest.date,
      startTime: contest.startTime ? contest.startTime.substring(0, 5) : '20:00',
      endTime: contest.endDate ? new Date(contest.endDate).toLocaleTimeString('en-US', { hour12: false }).substring(0, 5) : '21:30',
      location: contest.contestUrl,
      description: `Coding contest on ${contest.platform}. Duration: ${contest.duration}. Difficulty: ${contest.difficulty || 'N/A'}.`,
      registrationStatus: 'Not Registered'
    };
    setContestToCalendar(eventObj);
    setCalendarModalOpen(true);
  };

  const filteredContests = contests.filter((c) => {
    if (selectedPlatform === 'All') return true;
    return c.platform === selectedPlatform;
  });

  if (loading) {
    return <LoadingState text="Loading Coding Contest Schedule..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Coding Contest Calendar"
        subtitle="Track upcoming algorithmic contests across LeetCode, CodeChef, Codeforces, and AtCoder."
      />

      {/* Platform Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Platform:
        </span>
        {platforms.map((platform) => (
          <button
            key={platform}
            onClick={() => setSelectedPlatform(platform)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedPlatform === platform
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {platform}
          </button>
        ))}
      </div>

      {/* Contests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContests.map((contest) => (
          <ContestCard
            key={contest.id}
            contest={contest}
            onAddToCalendar={handleAddToCalendar}
          />
        ))}
      </div>

      {/* Add Contest to CareerOS Calendar Modal */}
      <CalendarEventModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        onSaveEvent={() => {
          alert('Contest event successfully added to your CareerOS Calendar!');
          setCalendarModalOpen(false);
        }}
        initialData={contestToCalendar}
      />
    </div>
  );
}
