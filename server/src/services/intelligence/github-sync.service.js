/**
 * CareerOS GitHub Proof of Work Sync Service (Phase 11E — V1)
 * 
 * Orchestrates extracting a student's GitHub username from their profile,
 * querying the public GitHub REST API, normalizing repository skills,
 * enforcing caching/cooldown policies, and persisting structured evidence.
 * 
 * Rules:
 * - 100% deterministic and offline-testable.
 * - Extracts username from profile.professionalLinks.github (source of truth).
 * - Enforces strict URL validation (HTTPS, github.com only, no query/fragment/traversal).
 * - Implements on-demand sync with caching (1-hour TTL) and cooldown (60s).
 * - Stale evidence is preserved on temporary sync failures (5xx, 429, timeouts).
 * - Successful syncs replace stale evidence atomically.
 */

import { Profile } from '../../models/Profile.js';
import { getUser, getUserRepositories, isValidGitHubUsername } from './github.client.js';
import { extractGitHubSkillEvidence } from './github-evidence.service.js';

export const GITHUB_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour fresh cache TTL
export const GITHUB_SYNC_COOLDOWN_MS = 60 * 1000;   // 60 seconds minimum cooldown between fresh syncs

/**
 * Validates and extracts a canonical GitHub username from a profile URL.
 * 
 * Accepted forms:
 * - https://github.com/username
 * - https://www.github.com/username
 * - With optional trailing slash
 * 
 * Rejects:
 * - Non-https protocols
 * - Non-github domains
 * - Extra path segments (e.g. repos, tabs)
 * - Queries and fragments
 * - Malformed usernames according to GitHub specifications
 * 
 * @param {string} rawUrl - Candidate profile URL
 * @returns {string} Validated username
 * @throws {Error} If URL is invalid or insecure
 */
export function extractGitHubUsernameFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    const error = new Error('GitHub profile URL is required');
    error.statusCode = 400;
    error.code = 'INVALID_URL';
    throw error;
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    const error = new Error('Invalid GitHub profile URL format');
    error.statusCode = 400;
    error.code = 'INVALID_URL';
    throw error;
  }

  if (parsed.protocol !== 'https:') {
    const error = new Error('GitHub profile URL must use https protocol');
    error.statusCode = 400;
    error.code = 'INSECURE_PROTOCOL';
    throw error;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    const error = new Error('GitHub profile URL must be on github.com');
    error.statusCode = 400;
    error.code = 'INVALID_DOMAIN';
    throw error;
  }

  if (parsed.port) {
    const error = new Error('Custom ports are not allowed in GitHub profile URLs');
    error.statusCode = 400;
    error.code = 'CUSTOM_PORT_FORBIDDEN';
    throw error;
  }

  if (parsed.search || parsed.hash) {
    const error = new Error('GitHub profile URL must not contain query parameters or fragments');
    error.statusCode = 400;
    error.code = 'QUERY_NOT_ALLOWED';
    throw error;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) {
    const error = new Error('GitHub profile URL must point directly to a user profile (e.g. https://github.com/username)');
    error.statusCode = 400;
    error.code = 'INVALID_PATH';
    throw error;
  }

  const candidateUsername = segments[0];
  if (!isValidGitHubUsername(candidateUsername)) {
    const error = new Error(`Invalid GitHub username in profile URL: "${candidateUsername}"`);
    error.statusCode = 400;
    error.code = 'INVALID_USERNAME';
    throw error;
  }

  return candidateUsername;
}

/**
 * Returns a standardized empty / not-connected evidence object.
 * 
 * @returns {Object} Clean not-connected evidence
 */
export function createNotConnectedEvidence() {
  return {
    username: null,
    syncedAt: null,
    publicRepoCount: 0,
    topLanguages: [],
    detectedSkills: [],
    syncStatus: 'not_connected',
    lastError: null,
  };
}

/**
 * Performs on-demand synchronization of GitHub proof of work for a given user.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID
 * @param {Object} [options] - Sync options
 * @param {boolean} [options.force=false] - Force re-fetch even if cache is fresh
 * @param {boolean} [options.skipCooldown=false] - Skip cooldown check (for testing)
 * @param {Function} [options.fetchFn] - Custom fetch implementation for testing
 * @returns {Promise<{ cached: boolean, evidence: Object }>} Sync outcome
 */
