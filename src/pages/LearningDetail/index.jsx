import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Sparkles, ExternalLink, Play } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { Select } from '../../components/ui/Select';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchLearningTrackById, fetchLearningItems, fetchLearningResources } from '../../services/mockApi';

export function LearningDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState(null);
  const [items, setItems] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    async function loadTrackDetail() {
      setLoading(true);
      try {
        const [trackData, itemData, resData] = await Promise.all([
          fetchLearningTrackById(id),
          fetchLearningItems(id),
          fetchLearningResources(id)
        ]);
        setTrack(trackData);
        setItems(itemData);
        setResources(resData);
      } catch (err) {
        console.error('Error loading track detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTrackDetail();
  }, [id]);

  const handleStatusChange = (itemId, newStatus) => {
    setItems((prevItems) => {
      const updated = prevItems.map((item) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      );
      const completedCount = updated.filter(
        (i) => i.status === 'Completed' || i.status === 'Practiced' || i.status === 'Mastered'
      ).length;
      const newProgress = Math.round((completedCount / updated.length) * 100);

      setTrack((prevTrack) => ({
        ...prevTrack,
        progress: newProgress,
        completedItems: completedCount
      }));

      return updated;
    });
  };

  if (loading || !track) {
    return <LoadingState text="Loading learning track details..." />;
  }

  const statusOptions = ['Not Started', 'Learning', 'Completed', 'Practiced', 'Mastered'];

  const statusBadges = {
    'Not Started': 'default',
    Learning: 'info',
    Completed: 'primary',
    Practiced: 'warning',
    Mastered: 'success'
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      <div>
        <Link to="/learning" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Learning Hub
        </Link>
      </div>

      {/* Header Banner */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="text-3xl p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 shrink-0">
              {track.image || '📖'}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="primary">{track.category}</Badge>
                <Badge variant="success">{track.status}</Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-heading">
                {track.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {track.description}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 space-y-1">
          <Progress value={track.progress} showLabel color="indigo" size="md" />
          <span className="text-xs text-slate-400 font-medium block">
            {track.completedItems} / {items.length} topics completed ({track.progress}%)
          </span>
        </div>
      </Card>

      {/* Resources & Lesson Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Lesson Checklist */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Lesson Topics & Exercises ({items.length})
              </h3>
              <span className="text-xs text-slate-400 font-medium">Local state interactable</span>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate block">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> {item.duration}
                      </span>
                      <Badge variant={statusBadges[item.status]} size="sm">
                        {item.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Status Dropdown Trigger */}
                  <div className="shrink-0 w-36">
                    <Select
                      options={statusOptions}
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Resources & Next Suggested */}
        <div className="space-y-6">
          <Card padding="lg" className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
              Track Resources
            </h3>
            {resources.map((res) => (
              <div key={res.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <Badge variant="primary" size="sm">{res.type}</Badge>
                  <span className="text-[11px] text-slate-400">{res.provider}</span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100">{res.title}</h4>
                <a href={res.url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                  Open Resource <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </Card>

          <Card padding="lg" className="bg-slate-900 text-white space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-bold font-heading">Recommended Next</h3>
            </div>
            <p className="text-xs text-slate-300 font-semibold">{track.nextSuggestedTopic}</p>
            <p className="text-xs text-slate-400">Complete current lesson exercises to unlock advanced project building.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
