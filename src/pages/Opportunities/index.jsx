import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Compass,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { OpportunityCard } from '../../components/cards/OpportunityCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../context/AuthContext';
import * as opportunityApi from '../../services/opportunityApi';

const CATEGORY_MAP = {
  All: 'All',
  Internships: 'internship',
  Hackathons: 'hackathon',
  Workshops: 'workshop',
  Meetups: 'meetup',
  Conferences: 'conference',
  Expos: 'expo',
  'Open Source': 'open_source',
  Competitions: 'competition',
  Fellowships: 'fellowship',
  Scholarships: 'scholarship',
  'Tech Talks': 'tech_talk',
  'Student Programs': 'student_program',
};

const WORK_MODE_MAP = {
  All: 'All',
  Remote: 'remote',
  Hybrid: 'hybrid',
  'On-site': 'onsite',
  Online: 'online',
};

const SORT_OPTIONS = [
  { value: 'deadline_asc', label: 'Deadline: Soonest' },
  { value: 'newest', label: 'Newest Posted' },
  { value: 'featured', label: 'Featured First' },
  { value: 'event_asc', label: 'Event Date: Soonest' },
  { value: 'oldest', label: 'Oldest Posted' },
];

export function OpportunitiesPage() {
  const { token, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 0 });

  // Filters & State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWorkMode, setSelectedWorkMode] = useState('All');
  const [selectedSort, setSelectedSort] = useState('deadline_asc');
  const [page, setPage] = useState(1);

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on new search
    }, 350);

    return () => clearTimeout(handler);
  }, [search]);

  // Main Fetch Effect with AbortController for race condition safety
  const loadOpportunitiesData = async (abortSignal) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: 12,
      sort: selectedSort,
    };

    if (debouncedSearch.trim()) {
      params.q = debouncedSearch.trim();
    }

    if (selectedCategory !== 'All' && CATEGORY_MAP[selectedCategory]) {
      params.type = CATEGORY_MAP[selectedCategory];
    }

    if (selectedWorkMode !== 'All' && WORK_MODE_MAP[selectedWorkMode]) {
      params.workMode = WORK_MODE_MAP[selectedWorkMode];
    }

    try {
      const response = await opportunityApi.getOpportunities(params, token, abortSignal);
      setOpportunities(response.opportunities || []);
      setPagination(response.pagination || { page: 1, limit: 12, total: 0, pages: 0 });
    } catch (err) {
      if (err.name === 'AbortError') return; // Ignore cancelled requests
      if (err.status === 401) {
        logout();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Unable to load opportunities. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadOpportunitiesData(controller.signal);
    return () => controller.abort();
  }, [token, debouncedSearch, selectedCategory, selectedWorkMode, selectedSort, page]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleWorkModeChange = (mode) => {
    setSelectedWorkMode(mode);
    setPage(1);
  };

  const handleSortChange = (sortVal) => {
    setSelectedSort(sortVal);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedCategory('All');
    setSelectedWorkMode('All');
    setSelectedSort('deadline_asc');
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Opportunities"
        subtitle="Find verified internships, hackathons, workshops, and student programs worth your time."
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
              options={['All', 'Remote', 'Hybrid', 'On-site', 'Online']}
              value={selectedWorkMode}
              onChange={(e) => handleWorkModeChange(e.target.value)}
              placeholder="Work Mode"
              className="w-full md:w-40"
            />

            <div className="w-full md:w-48">
              <Select
                options={SORT_OPTIONS.map((s) => s.label)}
                value={SORT_OPTIONS.find((s) => s.value === selectedSort)?.label || 'Deadline: Soonest'}
                onChange={(e) => {
                  const found = SORT_OPTIONS.find((s) => s.label === e.target.value);
                  if (found) handleSortChange(found.value);
                }}
                icon={ArrowUpDown}
              />
            </div>
          </div>
        </div>

        {/* Categories Chips Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {Object.keys(CATEGORY_MAP).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Active Filter Badges */}
        {(search || selectedCategory !== 'All' || selectedWorkMode !== 'All' || selectedSort !== 'deadline_asc') && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs flex-wrap">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                Category: {selectedCategory}
                <button onClick={() => handleCategoryChange('All')} className="hover:text-rose-500 ml-1">×</button>
              </span>
            )}
            {selectedWorkMode !== 'All' && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                Mode: {selectedWorkMode}
                <button onClick={() => handleWorkModeChange('All')} className="hover:text-rose-500 ml-1">×</button>
              </span>
            )}
            {search && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                Search: "{search}"
                <button onClick={() => setSearch('')} className="hover:text-rose-500 ml-1">×</button>
              </span>
            )}
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-500 hover:underline ml-2 font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Main Body */}
      {error ? (
        <div className="p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
              Unable to Load Opportunities
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">{error}</p>
          </div>
          <Button size="sm" icon={RefreshCw} onClick={() => loadOpportunitiesData()}>
            Retry Loading
          </Button>
        </div>
      ) : loading ? (
        <LoadingState text="Fetching matching opportunities..." />
      ) : opportunities.length > 0 ? (
        <div className="space-y-6">
          {/* Grid Feed */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp._id || opp.id}
                opportunity={opp}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Showing Page <span className="font-bold text-slate-900 dark:text-white">{pagination.page}</span> of{' '}
                <span className="font-bold text-slate-900 dark:text-white">{pagination.pages}</span> ({pagination.total} opportunities found)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronRight}
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => Math.min(p + 1, pagination.pages))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Compass}
          title="No matching opportunities found"
          description="Try broadening your search query or removing category & work mode filters."
          actionLabel="Reset Filters"
          onAction={handleClearFilters}
        />
      )}
    </div>
  );
}
