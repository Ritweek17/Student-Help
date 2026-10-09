/**
 * GitHub Intelligence API Service
 * 
 * Centralized client for communicating with the CareerOS Express GitHub intelligence endpoints.
 * Handles fetching proof of work, triggering synchronizations, and managing disconnection.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class GitHubApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR', rateLimit = null) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.code = code;
    this.rateLimit = rateLimit;
  }
}

/**
 * Extracts username from standard GitHub URLs or handles.
 * 
 * @param {string} url - GitHub URL or username
 * @returns {string} GitHub username
 */
export function extractGitHubUsername(url) {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (trimmed.startsWith('@')) {
    trimmed = trimmed.slice(1);
  }
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[0] ? parts[0].replace(/^@/, '') : '';
  } catch {
    return trimmed.replace(/^@/, '');
  }
}

/**
 * Normalizes and parses API response, converting errors to human-friendly messages.
 * 
 * @param {Response} response - Fetch response
 * @param {string} defaultErrorMessage - Default fallback error message
 * @returns {Promise<Object>} JSON response payload
 */
async function handleResponse(response, defaultErrorMessage) {
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.ok && data?.success !== false) {
    return data;
  }

  const status = response.status;
  const rawMessage = data?.message;
  const rateLimit = data?.rateLimit || null;

  if (status === 401) {
    throw new GitHubApiError(
      'Your session has expired. Please sign in again.',
      401,
      'UNAUTHORIZED'
    );
  }

  if (status === 400) {
    const friendlyMessage = rawMessage || 'Invalid GitHub profile link. Please check your GitHub profile URL.';
    throw new GitHubApiError(friendlyMessage, 400, 'BAD_REQUEST');
  }

  if (status === 404) {
    const friendlyMessage = rawMessage || 'GitHub profile not found. Please verify the username exists on GitHub.';
    throw new GitHubApiError(friendlyMessage, 404, 'NOT_FOUND');
  }

  if (status === 429) {
    const retryAfter = rateLimit?.retryAfter;
    const friendlyMessage = retryAfter
      ? `GitHub sync was performed recently. Please wait ${retryAfter}s before refreshing again.`
      : (rawMessage || 'Rate limit exceeded. Please wait a moment before retrying.');
    throw new GitHubApiError(friendlyMessage, 429, 'RATE_LIMIT_EXCEEDED', rateLimit);
  }

  if (status === 504) {
    throw new GitHubApiError(
      'GitHub request timed out. Please check your internet connection and try again.',
      504,
      'TIMEOUT'
    );
  }

  if (status === 502) {
    throw new GitHubApiError(
      'Unable to connect to GitHub. Please check your internet connection and try again.',
      502,
      'NETWORK_ERROR'
    );
  }

  if (status >= 500) {
    throw new GitHubApiError(
      rawMessage || defaultErrorMessage || 'GitHub service is temporarily unavailable. Please try again later.',
      status,
      'SERVER_ERROR'
    );
  }

  throw new GitHubApiError(
    rawMessage || defaultErrorMessage || 'An unexpected error occurred while communicating with GitHub.',
    status,
    'API_ERROR'
  );
}

/**
 * Retrieves cached GitHub proof of work evidence without calling external GitHub API.
 * 
 * @param {string} token - Authenticated user session token
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{ success: boolean, evidence: Object }>}
 */
export async function getGitHubEvidence(token, signal) {
  if (!token) {
    throw new GitHubApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/intelligence/github/evidence`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Something went wrong while loading GitHub evidence.');
  } catch (error) {
    if (error instanceof GitHubApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new GitHubApiError('Unable to load GitHub evidence. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Synchronizes public repositories and detects skills for the authenticated user.
 * 
 * @param {string} token - Authenticated user session token
 * @param {Object} [options] - Optional sync configuration (e.g. { force: true })
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{ success: boolean, cached: boolean, evidence: Object }>}
 */
export async function syncGitHubEvidence(token, options = {}, signal) {
  if (!token) {
    throw new GitHubApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/intelligence/github/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
      signal,
    });

    return await handleResponse(response, 'Something went wrong while syncing GitHub profile.');
  } catch (error) {
    if (error instanceof GitHubApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new GitHubApiError('Unable to sync GitHub profile. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Disconnects GitHub proof-of-work evidence and resets cached proof.
 * 
 * @param {string} token - Authenticated user session token
 * @param {Object} [options] - Options
 * @param {boolean} [options.clearLink=false] - Whether to also clear profile.professionalLinks.github
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{ success: boolean, message: string, linkPreserved: boolean }>}
 */
export async function disconnectGitHubEvidence(token, options = {}, signal) {
  if (!token) {
    throw new GitHubApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  const queryParams = options.clearLink ? '?clearLink=true' : '';

  try {
    const response = await fetch(`${API_BASE_URL}/api/intelligence/github/disconnect${queryParams}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Something went wrong while disconnecting GitHub.');
  } catch (error) {
    if (error instanceof GitHubApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new GitHubApiError('Unable to disconnect GitHub. Please try again.', 0, 'NETWORK_ERROR');
  }
}
