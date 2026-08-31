import React, { useState } from 'react';
import { User, Sun, Moon, Bell, Shield, Sliders, Calendar, Code, ExternalLink, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useTheme } from '../../context/ThemeContext';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('Account');

  // Preference switches
  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [profilePublic, setProfilePublic] = useState(true);

  // Calendar Sync Architecture Settings (Phase 2 Placeholders)
  const [syncDirection, setSyncDirection] = useState('two_way');
  const [syncReminders, setSyncReminders] = useState(true);

  const tabs = [
    { id: 'Account', label: 'Account', icon: User },
    { id: 'Appearance', label: 'Appearance', icon: Sun },
    { id: 'Calendar', label: 'Calendar Sync Architecture', icon: Calendar },
    { id: 'Platforms', label: 'Connected Platforms', icon: Code },
    { id: 'Notifications', label: 'Notifications', icon: Bell },
    { id: 'Preferences', label: 'Preferences', icon: Sliders },
    { id: 'Privacy', label: 'Privacy', icon: Shield }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Settings"
        subtitle="Manage account credentials, appearance themes, and sync integration settings."
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ACCOUNT SETTINGS */}
      {activeTab === 'Account' && (
        <Card padding="lg" className="space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
            Account Information
          </h3>

          <div className="space-y-4">
            <Input label="Student Name" defaultValue="Alex Chen" />
            <Input label="University Email" defaultValue="alex.chen.demo@university.edu" disabled />
            <Input label="Phone Number (Placeholder)" defaultValue="+1 (555) 019-2834" />
            <Select label="Timezone" options={['Asia/Kolkata (IST +5:30)', 'UTC', 'America/New_York (EST)']} />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button onClick={() => alert('Phase 1 demo UI: Settings saved.')}>
              Save Account Changes
            </Button>
          </div>
        </Card>
      )}

      {/* APPEARANCE */}
      {activeTab === 'Appearance' && (
        <Card padding="lg" className="space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
            Theme Preference
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                theme === 'dark'
                  ? 'border-indigo-600 bg-indigo-950/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">Dark Mode (Default)</span>
                <Moon className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xs text-slate-400">Deep SaaS palette engineered for night coders.</p>
            </div>

            <div
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                theme === 'light'
                  ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Light Mode</span>
                <Sun className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xs text-slate-500">High-contrast clean light theme.</p>
            </div>
          </div>
        </Card>
      )}

      {/* CALENDAR SYNC ARCHITECTURE */}
      {activeTab === 'Calendar' && (
        <Card padding="lg" className="space-y-6 max-w-3xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Google Calendar Integration Architecture
              </h3>
              <Badge variant="warning" size="sm">Phase 2 Future Integration</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              CareerOS is your primary workspace. Google Calendar acts as an optional synchronization layer on top of your CareerOS Calendar.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                📅
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Google Calendar</span>
                  <Badge variant="default" size="sm">Not Connected</Badge>
                </div>
                <span className="text-xs text-slate-500">Sync CareerOS deadlines and contest reminders</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => alert('Future Phase 2 Integration: Google OAuth & Calendar API connection layer.')}
            >
              Connect Google Calendar
            </Button>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Synchronization Preferences</h4>
            <Select
              label="Sync Direction"
              options={[
                { value: 'two_way', label: 'Two-Way Sync (CareerOS ↔ Google Calendar)' },
                { value: 'export_only', label: 'CareerOS → Google Calendar Only' },
                { value: 'import_only', label: 'Google Calendar → CareerOS Only' }
              ]}
              value={syncDirection}
              onChange={(e) => setSyncDirection(e.target.value)}
            />
            <Switch
              label="Sync Deadline Reminders"
              description="Automatically export interview rounds and hackathon submission deadlines."
              checked={syncReminders}
              onChange={(e) => setSyncReminders(e.target.checked)}
            />
          </div>
        </Card>
      )}

      {/* CONNECTED PLATFORMS */}
      {activeTab === 'Platforms' && (
        <Card padding="lg" className="space-y-6 max-w-2xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Coding & Developer Platforms
              </h3>
              <Badge variant="info" size="sm">UI Architecture Only</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Future platform APIs will fetch problem counts and contest ratings automatically.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { name: 'LeetCode', handle: '@alexchen_demo', connected: true },
              { name: 'CodeChef', handle: '@alexchen_demo', connected: true },
              { name: 'Codeforces', handle: 'Not Connected', connected: false },
              { name: 'GitHub', handle: '@alex-chen-demo', connected: true },
              { name: 'AtCoder', handle: 'Not Connected', connected: false }
            ].map((plat, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-medium">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">{plat.name}</span>
                  <span className="text-slate-500">{plat.handle}</span>
                </div>
                <Badge variant={plat.connected ? 'success' : 'default'} size="sm">
                  {plat.connected ? 'Connected' : 'Connect'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* NOTIFICATIONS */}
      {activeTab === 'Notifications' && (
        <Card padding="lg" className="space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
            Notification Rules
          </h3>

          <div className="space-y-4">
            <Switch
              label="Closing Deadline Alerts"
              description="Receive notification triggers 48 hours before saved opportunities close."
              checked={deadlineAlerts}
              onChange={(e) => setDeadlineAlerts(e.target.checked)}
            />
            <Switch
              label="Daily Target Reminder"
              description="Daily evening prompt if targets remain pending in Daily Tracker."
              checked={emailDigest}
              onChange={(e) => setEmailDigest(e.target.checked)}
            />
          </div>
        </Card>
      )}

      {/* PREFERENCES */}
      {activeTab === 'Preferences' && (
        <Card padding="lg" className="space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
            Feed Preferences
          </h3>

          <div className="space-y-4">
            <Select label="Preferred Work Mode" options={['Remote', 'Hybrid', 'On-site', 'Any']} />
            <Select label="Primary Target Category" options={['Internships', 'Hackathons', 'Open Source', 'Workshops']} />
          </div>
        </Card>
      )}

      {/* PRIVACY */}
      {activeTab === 'Privacy' && (
        <Card padding="lg" className="space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
            Privacy & Profile Visibility
          </h3>

          <div className="space-y-4">
            <Switch
              label="Public Student Profile"
              description="Allow prospective recruiters to view your verified projects and skills."
              checked={profilePublic}
              onChange={(e) => setProfilePublic(e.target.checked)}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
