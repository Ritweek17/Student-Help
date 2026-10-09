import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { User } from '../../src/models/User.js';
import { Profile } from '../../src/models/Profile.js';
import { createTestUser } from '../helpers/auth.helper.js';
import {
  extractGitHubUsernameFromUrl,
  syncGitHubForUser,
  getGitHubEvidenceForUser,
  disconnectGitHubForUser,
  GITHUB_CACHE_TTL_MS,
  GITHUB_SYNC_COOLDOWN_MS,
} from '../../src/services/intelligence/github-sync.service.js';

describe('GitHub Sync Service & Profile Extension (Phase 11E — Deterministic / Offline)', () => {
  let testUser;
  let testProfile;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([User.init(), Profile.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const auth = await createTestUser('gh_sync', 'student');
    testUser = auth.user;

    testProfile = await Profile.create({
      userId: testUser._id,
      personal: { firstName: 'Alice', lastName: 'Dev' },
      professionalLinks: {
        github: 'https://github.com/alice-dev',
      },
    });
  });

  // -------------------------------------------------------------
  // 1. URL Username Extraction & Security Validation
  // -------------------------------------------------------------
  describe('extractGitHubUsernameFromUrl() Validation & Security', () => {
    it('extracts canonical username from standard https URLs', () => {
      expect(extractGitHubUsernameFromUrl('https://github.com/octocat')).toBe('octocat');
      expect(extractGitHubUsernameFromUrl('https://www.github.com/octocat')).toBe('octocat');
      expect(extractGitHubUsernameFromUrl('https://github.com/octocat/')).toBe('octocat');
      expect(extractGitHubUsernameFromUrl('  https://github.com/alice-99  ')).toBe('alice-99');
    });

    it('rejects insecure http URLs', () => {
      expect(() => extractGitHubUsernameFromUrl('http://github.com/octocat')).toThrow(
        'GitHub profile URL must use https protocol'
      );
    });

    it('rejects foreign or phishing domains', () => {
      expect(() => extractGitHubUsernameFromUrl('https://gitlab.com/octocat')).toThrow(
        'GitHub profile URL must be on github.com'
      );
      expect(() => extractGitHubUsernameFromUrl('https://github.evil.com/octocat')).toThrow(
        'GitHub profile URL must be on github.com'
      );
      expect(() => extractGitHubUsernameFromUrl('https://notgithub.com/octocat')).toThrow(
        'GitHub profile URL must be on github.com'
      );
    });

    it('rejects extra hostile path components like repositories or settings', () => {
      expect(() => extractGitHubUsernameFromUrl('https://github.com/octocat/repo')).toThrow(
        'GitHub profile URL must point directly to a user profile'
      );
      expect(() => extractGitHubUsernameFromUrl('https://github.com/octocat/repo/extra')).toThrow(
        'GitHub profile URL must point directly to a user profile'
      );
    });

    it('rejects URLs with query parameters or hash fragments', () => {
      expect(() => extractGitHubUsernameFromUrl('https://github.com/octocat?tab=repos')).toThrow(
        'GitHub profile URL must not contain query parameters or fragments'
      );
      expect(() => extractGitHubUsernameFromUrl('https://github.com/octocat#overview')).toThrow(
        'GitHub profile URL must not contain query parameters or fragments'
      );
    });

    it('rejects empty paths or custom ports', () => {
      expect(() => extractGitHubUsernameFromUrl('https://github.com/')).toThrow(
        'GitHub profile URL must point directly to a user profile'
      );
      expect(() => extractGitHubUsernameFromUrl('https://github.com:8080/octocat')).toThrow(
        'Custom ports are not allowed in GitHub profile URLs'
      );
    });

    it('rejects malformed usernames embedded in URL', () => {
      expect(() => extractGitHubUsernameFromUrl('https://github.com/-leading')).toThrow(
        'Invalid GitHub username in profile URL'
      );
      expect(() => extractGitHubUsernameFromUrl('https://github.com/trailing-')).toThrow(
        'Invalid GitHub username in profile URL'
      );
    });
  });

  // -------------------------------------------------------------
  // 2. Profile Model Schema & Backward Compatibility
  // -------------------------------------------------------------
  describe('Profile Model Schema & Backward Compatibility', () => {
    it('loads existing profiles without githubEvidence gracefully', async () => {
      // Create a profile without specifying githubEvidence
      const legacyProfile = await Profile.create({
        userId: new mongoose.Types.ObjectId(),
        personal: { firstName: 'Legacy', lastName: 'User' },
      });

      const fetched = await Profile.findById(legacyProfile._id);
      expect(fetched).toBeDefined();
      expect(fetched.githubEvidence).toBeDefined();
      expect(fetched.githubEvidence.syncStatus).toBe('idle');
      expect(fetched.githubEvidence.detectedSkills).toEqual([]);
    });

    it('validates complete githubEvidence structure with skills and repositories', async () => {
      testProfile.githubEvidence = {
        username: 'alice-dev',
        syncedAt: new Date(),
        publicRepoCount: 5,
        topLanguages: ['TypeScript', 'Python'],
        detectedSkills: [
          {
            canonicalKey: 'typescript',
            displayName: 'TypeScript',
            category: 'languages',
            repoCount: 2,
            repositories: [
              {
                name: 'ts-backend',
                url: 'https://github.com/alice-dev/ts-backend',
                isFork: false,
                primaryLanguage: 'TypeScript',
                updatedAt: new Date(),
              },
            ],
          },
        ],
        syncStatus: 'synced',
        lastError: null,
      };

      await testProfile.save();
      const updated = await Profile.findById(testProfile._id);

      expect(updated.githubEvidence.username).toBe('alice-dev');
      expect(updated.githubEvidence.syncStatus).toBe('synced');
      expect(updated.githubEvidence.detectedSkills).toHaveLength(1);
      expect(updated.githubEvidence.detectedSkills[0].canonicalKey).toBe('typescript');
      expect(updated.githubEvidence.detectedSkills[0].repositories[0].name).toBe('ts-backend');
    });

    it('rejects invalid syncStatus enum values in Mongoose validation', async () => {
      testProfile.set('githubEvidence.syncStatus', 'unsupported_status');

      await expect(testProfile.save()).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------
  // 3. syncGitHubForUser() Sync & Caching Policies
  // -------------------------------------------------------------
  describe('syncGitHubForUser() Sync & Cache Logic', () => {
    const mockUserPayload = { login: 'alice-dev', public_repos: 3 };
    const mockReposPayload = [
      {
        name: 'cloud-api',
        language: 'TypeScript',
        fork: false,
        topics: ['docker', 'mongodb'],
        pushed_at: '2026-09-01T00:00:00Z',
      },
    ];

    it('throws 400 when profile has no GitHub URL configured', async () => {
      testProfile.professionalLinks.github = undefined;
      await testProfile.save();

      await expect(syncGitHubForUser(testUser._id)).rejects.toMatchObject({
        statusCode: 400,
        code: 'GITHUB_LINK_MISSING',
      });
    });

    it('fetches, normalizes, and stores evidence when cache is empty', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify(mockUserPayload),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify(mockReposPayload),
        });

      const outcome = await syncGitHubForUser(testUser._id, { fetchFn: mockFetch });

      expect(outcome.cached).toBe(false);
      expect(outcome.evidence.username).toBe('alice-dev');
      expect(outcome.evidence.syncStatus).toBe('synced');
      expect(outcome.evidence.detectedSkills.length).toBeGreaterThan(0);

      const dbProfile = await Profile.findById(testProfile._id);
      expect(dbProfile.githubEvidence.syncStatus).toBe('synced');
      expect(dbProfile.githubEvidence.detectedSkills).toHaveLength(3); // typescript, docker, mongodb
    });

    it('returns cached evidence when within fresh TTL and force is not set', async () => {
      // Seed fresh evidence synced 5 minutes ago
      testProfile.githubEvidence = {
        username: 'alice-dev',
        syncedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        publicRepoCount: 3,
        topLanguages: ['TypeScript'],
        detectedSkills: [{ canonicalKey: 'typescript', displayName: 'TypeScript', repoCount: 1 }],
        syncStatus: 'synced',
        lastError: null,
      };
      await testProfile.save();

      const mockFetch = vi.fn();
      const outcome = await syncGitHubForUser(testUser._id, { fetchFn: mockFetch });

      expect(outcome.cached).toBe(true);
      expect(outcome.evidence.username).toBe('alice-dev');
      expect(mockFetch).not.toHaveBeenCalled(); // Cached!
    });

    it('enforces 60-second cooldown on consecutive forced syncs', async () => {
      // Seed evidence synced 20 seconds ago
      testProfile.githubEvidence = {
        username: 'alice-dev',
        syncedAt: new Date(Date.now() - 20 * 1000), // 20s ago
        syncStatus: 'synced',
      };
      await testProfile.save();

      await expect(
        syncGitHubForUser(testUser._id, { force: true, skipCooldown: false })
      ).rejects.toMatchObject({
        statusCode: 429,
        code: 'COOLDOWN_ACTIVE',
      });
    });

    it('preserves existing evidence when GitHub API fails', async () => {
      // Pre-existing valid evidence
      testProfile.githubEvidence = {
        username: 'alice-dev',
        syncedAt: new Date('2026-09-01'),
        publicRepoCount: 1,
        topLanguages: ['Go'],
        detectedSkills: [{ canonicalKey: 'go', displayName: 'Go', repoCount: 1 }],
        syncStatus: 'synced',
        lastError: null,
      };
      await testProfile.save();

      // GitHub returns 503
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        text: async () => 'Service Unavailable',
      });

      await expect(
        syncGitHubForUser(testUser._id, { force: true, skipCooldown: true, fetchFn: mockFetch })
      ).rejects.toThrow();

      const refreshed = await Profile.findById(testProfile._id);
      expect(refreshed.githubEvidence.syncStatus).toBe('failed');
      expect(refreshed.githubEvidence.lastError).toContain('503');
      // CRITICAL: Stale skills are NOT wiped out on transient failure
      expect(refreshed.githubEvidence.detectedSkills).toHaveLength(1);
      expect(refreshed.githubEvidence.detectedSkills[0].canonicalKey).toBe('go');
    });

    it('atomically replaces stale evidence upon successful sync', async () => {
      // Pre-existing evidence with Go
      testProfile.githubEvidence = {
        username: 'alice-dev',
        syncedAt: new Date('2026-09-01'),
        publicRepoCount: 1,
        topLanguages: ['Go'],
        detectedSkills: [{ canonicalKey: 'go', displayName: 'Go', repoCount: 1 }],
        syncStatus: 'synced',
      };
      await testProfile.save();

      const newRepos = [
        { name: 'rust-service', language: 'Rust', fork: false, topics: [] },
      ];

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify({ login: 'alice-dev', public_repos: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify(newRepos),
        });

      const outcome = await syncGitHubForUser(testUser._id, {
        force: true,
        skipCooldown: true,
        fetchFn: mockFetch,
      });

      expect(outcome.cached).toBe(false);
      expect(outcome.evidence.detectedSkills).toHaveLength(1);
      expect(outcome.evidence.detectedSkills[0].canonicalKey).toBe('rust'); // replaced Go with Rust
    });
  });

  // -------------------------------------------------------------
  // 4. getGitHubEvidenceForUser() & disconnectGitHubForUser()
  // -------------------------------------------------------------
  describe('getGitHubEvidenceForUser() & disconnectGitHubForUser()', () => {
    it('returns clean not_connected object when no evidence exists', async () => {
      const evidence = await getGitHubEvidenceForUser(testUser._id);

      expect(evidence.syncStatus).toBe('not_connected');
      expect(evidence.username).toBeNull();
      expect(evidence.detectedSkills).toEqual([]);
    });

    it('returns cached evidence when present', async () => {
      testProfile.githubEvidence = {
        username: 'alice-dev',
        syncStatus: 'synced',
        detectedSkills: [{ canonicalKey: 'python', displayName: 'Python', repoCount: 1 }],
      };
      await testProfile.save();

      const evidence = await getGitHubEvidenceForUser(testUser._id);
      expect(evidence.username).toBe('alice-dev');
      expect(evidence.syncStatus).toBe('synced');
    });

    it('disconnects evidence while preserving profile link by default', async () => {
      testProfile.githubEvidence = {
        username: 'alice-dev',
        syncStatus: 'synced',
        detectedSkills: [{ canonicalKey: 'python', displayName: 'Python', repoCount: 1 }],
      };
      await testProfile.save();

      const result = await disconnectGitHubForUser(testUser._id, { clearLink: false });

      expect(result.disconnected).toBe(true);
      expect(result.linkPreserved).toBe(true);

      const updated = await Profile.findById(testProfile._id);
      expect(updated.githubEvidence.syncStatus).toBe('not_connected');
      expect(updated.githubEvidence.username).toBe('');
      expect(updated.professionalLinks.github).toBe('https://github.com/alice-dev'); // Preserved!
    });

    it('clears profile link when clearLink is true', async () => {
      const result = await disconnectGitHubForUser(testUser._id, { clearLink: true });

      expect(result.disconnected).toBe(true);
      expect(result.linkPreserved).toBe(false);

      const updated = await Profile.findById(testProfile._id);
      expect(updated.professionalLinks.github).toBeUndefined();
    });
  });
});
