import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Compass } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { OpportunityCard } from '../../components/cards/OpportunityCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchSavedOpportunities } from '../../services/mockApi';

export function SavedPage() {
  const [loading, setLoading] = useState(true);
  const [savedOpportunities, setSavedOpportunities] = useState([]);
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    async function loadSaved() {
      try {
        const data = await fetchSavedOpportunities();
        setSavedOpportunities(data);
      } catch (err) {
        console.error('Error fetching saved:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSaved();
  }, []);

  const handleToggleSave = (oppId) => {
    setSavedOpportunities((prev) => prev.filter((item) => item.id !== oppId));
  };

  const tabs = [
    { id: 'All', label: 'All Saved', count: savedOpportunities.length },
    { id: 'Interested', label: 'Interested', count: savedOpportunities.filter((o) => !o.applicationStatus).length },
    { id: 'Applied', label: 'Applied', count: savedOpportunities.filter((o) => o.applicationStatus === 'Applied').length },
    { id: 'Expired', label: 'Expired / Closed', count: 0 }
  ];

  const filteredOpps = savedOpportunities.filter((opp) => {
    if (activeTab === 'Interested') return !opp.applicationStatus;
    if (activeTab === 'Applied') return opp.applicationStatus === 'Applied';
    if (activeTab === 'Expired') return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Saved Opportunities"
        subtitle="Keep track of bookmarked internships, hackathons, and fellowships."
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {loading ? (
        <LoadingState text="Fetching saved opportunities..." />
      ) : filteredOpps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOpps.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              isSavedState={true}
              onToggleSave={handleToggleSave}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bookmark}
          title="You haven't saved any opportunities yet"
          description="Click the bookmark icon on any opportunity card to save it to your personal list."
          actionLabel="Explore Opportunities Feed"
          onAction={() => window.location.href = '/opportunities'}
        />
      )}
    </div>
  );
}
