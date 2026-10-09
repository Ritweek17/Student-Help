import React, { useState } from 'react';
import {
  Github,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
  Unlink,
  GitFork,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { extractGitHubUsername } from '../../services/githubApi';

/**
 * Format timestamp safely for UI display.
 */
function formatSyncTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Format repository updated date.
 */
function formatRepoDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Aggregate unique repositories with their linked detected skills.
 */
function aggregateRepositories(detectedSkills = []) {
  const repoMap = new Map();

  for (const skill of detectedSkills) {
    const skillName = skill.displayName || skill.canonicalKey;
    const repos = Array.isArray(skill.repositories) ? skill.repositories : [];

    for (const repo of repos) {
      if (!repo || !repo.name) continue;
      const key = repo.url || repo.name;
      if (!repoMap.has(key)) {
        repoMap.set(key, {
          name: repo.name,
          url: repo.url,
          primaryLanguage: repo.primaryLanguage || null,
          updatedAt: repo.updatedAt || null,
          isFork: Boolean(repo.isFork),
          linkedSkills: [skillName],
        });
      } else {
        const existing = repoMap.get(key);
        if (!existing.linkedSkills.includes(skillName)) {
          existing.linkedSkills.push(skillName);
        }
      }
    }
  }

  // Sort by updatedAt descending, then name ascending
  return Array.from(repoMap.values()).sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return a.name.localeCompare(b.name);
  });
}

/**
 * GitHubProofCard
 * 
 * Reusable CareerOS component displaying verified public GitHub proof of work,
 * detected skills, demonstrated repository evidence, and sync controls.
 */
