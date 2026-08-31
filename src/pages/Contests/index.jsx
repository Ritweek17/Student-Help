import React, { useState, useEffect } from 'react';
import { Trophy, Calendar as CalendarIcon, Filter, Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { ContestCard } from '../../components/cards/ContestCard';
import { CalendarEventModal } from '../../components/calendar/CalendarEventModal';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchCodingContests } from '../../services/mockApi';

export function ContestsPage() {
  const [loading, setLoading] = useState(true);
  const [contests, setContests] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [contestToCalendar, setContestToCalendar] = useState(null);

  const platforms = ['All', 'LeetCode', 'CodeChef', 'Codeforces', 'AtCoder', 'HackerRank'];

  useEffect(() => {
    async function loadContestsData() {
      try {
        const data = await fetchCodingContests();
        setContests(data);
      } catch (err) {
        console.error('Error fetching coding contests:', err);
      } finally {
        setLoading(false);
      }
    }
    loadContestsData();
  }, []);

  const handleAddToCalendar = (contest) => {
    const eventObj = {
      title: `${contest.platform} - ${contest.name}`,
      category: 'Contest',
      date: contest.date,
      startTime: '20:00',
      endTime: '21:30',
      location: contest.contestUrl,
      description: `Coding contest on ${contest.platform}. Duration: ${contest.duration}. Difficulty: ${contest.difficulty}.`,
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