export async function syncGitHubForUser(userId, options = {}) {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  const githubUrl = profile.professionalLinks?.github;
  if (!githubUrl || typeof githubUrl !== 'string' || !githubUrl.trim()) {
    const error = new Error('GitHub profile URL is not set on your profile. Please add it to your professional links first.');
    error.statusCode = 400;
    error.code = 'GITHUB_LINK_MISSING';
    throw error;
  }

  const username = extractGitHubUsernameFromUrl(githubUrl);
  const now = Date.now();
  const lastSynced = profile.githubEvidence?.syncedAt
    ? new Date(profile.githubEvidence.syncedAt).getTime()
    : null;

  // 1. Fresh Cache Policy: If synced within TTL and not forcing, return cached evidence
  if (
    !options.force &&
    profile.githubEvidence?.syncStatus === 'synced' &&
    profile.githubEvidence?.username === username &&
    lastSynced &&
    now - lastSynced < GITHUB_CACHE_TTL_MS
  ) {
    return {
      cached: true,
      evidence: profile.githubEvidence,
    };
  }

  // 2. Cooldown Enforcement: Prevent rapid hammering of GitHub API
  if (
    lastSynced &&
    now - lastSynced < GITHUB_SYNC_COOLDOWN_MS &&
    !options.skipCooldown
  ) {
    const retryAfterSeconds = Math.max(1, Math.ceil((GITHUB_SYNC_COOLDOWN_MS - (now - lastSynced)) / 1000));
    const error = new Error(`GitHub sync was performed recently. Please wait ${retryAfterSeconds}s before refreshing again.`);
    error.statusCode = 429;
    error.code = 'COOLDOWN_ACTIVE';
    error.rateLimit = { retryAfter: retryAfterSeconds };
    throw error;
  }

  // 3. Execute Fetch & Evidence Normalization
  try {
    const userRes = await getUser(username, options);
    const repoRes = await getUserRepositories(username, { perPage: 30, ...options });

    const evidence = extractGitHubSkillEvidence(userRes.user, repoRes.repositories, {
      syncedAt: new Date(),
    });

    // Atomically replace evidence
    profile.githubEvidence = {
      username: evidence.username || username,
      syncedAt: evidence.syncedAt,
      publicRepoCount: evidence.publicRepoCount,
      topLanguages: evidence.topLanguages,
      detectedSkills: evidence.detectedSkills,
      syncStatus: 'synced',
      lastError: null,
    };

    await profile.save();

    return {
      cached: false,
      evidence: profile.githubEvidence,
    };
  } catch (err) {
    // Preserve prior successful evidence if present
    const hasPriorEvidence = Boolean(
      profile.githubEvidence &&
      Array.isArray(profile.githubEvidence.detectedSkills) &&
      profile.githubEvidence.detectedSkills.length > 0
    );

    profile.set('githubEvidence.syncStatus', 'failed');
    profile.set('githubEvidence.lastError', err?.message || 'GitHub sync failed');
    if (!hasPriorEvidence) {
      profile.set('githubEvidence.username', username);
    }

    await profile.save();

    throw err;
  }
}

/**
 * Retrieves the currently cached GitHub evidence for a user without making external API calls.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID
 * @returns {Promise<Object>} Cached evidence or not_connected descriptor
 */
export async function getGitHubEvidenceForUser(userId) {
  const profile = await Profile.findOne({ userId });
  if (!profile || !profile.githubEvidence || profile.githubEvidence.syncStatus === 'not_connected' || !profile.githubEvidence.username) {
    return createNotConnectedEvidence();
  }

  return profile.githubEvidence;
}

/**
 * Disconnects GitHub evidence for a user and resets evidence cache.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID
 * @param {Object} [options] - Options
 * @param {boolean} [options.clearLink=false] - Whether to also clear profile.professionalLinks.github
 * @returns {Promise<{ disconnected: boolean, linkPreserved: boolean }>} Disconnect outcome
 */
export async function disconnectGitHubForUser(userId, { clearLink = false } = {}) {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  profile.githubEvidence = {
    username: '',
    syncedAt: null,
    publicRepoCount: 0,
    topLanguages: [],
    detectedSkills: [],
    syncStatus: 'not_connected',
    lastError: null,
  };

  if (clearLink === true) {
    profile.set('professionalLinks.github', undefined);
  }

  await profile.save();

  return {
    disconnected: true,
    linkPreserved: !clearLink,
  };
}