export function GitHubProofCard({
  githubUrl = '',
  evidence = null,
  isLoading = false,
  isSyncing = false,
  syncError = null,
  onSync,
  onDisconnect,
  onSaveUrl,
  className = '',
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [inputError, setInputError] = useState('');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [clearLinkOnDisconnect, setClearLinkOnDisconnect] = useState(false);
  const [showAllRepos, setShowAllRepos] = useState(false);

  // Normalize connected state
  const hasUrl = Boolean(githubUrl && githubUrl.trim());
  const username = (
    evidence?.username ||
    extractGitHubUsername(githubUrl) ||
    ''
  ).trim();

  const syncStatus = isSyncing
    ? 'syncing'
    : syncError
    ? 'failed'
    : evidence?.syncStatus || (hasUrl ? 'idle' : 'not_connected');

  const isSynced = syncStatus === 'synced' || Boolean(evidence?.syncedAt);
  const detectedSkills = Array.isArray(evidence?.detectedSkills) ? evidence.detectedSkills : [];
  const publicRepoCount = typeof evidence?.publicRepoCount === 'number'
    ? evidence.publicRepoCount
    : 0;
  const topLanguages = Array.isArray(evidence?.topLanguages) ? evidence.topLanguages : [];
  const lastSyncedFormatted = formatSyncTime(evidence?.syncedAt);

  // Repository evidence compilation
  const repositories = aggregateRepositories(detectedSkills);
  const displayedRepos = showAllRepos ? repositories : repositories.slice(0, 4);

  // Handle URL connect submit
  const handleConnectSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setInputError('Please enter a GitHub profile URL or username.');
      return;
    }
    setInputError('');
    if (onSaveUrl) {
      onSaveUrl(trimmed);
    }
  };

  // Handle Disconnect Confirm
  const handleConfirmDisconnect = () => {
    setShowDisconnectModal(false);
    if (onDisconnect) {
      onDisconnect({ clearLink: clearLinkOnDisconnect });
    }
  };

  // 1. Initial Loading State
  if (isLoading) {
    return (
      <Card padding="lg" className={`border-slate-200 dark:border-slate-800 space-y-4 ${className}`}>
        <div className="flex items-center gap-3 text-slate-500 py-6 justify-center text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-slate-900 dark:text-slate-100" />
          <span className="font-medium">Loading GitHub proof of work...</span>
        </div>
      </Card>
    );
  }

  // 2. STATE A: NOT CONNECTED
  if (!hasUrl && syncStatus !== 'synced') {
    return (
      <Card
        padding="lg"
        className={`border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs ${className}`}
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center shrink-0">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                GitHub Proof of Work
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified developer evidence from your public activity
              </p>
            </div>
          </div>
          <Badge variant="neutral" size="sm">Not Connected</Badge>
        </div>

        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Connect your public GitHub profile to show verified proof of work.
          </p>

          <form onSubmit={handleConnectSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="github-profile-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                GitHub Profile URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="github-profile-input"
                  type="text"
                  placeholder="https://github.com/username"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    if (inputError) setInputError('');
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="GitHub Profile URL or Username"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSyncing}
                  icon={isSyncing ? Loader2 : Github}
                  aria-label="Save and sync GitHub profile"
                >
                  {isSyncing ? 'Connecting...' : 'Connect & Sync'}
                </Button>
              </div>
              {inputError && (
                <p className="text-rose-500 text-[11px] mt-1 font-medium">{inputError}</p>
              )}
            </div>
          </form>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2 text-slate-500 dark:text-slate-400 text-xs">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>CareerOS currently analyzes public repositories only.</span>
          </div>
        </div>
      </Card>
    );
  }

  // 3. MAIN CARD HEADER (For Connected States: B, C, D, E)
  const profileHref = githubUrl.startsWith('http') ? githubUrl : `https://github.com/${username}`;

  return (
    <Card
      padding="lg"
      className={`border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center shrink-0">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                GitHub Proof of Work
              </h3>
              {syncStatus === 'synced' && (
                <Badge variant="success" size="sm">Synced</Badge>
              )}
              {syncStatus === 'syncing' && (
                <Badge variant="primary" size="sm">Syncing...</Badge>
              )}
              {syncStatus === 'failed' && (
                <Badge variant="danger" size="sm">Sync Failed</Badge>
              )}
              {syncStatus === 'idle' && (
                <Badge variant="neutral" size="sm">Not Synced</Badge>
              )}
            </div>
            {username && (
              <a
                href={profileHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 mt-0.5"
                aria-label={`View ${username} profile on GitHub (opens in new tab)`}
              >
                {`@${username}`}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant={syncStatus === 'synced' ? 'outline' : 'primary'}
            onClick={() => onSync && onSync()}
            disabled={isSyncing}
            icon={isSyncing ? Loader2 : RefreshCw}
            aria-label={isSyncing ? 'Syncing GitHub evidence' : isSynced ? 'Refresh GitHub proof of work' : 'Sync GitHub'}
          >
            {isSyncing ? 'Syncing...' : isSynced ? 'Refresh Proof' : 'Sync GitHub'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDisconnectModal(true)}
            disabled={isSyncing}
            icon={Unlink}
            aria-label="Disconnect GitHub evidence"
            title="Disconnect GitHub"
          >
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        </div>
      </div>

      {/* STATE D: SYNCING BANNER */}
      {isSyncing && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5"
        >
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Analyzing public repositories & detecting verified technical skills...</span>
        </div>
      )}

      {/* STATE E: FAILED BANNER */}
      {syncError && !isSyncing && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{syncError}</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                Previously cached evidence (if any) is preserved below.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 shrink-0"
            onClick={() => onSync && onSync()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* STATE B: CONNECTED BUT UNSYNCED */}
      {!isSynced && !isSyncing && !syncError && (
        <div className="space-y-3 py-2">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Info className="w-4 h-4 text-indigo-500" />
              <span>Evidence has not been synced yet</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your public GitHub profile URL is saved. Click "Sync GitHub" above to analyze your public repositories and extract verified skills for opportunity matching.
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            CareerOS currently analyzes public repositories only.
          </p>
        </div>
      )}

      {/* STATE C: SYNCED (OR PRESERVED EVIDENCE ON FAILED/SYNCING) */}
      {(isSynced || (evidence?.syncedAt && (syncError || isSyncing))) && (
        <div className="space-y-4 pt-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Public Repos
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
                {publicRepoCount}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Verified Skills
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
                {detectedSkills.length}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Last Synced
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate mt-1">
                {lastSyncedFormatted || 'Recently'}
              </span>
            </div>
          </div>

          {/* Top Languages (if present) */}
          {topLanguages.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Primary Languages:
              </span>
              {topLanguages.map((lang, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}

          {/* Detected Skills Section */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Detected Skills ({detectedSkills.length})
            </span>

            {detectedSkills.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No technical skills detected from public repository languages or topics yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detectedSkills.map((skill, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-semibold"
                  >
                    <span>{skill.displayName || skill.canonicalKey}</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-medium tracking-tight">
                      <Github className="w-2.5 h-2.5 shrink-0" />
                      GitHub Verified
                    </span>
                    {skill.repoCount > 1 && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({skill.repoCount} repos)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Repository Evidence List */}
          {repositories.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Demonstrated Repositories ({repositories.length})
                </span>
                {repositories.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRepos(!showAllRepos)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                    aria-label={showAllRepos ? 'Show fewer repositories' : 'Show all repositories'}
                  >
                    {showAllRepos ? (
                      <>
                        <span>Show fewer</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>View all ({repositories.length})</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {displayedRepos.map((repo, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 truncate"
                          aria-label={`View repository ${repo.name} on GitHub (opens in new tab)`}
                        >
                          <span className="truncate">{repo.name}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>

                        {repo.primaryLanguage && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {repo.primaryLanguage}
                          </span>
                        )}

                        {repo.isFork && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-0.5">
                            <GitFork className="w-2.5 h-2.5" />
                            Fork
                          </span>
                        )}
                      </div>

                      {/* Linked detected skills */}
                      {repo.linkedSkills?.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-400">Demonstrates:</span>
                          <span>{repo.linkedSkills.join(', ')}</span>
                        </div>
                      )}

                      {repo.updatedAt && (
                        <span className="text-[11px] text-slate-400 block">
                          Updated {formatRepoDate(repo.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400 pt-1">
            CareerOS currently analyzes public repositories only.
          </p>
        </div>
      )}

      {/* DISCONNECT CONFIRMATION MODAL */}
      {showDisconnectModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Unlink className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 id="disconnect-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                  Disconnect GitHub Evidence?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  This will clear cached repository proof of work and detected GitHub skills from your profile.
                </p>
              </div>
            </div>

            {/* Checkbox to also remove URL */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={clearLinkOnDisconnect}
                  onChange={(e) => setClearLinkOnDisconnect(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                    Also remove GitHub profile link from profile
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    If unchecked, your GitHub profile URL will be preserved on your profile.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDisconnectModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleConfirmDisconnect}
              >
                Confirm Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
