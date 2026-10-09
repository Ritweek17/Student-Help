/**
 * CareerOS GitHub REST API Client (Phase 11E — V1)
 * 
 * Provides a lightweight, secure, and deterministic client for querying public
 * GitHub user profiles and public repositories.
 * 
 * Rules:
 * - Uses native Node.js fetch (offline mockable in tests).
 * - Enforces least-privilege (public data only, no user OAuth).
 * - Optional server-side GITHUB_TOKEN support for rate limit headroom.
 * - Strict username validation to prevent SSRF and injection.
 * - Parses and preserves rate-limit headers (remaining, limit, reset, retry-after).
 * - Deterministic timeout handling with AbortSignal.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_TIMEOUT_MS = 8000;
const GITHUB_USER_AGENT = 'CareerOS-Intelligence/1.0';
const GITHUB_API_VERSION = '2022-11-28';

/**
 * Validates a GitHub username according to official GitHub specification:
 * - May only contain alphanumeric characters or single hyphens.
 * - Cannot begin or end with a hyphen.
 * - Maximum length 39 characters.
 * - Minimum length 1 character.
 * 
 * @param {string} username - Candidate username
 * @returns {boolean} True if valid GitHub username
 */
export function isValidGitHubUsername(username) {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (!trimmed || trimmed.length > 39) return false;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(trimmed);
}

/**
 * Validates a username and returns the trimmed value, or throws a typed error.
 * 
 * @param {string} username - Candidate username
 * @returns {string} Cleaned username
 * @throws {GitHubClientError} If format is invalid
 */
export function validateGitHubUsername(username) {
  if (!isValidGitHubUsername(username)) {
    throw new GitHubClientError(
      `Invalid GitHub username format: "${typeof username === 'string' ? username.slice(0, 50) : typeof username}"`,
      { statusCode: 400, code: 'INVALID_USERNAME' }
    );
  }
  return username.trim();
}

/**
 * Typed Error class for GitHub API client errors.
 */
export class GitHubClientError extends Error {
  /**
   * @param {string} message - Human-readable error message (never containing secrets)
   * @param {Object} [options] - Error metadata
   * @param {number} [options.statusCode=500] - Associated HTTP status code
   * @param {string} [options.code='GITHUB_CLIENT_ERROR'] - Error classification code
   * @param {Object|null} [options.rateLimit=null] - Rate limit headers info
   * @param {Error|null} [options.cause=null] - Underlying error
   */
  constructor(message, { statusCode = 500, code = 'GITHUB_CLIENT_ERROR', rateLimit = null, cause = null } = {}) {
    super(message);
    this.name = 'GitHubClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.rateLimit = rateLimit;
    if (cause) this.cause = cause;
  }
}

/**
 * Safely extracts rate-limit information from response headers.
 * 
 * @param {Headers|Object} headers - Response headers
 * @returns {Object|null} Rate limit info or null
 */
export function extractRateLimitHeaders(headers) {
  if (!headers) return null;

  const getHeader = (name) => {
    if (typeof headers.get === 'function') {
      return headers.get(name);
    }
    return headers[name] || headers[name.toLowerCase()] || null;
  };

  const limit = getHeader('x-ratelimit-limit');
  const remaining = getHeader('x-ratelimit-remaining');
  const reset = getHeader('x-ratelimit-reset');
  const retryAfter = getHeader('retry-after');

  const info = {};
  if (limit !== null && limit !== undefined) info.limit = parseInt(limit, 10);
  if (remaining !== null && remaining !== undefined) info.remaining = parseInt(remaining, 10);
  if (reset !== null && reset !== undefined) info.reset = parseInt(reset, 10);
  if (retryAfter !== null && retryAfter !== undefined) info.retryAfter = parseInt(retryAfter, 10);

  return Object.keys(info).length > 0 ? info : null;
}

/**
 * Builds standard GitHub API headers.
 * Never includes token if empty or invalid.
 * 
 * @param {string|null} token - Optional server-side personal access token
 * @returns {Object} Headers map
 */
function buildRequestHeaders(token) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': GITHUB_USER_AGENT,
  };

  const effectiveToken = token || process.env.GITHUB_TOKEN;
  if (effectiveToken && typeof effectiveToken === 'string' && effectiveToken.trim()) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  return headers;
}

/**
 * Internal safe fetch wrapper executing requests against api.github.com.
 * 
 * @param {string} endpoint - Relative path (e.g. /users/octocat)
 * @param {Object} options - Request options
 * @returns {Promise<{ data: any, rateLimit: Object|null }>} Response data
 */
