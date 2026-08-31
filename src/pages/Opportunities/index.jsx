import React, { useState, useEffect } from 'react';
import { Search, Filter, Compass, X } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { OpportunityCard } from '../../components/cards/OpportunityCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchOpportunities } from '../../services/mockApi';

export function OpportunitiesPage() {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWorkMode, setSelectedWorkMode] = useState('All');
  const [savedIds, setSavedIds] = useState(['opp-1', 'opp-2', 'opp-4', 'opp-7']);

  const categories = [
    'All',
    'Internships',
    'Hackathons',
    'Workshops',
    'Meetups',
    'Conferences',
    'Expos',
    'Open Source',
    'Competitions',
    'Fellowships',
    'Scholarships',
    'Tech Talks',
    'Student Programs'
  ];

  const workModes = ['All', 'Remote', 'Hybrid', 'On-site'];

  useEffect(() => {
    async function loadOpps() {
      setLoading(true);
      try {
        const data = await fetchOpportunities({
          search,
          category: selectedCategory,
          workMode: selectedWorkMode
        });
        setOpportunities(data);
      } catch (err) {
        console.error('Error fetching opportunities:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOpps();
  }, [search, selectedCategory, selectedWorkMode]);

  const handleToggleSave = (oppId) => {
    setSavedIds((prev) =>
      prev.includes(oppId) ? prev.filter((id) => id !== oppId) : [...prev, oppId]
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Opportunities"
        subtitle="Find internships, hackathons, workshops, and student programs worth your time."
      />

      {/* Search & Filter Header Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <Input
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search internships, hackathons, skills (e.g. React, Python)..."
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select
              options={workModes}
              value={selectedWorkMode}
              onChange={(e) => setSelectedWorkMode(e.target.value)}
              placeholder="Work Mode"
              className="w-full md:w-40"
            />
          </div>
        </div>

        {/* Categories Chips Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Active Filter Badges */}
        {(search || selectedCategory !== 'All' || selectedWorkMode !== 'All') && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                Category: {selectedCategory}
                <button onClick={() => setSelectedCategory('All')} className="hover:text-red-500">×</button>
              </span>
            )}
            {selectedWorkMode !== 'All' && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                Mode: {selectedWorkMode}
                <button onClick={() => setSelectedWorkMode('All')} className="hover:text-red-500">×</button>
              </span>
            )}
            {search && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                Search: "{search}"
                <button onClick={() => setSearch('')} className="hover:text-red-500">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedWorkMode('All');
                setSearch('');
              }}
              className="text-xs text-rose-500 hover:underline ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>



      {/* Opportunities Card Feed */}
      {loading ? (
        <LoadingState text="Fetching matching opportunities..." />
      ) : opportunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              isSavedState={savedIds.includes(opp.id)}
              onToggleSave={handleToggleSave}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Compass}
          title="No matching opportunities found"
          description="Try broadening your search query or removing category & work mode filters."
          actionLabel="Reset Filters"
          onAction={() => {
            setSelectedCategory('All');
            setSelectedWorkMode('All');
            setSearch('');
          }}
        />
      )}
    </div>
  );
}
