import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Settings, Filter } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { NotificationItem } from '../../components/cards/NotificationItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchNotifications } from '../../services/mockApi';

export function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');

  const categories = [
    'ALL',
    'DEADLINES',
    'INTERNSHIPS',
    'HACKATHONS',
    'WORKSHOPS & EVENTS',
    'APPLICATIONS',
    'LEARNING',
    'CALENDAR',
    'GOALS',
    'PRODUCTIVITY',
    'CODING CONTESTS',
    'SYSTEM'
  ];

  useEffect(() => {
    async function loadNotifs() {
      setLoading(true);
      try {
        const data = await fetchNotifications(activeCategory);
        setNotifications(data);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadNotifs();
  }, [activeCategory]);

  const handleToggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Notifications Center"
        subtitle="Section-wise alerts for closing deadlines, matching internships, contest reminders, and learning milestones."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" icon={CheckCheck} onClick={handleMarkAllRead}>
              Mark All as Read
            </Button>
          </div>
        }
      />

      {/* Category Pills Header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200 dark:border-slate-800">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState text="Loading section notifications..." />
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onToggleRead={handleToggleRead}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications in this section"
          description="You are all caught up! New alerts will appear here as deadlines approach."
        />
      )}
    </div>
  );
}