async function executeGitHubRequest(endpoint, options = {}) {
  const {
    token = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = globalThis.fetch,
  } = options;

  if (typeof fetchFn !== 'function') {
    throw new GitHubClientError('Global fetch is not available in current environment', {
      statusCode: 500,
      code: 'FETCH_UNAVAILABLE',
    });
  }

  const url = `${GITHUB_API_BASE}${endpoint}`;
  const headers = buildRequestHeaders(token);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new GitHubClientError(`GitHub request timed out after ${timeoutMs}ms`, {
        statusCode: 504,
        code: 'TIMEOUT',
      });
    }
    // Sanitize network errors: never expose token or authorization header in error
    throw new GitHubClientError(`Network error connecting to GitHub API: ${err?.message || 'Connection failed'}`, {
      statusCode: 502,
      code: 'NETWORK_ERROR',
      cause: err,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response) {
    throw new GitHubClientError('Network error connecting to GitHub API: no response received', {
      statusCode: 502,
      code: 'NETWORK_ERROR',
    });
  }

  const rateLimit = extractRateLimitHeaders(response.headers);

  // Parse body
  let data = null;
  const rawText = await response.text();
  if (rawText && rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      if (response.ok) {
        throw new GitHubClientError('Malformed JSON received from GitHub API', {
          statusCode: 502,
          code: 'MALFORMED_RESPONSE',
          rateLimit,
        });
      }
    }
  }

  if (!response.ok) {
    const errorMsg = data?.message || `GitHub API request failed with status ${response.status}`;

    if (response.status === 404) {
      throw new GitHubClientError(errorMsg || 'GitHub user or repository not found', {
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        rateLimit,
      });
    }

    if (response.status === 429 || (response.status === 403 && rateLimit?.remaining === 0)) {
      throw new GitHubClientError(errorMsg || 'GitHub API rate limit exceeded', {
        statusCode: response.status === 429 ? 429 : 403,
        code: 'RATE_LIMIT_EXCEEDED',
        rateLimit,
      });
    }

    if (response.status === 403) {
      throw new GitHubClientError(errorMsg || 'GitHub API access forbidden', {
        statusCode: 403,
        code: 'FORBIDDEN',
        rateLimit,
      });
    }

    if (response.status >= 500) {
      throw new GitHubClientError(`GitHub API service error (${response.status})`, {
        statusCode: response.status,
        code: 'SERVER_ERROR',
        rateLimit,
      });
    }

    throw new GitHubClientError(errorMsg, {
      statusCode: response.status,
      code: 'HTTP_ERROR',
      rateLimit,
    });
  }

  return {
    data,
    rateLimit,
  };
}

/**
 * Fetches public profile metadata for a given GitHub username.
 * 
 * @param {string} username - Validated GitHub username
 * @param {Object} [options] - Options (token, timeoutMs, fetchFn)
 * @returns {Promise<{ user: Object, data: Object, rateLimit: Object|null }>} User metadata
 */
export async function getUser(username, options = {}) {
  const cleanUsername = validateGitHubUsername(username);
  const result = await executeGitHubRequest(`/users/${encodeURIComponent(cleanUsername)}`, options);

  return {
    user: result.data,
    data: result.data,
    rateLimit: result.rateLimit,
  };
}

/**
 * Fetches public repositories for a given GitHub username.
 * Bounded to a single page suitable for V1 (default 30, maximum 100).
 * 
 * @param {string} username - Validated GitHub username
 * @param {Object} [options] - Options (type, sort, perPage, token, timeoutMs, fetchFn)
 * @returns {Promise<{ repositories: Array<Object>, data: Array<Object>, rateLimit: Object|null }>} Repositories
 */
export async function getUserRepositories(username, options = {}) {
  const cleanUsername = validateGitHubUsername(username);

  const perPage = Math.max(1, Math.min(100, Number(options.perPage) || 30));
  const sort = ['updated', 'created', 'pushed', 'full_name'].includes(options.sort)
    ? options.sort
    : 'updated';
  const type = ['owner', 'all', 'public', 'member'].includes(options.type)
    ? options.type
    : 'owner';

  const params = new URLSearchParams({
    type,
    sort,
    per_page: perPage.toString(),
  });

  const result = await executeGitHubRequest(
    `/users/${encodeURIComponent(cleanUsername)}/repos?${params.toString()}`,
    options
  );

  const repositories = Array.isArray(result.data) ? result.data : [];

  return {
    repositories,
    data: repositories,
    rateLimit: result.rateLimit,
  };
}
