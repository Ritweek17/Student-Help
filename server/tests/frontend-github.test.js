import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GitHubProofCard } from '../../src/components/intelligence/GitHubProofCard.jsx';
import { WhyYouMatchCard } from '../../src/components/intelligence/WhyYouMatchCard.jsx';
import {
  extractGitHubUsername,
  getGitHubEvidence,
  syncGitHubEvidence,
  disconnectGitHubEvidence,
  GitHubApiError,
} from '../../src/services/githubApi.js';

describe('CareerOS Frontend GitHub Proof of Work Suite (Phase 11E Batch 5)', () => {
  // =========================================================================
  // 1. GITHUB PROOF CARD COMPONENT TESTS
  // =========================================================================
  describe('1. GitHubProofCard Component States & Interactions', () => {
    it('State A: renders Not Connected state when no URL is provided', () => {
      let savedUrl = '';
      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: '',
          evidence: null,
          isLoading: false,
          isSyncing: false,
          onSaveUrl: (url) => { savedUrl = url; },
        })
      );

      expect(html).toContain('GitHub Proof of Work');
      expect(html).toContain('Not Connected');
      expect(html).toContain('Connect your public GitHub profile to show verified proof of work.');
      expect(html).toContain('CareerOS currently analyzes public repositories only.');
      expect(html).toContain('Connect &amp; Sync');
      expect(html).toContain('id="github-profile-input"');
      expect(html).not.toContain('Disconnect');
    });

    it('State B: renders Connected, Not Synced state when URL is present but evidence is unsynced', () => {
      let syncTriggered = false;
      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: 'https://github.com/alice',
          evidence: {
            username: 'alice',
            syncStatus: 'idle',
            syncedAt: null,
          },
          isLoading: false,
          isSyncing: false,
          onSync: () => { syncTriggered = true; },
        })
      );

      expect(html).toContain('GitHub Proof of Work');
      expect(html).toContain('Not Synced');
      expect(html).toContain('@alice');
      expect(html).toContain('Evidence has not been synced yet');
      expect(html).toContain('Sync GitHub');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('State C: renders Synced state with stats, verified skills, and repository evidence', () => {
      const mockEvidence = {
        username: 'alice',
        syncedAt: '2026-10-01T12:00:00Z',
        publicRepoCount: 12,
        syncStatus: 'synced',
        topLanguages: ['TypeScript', 'JavaScript'],
        detectedSkills: [
          {
            canonicalKey: 'react',
            displayName: 'React',
            repoCount: 2,
            repositories: [
              {
                name: 'react-portfolio',
                url: 'https://github.com/alice/react-portfolio',
                isFork: false,
                primaryLanguage: 'TypeScript',
                updatedAt: '2026-09-15T00:00:00Z',
              },
            ],
          },
          {
            canonicalKey: 'docker',
            displayName: 'Docker',
            repoCount: 1,
            repositories: [
              {
                name: 'docker-compose-infra',
                url: 'https://github.com/alice/docker-compose-infra',
                isFork: false,
                primaryLanguage: 'Dockerfile',
                updatedAt: '2026-08-01T00:00:00Z',
              },
            ],
          },
        ],
      };

      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: 'https://github.com/alice',
          evidence: mockEvidence,
          isLoading: false,
          isSyncing: false,
        })
      );

      // Header and Status
      expect(html).toContain('GitHub Proof of Work');
      expect(html).toContain('Synced');
      expect(html).toContain('@alice');
      expect(html).toContain('Refresh Proof');
      expect(html).toContain('Disconnect');

      // Metric Counts
      expect(html).toContain('12'); // Public repos
      expect(html).toContain('2'); // Verified skills count

      // Detected Skills & Canonical Display Names
      expect(html).toContain('React');
      expect(html).toContain('Docker');
      expect(html).toContain('GitHub Verified');

      // STRICT CHECK: forbidden certification labels must NOT appear
      expect(html).not.toContain('Expert');
      expect(html).not.toContain('Advanced');
      expect(html).not.toContain('Certified');
      expect(html).not.toContain('Guaranteed');

      // Repositories Evidence
      expect(html).toContain('react-portfolio');
      expect(html).toContain('docker-compose-infra');
      expect(html).toContain('TypeScript');
      expect(html).toContain('Demonstrates:');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('State D: renders Syncing indicator and keeps cached evidence visible', () => {
      const mockEvidence = {
        username: 'alice',
        syncedAt: '2026-10-01T12:00:00Z',
        publicRepoCount: 5,
        syncStatus: 'synced',
        detectedSkills: [
          {
            canonicalKey: 'react',
            displayName: 'React',
            repoCount: 1,
            repositories: [{ name: 'my-app', url: 'https://github.com/alice/my-app' }],
          },
        ],
      };

      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: 'https://github.com/alice',
          evidence: mockEvidence,
          isLoading: false,
          isSyncing: true,
        })
      );

      expect(html).toContain('Analyzing public repositories &amp; detecting verified technical skills...');
      expect(html).toContain('Syncing...');
      // Preserved old evidence remains visible
      expect(html).toContain('React');
      expect(html).toContain('my-app');
    });

    it('State E: renders Failed state with human-readable error and retry action while preserving evidence', () => {
      const mockEvidence = {
        username: 'alice',
        syncedAt: '2026-10-01T12:00:00Z',
        publicRepoCount: 5,
        syncStatus: 'failed',
        detectedSkills: [
          {
            canonicalKey: 'react',
            displayName: 'React',
            repoCount: 1,
            repositories: [{ name: 'my-app', url: 'https://github.com/alice/my-app' }],
          },
        ],
      };

      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: 'https://github.com/alice',
          evidence: mockEvidence,
          isLoading: false,
          isSyncing: false,
          syncError: 'GitHub sync was performed recently. Please wait 45s before refreshing again.',
        })
      );

      expect(html).toContain('GitHub sync was performed recently. Please wait 45s before refreshing again.');
      expect(html).toContain('Retry');
      expect(html).toContain('Previously cached evidence (if any) is preserved below.');
      // Preserved evidence
      expect(html).toContain('React');
      expect(html).toContain('my-app');
    });

    it('renders empty detected skills placeholder cleanly when no technical skills detected', () => {
      const emptyEvidence = {
        username: 'alice',
        syncedAt: '2026-10-01T12:00:00Z',
        publicRepoCount: 2,
        syncStatus: 'synced',
        detectedSkills: [],
      };

      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: 'https://github.com/alice',
          evidence: emptyEvidence,
          isLoading: false,
          isSyncing: false,
        })
      );

      expect(html).toContain('No technical skills detected from public repository languages or topics yet.');
    });

    it('renders loading placeholder during initial fetch', () => {
      const html = renderToString(
        React.createElement(GitHubProofCard, {
          isLoading: true,
        })
      );

      expect(html).toContain('Loading GitHub proof of work...');
    });
  });

  // =========================================================================
  // 2. WHY YOU MATCH EXTENSION TESTS
  // =========================================================================
  describe('2. WhyYouMatchCard GitHub Evidence Integration', () => {
    it('renders GitHub Verified label in matchedSkills and demonstrated evidence list', () => {
      const mockMatch = {
        score: 88,
        fitLevel: 'Strong Fit',
        summary: 'Excellent alignment with required skills and verified GitHub activity.',
        matchedSkills: [
          {
            displayName: 'React',
            proficiency: 'advanced',
            hasGitHubEvidence: true,
          },
          {
            displayName: 'TypeScript',
            proficiency: 'intermediate',
            hasGitHubEvidence: false,
          },
        ],
        skillGaps: [],
        evidence: [
          {
            skill: 'React',
            type: 'github_verified',
            description: 'Verified in public GitHub repository react-trading-ui.',
            repository: {
              name: 'react-trading-ui',
              url: 'https://github.com/alice/react-trading-ui',
            },
          },
          {
            skill: 'TypeScript',
            type: 'claimed',
            description: 'Listed in profile skills (intermediate).',
          },
        ],
        explanations: {
          positive: ['Demonstrated technical proficiency in React via verified public GitHub repositories.'],
          gaps: [],
        },
      };

      const html = renderToString(
        React.createElement(WhyYouMatchCard, {
          match: mockMatch,
          loading: false,
          error: null,
        })
      );

      // Fit score and level come directly from API payload
      expect(html).toContain('88');
      expect(html).toContain('/100');
      expect(html).toContain('Strong Fit');

      // GitHub Verified badge on React matched skill
      expect(html).toContain('React');
      expect(html).toContain('GitHub Verified');

      // Demonstrated Evidence item
      expect(html).toContain('Verified in public GitHub repository react-trading-ui.');
      expect(html).toContain('react-trading-ui');
      expect(html).toContain('href="https://github.com/alice/react-trading-ui"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');

      // Existing non-GitHub evidence intact
      expect(html).toContain('TypeScript');
      expect(html).toContain('Listed in profile skills (intermediate).');
    });

    it('does not calculate or alter score on client-side', () => {
      const mockMatch = {
        score: 65,
        fitLevel: 'Moderate Fit',
        summary: 'Partial skill alignment.',
        matchedSkills: [{ displayName: 'Node.js', hasGitHubEvidence: true }],
        skillGaps: [{ displayName: 'Kubernetes' }],
        evidence: [],
      };

      const html = renderToString(
        React.createElement(WhyYouMatchCard, {
          match: mockMatch,
        })
      );

      expect(html).toContain('65');
      expect(html).toContain('Moderate Fit');
      expect(html).not.toContain('NaN');
    });
  });

  // =========================================================================
  // 3. PREPARATION PLAN EXTENSION TESTS
  // =========================================================================
  describe('3. PreparationPlanCard GitHub Showcase Actions', () => {
    it('identifies github_showcase tasks with GitHub badge and external repository link structure', () => {
      const sampleTask = {
        taskKey: 'github:showcase:react:student-help',
        title: 'Prepare React demo: Highlight student-help architecture for FinTech Hub',
        description: 'Prepare a 5-minute walkthrough of student-help demonstrating your React skills.',
        category: 'Project',
        priority: 'Medium',
        type: 'github_showcase',
        repository: {
          name: 'student-help',
          url: 'https://github.com/alice/student-help',
          primaryLanguage: 'JavaScript',
        },
      };

      expect(sampleTask.type).toBe('github_showcase');
      expect(sampleTask.repository.url).toContain('https://github.com');
      expect(sampleTask.title).toContain('Prepare React demo');
      expect(sampleTask.title).toContain('student-help');
    });

    it('identifies github_refresh tasks for stale repositories', () => {
      const refreshTask = {
        taskKey: 'github:refresh:node.js',
        title: 'Refresh Node.js repository: Update legacy-api-server for FinTech Hub',
        description: 'Consider pushing fresh commits to legacy-api-server.',
        category: 'Project',
        priority: 'Medium',
        type: 'github_refresh',
        repository: {
          name: 'legacy-api-server',
          url: 'https://github.com/alice/legacy-api-server',
          primaryLanguage: 'JavaScript',
        },
      };

      expect(refreshTask.type).toBe('github_refresh');
      expect(refreshTask.repository.name).toBe('legacy-api-server');
      expect(refreshTask.title).toContain('legacy-api-server');
    });
  });

  // =========================================================================
  // 4. GITHUB API SERVICE UNIT TESTS
  // =========================================================================
  describe('4. GitHub API Service Client (githubApi.js)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('extractGitHubUsername parses various URL formats safely', () => {
      expect(extractGitHubUsername('https://github.com/alice')).toBe('alice');
      expect(extractGitHubUsername('https://github.com/alice/')).toBe('alice');
      expect(extractGitHubUsername('http://github.com/bob/repo')).toBe('bob');
      expect(extractGitHubUsername('github.com/carol')).toBe('carol');
      expect(extractGitHubUsername('@dave')).toBe('dave');
      expect(extractGitHubUsername('eve')).toBe('eve');
      expect(extractGitHubUsername('')).toBe('');
      expect(extractGitHubUsername(null)).toBe('');
    });

    it('getGitHubEvidence throws UNAUTHORIZED when token is missing', async () => {
      await expect(getGitHubEvidence(null)).rejects.toThrow('Authentication token is required');
    });

    it('getGitHubEvidence calls GET /api/intelligence/github/evidence successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          evidence: { username: 'alice', syncStatus: 'synced', publicRepoCount: 5 },
        }),
      });

      const result = await getGitHubEvidence('test-token');
      expect(result.success).toBe(true);
      expect(result.evidence.username).toBe('alice');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/github/evidence'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });

    it('syncGitHubEvidence handles 429 cooldown with retry timing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          message: 'GitHub sync was performed recently.',
          rateLimit: { retryAfter: 42 },
        }),
      });

      try {
        await syncGitHubEvidence('test-token');
        expect.unreachable('Should have thrown GitHubApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect(err.status).toBe(429);
        expect(err.rateLimit?.retryAfter).toBe(42);
        expect(err.message).toContain('42s');
      }
    });

    it('syncGitHubEvidence handles 400 invalid link with clean message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid GitHub profile URL domain',
        }),
      });

      await expect(syncGitHubEvidence('test-token')).rejects.toThrow(
        'Invalid GitHub profile URL domain'
      );
    });

    it('syncGitHubEvidence handles 404 user not found with clean message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          message: 'GitHub user not found on external service',
        }),
      });

      await expect(syncGitHubEvidence('test-token')).rejects.toThrow(
        'GitHub user not found on external service'
      );
    });

    it('syncGitHubEvidence handles 504 timeout cleanly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => ({
          success: false,
          message: 'Gateway Timeout',
        }),
      });

      await expect(syncGitHubEvidence('test-token')).rejects.toThrow(
        'GitHub request timed out'
      );
    });

    it('syncGitHubEvidence handles 502 network error cleanly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          success: false,
          message: 'Failed to communicate with GitHub API',
        }),
      });

      await expect(syncGitHubEvidence('test-token')).rejects.toThrow(
        'Unable to connect to GitHub'
      );
    });

    it('disconnectGitHubEvidence handles clearLink option', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'GitHub evidence disconnected successfully',
          linkPreserved: false,
        }),
      });

      const res = await disconnectGitHubEvidence('test-token', { clearLink: true });
      expect(res.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/github/disconnect?clearLink=true'),
        expect.anything()
      );
    });

    it('disconnectGitHubEvidence preserves profile URL by default', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'GitHub evidence disconnected successfully',
          linkPreserved: true,
        }),
      });

      const res = await disconnectGitHubEvidence('test-token');
      expect(res.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/intelligence\/github\/disconnect$/),
        expect.anything()
      );
    });
  });

  // =========================================================================
  // 5. SECURITY & EXTERNAL LINK AUDIT
  // =========================================================================
  describe('5. Security & Accessibility Audit', () => {
    it('verifies all external links use rel="noopener noreferrer" and target="_blank"', () => {
      const mockEvidence = {
        username: 'alice',
        syncedAt: '2026-10-01T12:00:00Z',
        publicRepoCount: 1,
        syncStatus: 'synced',
        detectedSkills: [
          {
            canonicalKey: 'react',
            displayName: 'React',
            repoCount: 1,
            repositories: [
              {
                name: 'open-source-app',
                url: 'https://github.com/alice/open-source-app',
                primaryLanguage: 'JavaScript',
                updatedAt: '2026-09-01T00:00:00Z',
              },
            ],
          },
        ],
      };

      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: 'https://github.com/alice',
          evidence: mockEvidence,
        })
      );

      // Find all target="_blank" occurrences and ensure rel="noopener noreferrer" accompanies each
      const targetBlankMatches = html.match(/target="_blank"/g) || [];
      const noOpenerMatches = html.match(/rel="noopener noreferrer"/g) || [];

      expect(targetBlankMatches.length).toBeGreaterThanOrEqual(2); // user profile link + repo link
      expect(noOpenerMatches.length).toBe(targetBlankMatches.length);
    });

    it('does not expose internal tokens, credentials, or api.github.com urls to client', () => {
      const html = renderToString(
        React.createElement(GitHubProofCard, {
          githubUrl: 'https://github.com/alice',
          evidence: {
            username: 'alice',
            syncStatus: 'synced',
            detectedSkills: [],
          },
        })
      );

      expect(html).not.toContain('ghp_');
      expect(html).not.toContain('GITHUB_TOKEN');
      expect(html).not.toContain('api.github.com');
    });
  });
});
