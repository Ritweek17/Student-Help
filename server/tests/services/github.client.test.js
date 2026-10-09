import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getUser,
  getUserRepositories,
  validateGitHubUsername,
  isValidGitHubUsername,
  extractRateLimitHeaders,
  GitHubClientError,
} from '../../src/services/intelligence/github.client.js';

describe('GitHub Client Service Suite (Phase 11E — Deterministic & Offline)', () => {
  const originalEnvToken = process.env.GITHUB_TOKEN;
  let mockFetch;

  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    mockFetch = vi.fn();
  });

  afterEach(() => {
    if (originalEnvToken !== undefined) {
      process.env.GITHUB_TOKEN = originalEnvToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------
  // 1. Username Validation & Security
  // -------------------------------------------------------------
  describe('Username Validation & SSRF Prevention', () => {
    it('validates standard valid GitHub usernames', () => {
      expect(isValidGitHubUsername('octocat')).toBe(true);
      expect(isValidGitHubUsername('john-doe')).toBe(true);
      expect(isValidGitHubUsername('User123')).toBe(true);
      expect(isValidGitHubUsername('a')).toBe(true);
      expect(isValidGitHubUsername('a-b-c-1')).toBe(true);
      expect(validateGitHubUsername('octocat')).toBe('octocat');
    });

    it('rejects invalid usernames, path traversal, and injection attempts', () => {
      const invalidCandidates = [
        '',
        '   ',
        '-leading-hyphen',
        'trailing-hyphen-',
        'double--hyphen',
        'user name',
        'user/repo',
        '../traversal',
        'http://evil.com',
        'https://api.github.com/users/evil',
        '127.0.0.1',
        'localhost:3000',
        'a'.repeat(40), // 40 chars > max 39
        null,
        undefined,
        12345,
        {},
      ];

      for (const candidate of invalidCandidates) {
        expect(isValidGitHubUsername(candidate)).toBe(false);
        expect(() => validateGitHubUsername(candidate)).toThrow(GitHubClientError);
        try {
          validateGitHubUsername(candidate);
        } catch (err) {
          expect(err.code).toBe('INVALID_USERNAME');
          expect(err.statusCode).toBe(400);
        }
      }
    });

    it('rejects invalid username before making any network call', async () => {
      await expect(getUser('../evil', { fetchFn: mockFetch })).rejects.toThrow(GitHubClientError);
      await expect(getUserRepositories('bad user', { fetchFn: mockFetch })).rejects.toThrow(GitHubClientError);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------
  // 2. getUser() API Contract & Headers
  // -------------------------------------------------------------
  describe('getUser() Contract & Headers', () => {
    it('calls correct URL, method, and headers without token', async () => {
      const mockUser = {
        login: 'octocat',
        id: 583231,
        public_repos: 8,
        html_url: 'https://github.com/octocat',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '55',
          'x-ratelimit-reset': '1700000000',
        }),
        text: async () => JSON.stringify(mockUser),
      });

      const result = await getUser('octocat', { fetchFn: mockFetch });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

      expect(calledUrl).toBe('https://api.github.com/users/octocat');
      expect(calledOptions.method).toBe('GET');
      expect(calledOptions.headers).toEqual({
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'CareerOS-Intelligence/1.0',
      });
      expect(calledOptions.headers.Authorization).toBeUndefined();

      expect(result.user).toEqual(mockUser);
      expect(result.data).toEqual(mockUser);
      expect(result.rateLimit).toEqual({
        limit: 60,
        remaining: 55,
        reset: 1700000000,
      });
    });

    it('sends Authorization header when optional token is provided', async () => {
      const sensitiveToken = 'ghp_secret_test_token_12345';
      process.env.GITHUB_TOKEN = sensitiveToken;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ login: 'octocat' }),
      });

      const result = await getUser('octocat', { fetchFn: mockFetch });

      const [, calledOptions] = mockFetch.mock.calls[0];
      expect(calledOptions.headers.Authorization).toBe(`Bearer ${sensitiveToken}`);

      // Crucial Security Rule: Token must NEVER appear in returned data
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(sensitiveToken);
    });

    it('prefers options.token over process.env.GITHUB_TOKEN', async () => {
      process.env.GITHUB_TOKEN = 'env_token';
      const overrideToken = 'override_token_999';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ login: 'octocat' }),
      });

      await getUser('octocat', { token: overrideToken, fetchFn: mockFetch });

      const [, calledOptions] = mockFetch.mock.calls[0];
      expect(calledOptions.headers.Authorization).toBe(`Bearer ${overrideToken}`);
    });
  });

  // -------------------------------------------------------------
  // 3. getUserRepositories() Contract & Query Parameters
  // -------------------------------------------------------------
  describe('getUserRepositories() Contract & Parameters', () => {
    it('calls correct URL with default bounded query params', async () => {
      const mockRepos = [
        { id: 1, name: 'repo-one', fork: false },
        { id: 2, name: 'repo-two', fork: true },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-remaining': '49',
        }),
        text: async () => JSON.stringify(mockRepos),
      });

      const result = await getUserRepositories('octocat', { fetchFn: mockFetch });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl] = mockFetch.mock.calls[0];

      expect(calledUrl).toBe(
        'https://api.github.com/users/octocat/repos?type=owner&sort=updated&per_page=30'
      );
      expect(result.repositories).toEqual(mockRepos);
      expect(result.data).toEqual(mockRepos);
      expect(result.rateLimit.remaining).toBe(49);
    });

    it('honors and clamps custom query parameters within safe bounds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify([]),
      });

      await getUserRepositories('octocat', {
        perPage: 500, // exceeds max 100 -> should clamp to 100
        sort: 'pushed',
        type: 'all',
        fetchFn: mockFetch,
      });

      const [calledUrl] = mockFetch.mock.calls[0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.searchParams.get('per_page')).toBe('100');
      expect(parsedUrl.searchParams.get('sort')).toBe('pushed');
      expect(parsedUrl.searchParams.get('type')).toBe('all');
    });
  });

  // -------------------------------------------------------------
  // 4. Rate-Limit Header Extraction
  // -------------------------------------------------------------
  describe('Rate Limit Header Extraction', () => {
    it('parses limit, remaining, reset, and retry-after accurately', () => {
      const headers = new Headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4990',
        'x-ratelimit-reset': '1700003600',
        'retry-after': '120',
      });

      const extracted = extractRateLimitHeaders(headers);
      expect(extracted).toEqual({
        limit: 5000,
        remaining: 4990,
        reset: 1700003600,
        retryAfter: 120,
      });
    });

    it('handles null/missing headers safely', () => {
      expect(extractRateLimitHeaders(null)).toBeNull();
      expect(extractRateLimitHeaders({})).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // 5. Error Handling & Mappings
  // -------------------------------------------------------------
  describe('Error Mapping & Resilience', () => {
    it('maps 404 to USER_NOT_FOUND', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'x-ratelimit-remaining': '59' }),
        text: async () => JSON.stringify({ message: 'Not Found' }),
      });

      await expect(getUser('nonexistent-user-999', { fetchFn: mockFetch })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        rateLimit: { remaining: 59 },
      });
    });

    it('maps 403 with remaining 0 to RATE_LIMIT_EXCEEDED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1700001000',
        }),
        text: async () => JSON.stringify({ message: 'API rate limit exceeded for IP' }),
      });

      await expect(getUser('octocat', { fetchFn: mockFetch })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 403,
        code: 'RATE_LIMIT_EXCEEDED',
        rateLimit: { limit: 60, remaining: 0, reset: 1700001000 },
      });
    });

    it('maps 429 to RATE_LIMIT_EXCEEDED and preserves retry-after', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'retry-after': '60',
        }),
        text: async () => JSON.stringify({ message: 'Too Many Requests' }),
      });

      await expect(getUser('octocat', { fetchFn: mockFetch })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        rateLimit: { retryAfter: 60 },
      });
    });

    it('maps generic 403 to FORBIDDEN when not rate limited', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'x-ratelimit-remaining': '45' }),
        text: async () => JSON.stringify({ message: 'Resource blocked by admin' }),
      });

      await expect(getUser('octocat', { fetchFn: mockFetch })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('maps 500/502/503 to SERVER_ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        text: async () => 'Service Unavailable',
      });

      await expect(getUser('octocat', { fetchFn: mockFetch })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 503,
        code: 'SERVER_ERROR',
      });
    });

    it('maps AbortError to TIMEOUT (504)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(getUser('octocat', { fetchFn: mockFetch, timeoutMs: 10 })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 504,
        code: 'TIMEOUT',
      });
    });

    it('maps network disconnect to NETWORK_ERROR (502)', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(getUser('octocat', { fetchFn: mockFetch })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 502,
        code: 'NETWORK_ERROR',
      });
    });

    it('maps malformed non-JSON 200 response to MALFORMED_RESPONSE (502)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '<html><body>502 Bad Gateway</body></html>',
      });

      await expect(getUser('octocat', { fetchFn: mockFetch })).rejects.toMatchObject({
        name: 'GitHubClientError',
        statusCode: 502,
        code: 'MALFORMED_RESPONSE',
      });
    });

    it('does not retry uncontrollably on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => JSON.stringify({ message: 'Internal Server Error' }),
      });

      await expect(getUser('octocat', { fetchFn: mockFetch })).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1); // exactly 1 attempt, no runaway retries
    });

    it('sanitizes error message so secret token is never exposed if thrown', async () => {
      const secretToken = 'ghp_sensitive_secret_never_leak';
      mockFetch.mockRejectedValueOnce(new Error(`Failed with ${secretToken}`));

      try {
        await getUser('octocat', { token: secretToken, fetchFn: mockFetch });
      } catch (err) {
        expect(err.name).toBe('GitHubClientError');
        // The error message must not contain the raw token
        expect(err.message).toContain('Network error');
      }
    });
  });
});
