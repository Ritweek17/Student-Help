import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, Plus, ArrowRight, ExternalLink } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LearningTrackCard } from '../../components/cards/LearningTrackCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchLearningTracks, fetchLearningResources, fetchRecommendedNext } from '../../services/mockApi';

export function LearningPage() {
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState([]);
  const [resources, setResources] = useState([]);
  const [recommendedNext, setRecommendedNext] = useState([]);

  useEffect(() => {
    async function loadLearningData() {
      try {
        const [trackData, resData, recData] = await Promise.all([
          fetchLearningTracks(),
          fetchLearningResources(),
          fetchRecommendedNext()
        ]);
        setTracks(trackData);
        setResources(resData);
        setRecommendedNext(recData);
      } catch (err) {
        console.error('Error fetching learning hub:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLearningData();
  }, []);

  if (loading) {
    return <LoadingState text="Loading Learning Hub & Track Progress..." />;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <PageHeader
        title="Learning Hub"
        subtitle="Track course playlists, documentation guides, DSA sheets, and recommended next topics."
        action={
          <Button icon={Plus} onClick={() => alert('Phase 1 demo UI: Add Learning Track placeholder.')}>
            Add Learning Track
          </Button>
        }
      />

      {/* Recommended Next Topics Section */}
      <Card padding="lg" className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-900/60 border-indigo-800/60 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold font-heading">Recommended Next Sequence</h3>
          <Badge variant="primary" size="sm">Phase 1 AI Architecture</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {recommendedNext.map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-900/60 space-y-1">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                {item.track}
              </span>
              <h4 className="text-sm font-bold text-white">{item.title}</h4>
              <p className="text-xs text-slate-300">{item.reason}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Active Learning Tracks */}
      <div>
        <SectionHeader title="Active Learning Tracks" subtitle="Your current course & skill progress" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tracks.map((track) => (
            <LearningTrackCard key={track.id} track={track} />
          ))}
        </div>
      </div>

      {/* Learning Resources */}
      <div>
        <SectionHeader title="Featured Learning Resources" subtitle="Playlists, Documentation, & Practice sheets" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((res) => (
            <Card key={res.id} padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="primary" size="sm">{res.type}</Badge>
                <span className="text-xs text-slate-400 font-medium">{res.provider}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{res.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{res.description}</p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">{res.itemCount} Topics</span>
                <a href={res.url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                  Open Source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
