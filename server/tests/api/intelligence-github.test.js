import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { User } from '../../src/models/User.js';
import { Profile } from '../../src/models/Profile.js';
import { createTestUser } from '../helpers/auth.helper.js';

describe('CareerOS GitHub Proof of Work API Suite — /api/intelligence/github', () => {
  let studentUser;
  let studentToken;
  let studentProfile;

  let otherStudentUser;
  let otherStudentToken;

  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([User.init(), Profile.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    globalThis.fetch = originalFetch;

    const studentAuth = await createTestUser('gh_api_student', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;

    studentProfile = await Profile.create({
      userId: studentUser._id,
      personal: { firstName: 'Sam', lastName: 'Student' },
      professionalLinks: {
        github: 'https://github.com/sam-student',
      },
    });

    const otherAuth = await createTestUser('gh_api_other', 'student');
    otherStudentUser = otherAuth.user;
    otherStudentToken = otherAuth.token;

    await Profile.create({
      userId: otherStudentUser._id,
      personal: { firstName: 'Other', lastName: 'Student' },
      professionalLinks: {
        github: 'https://github.com/other-student',
      },
    });
  });

  // -------------------------------------------------------------
  // 1. POST /api/intelligence/github/sync
  // -------------------------------------------------------------
  describe('POST /api/intelligence/github/sync', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).post('/api/intelligence/github/sync').send({});

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when profile does not have a GitHub URL configured', async () => {
      studentProfile.professionalLinks.github = undefined;
      await studentProfile.save();

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('GitHub profile URL is not set');
    });

    it('returns 400 when profile has a malformed GitHub URL', async () => {
      studentProfile.professionalLinks.github = 'https://gitlab.com/sam-student';
      await studentProfile.save();

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('github.com');
    });

    it('successfully syncs and normalizes skills upon valid GitHub response', async () => {
      const mockUser = { login: 'sam-student', public_repos: 2 };
      const mockRepos = [
        {
          name: 'react-app',
          language: 'TypeScript',
          fork: false,
          topics: ['react', 'tailwindcss'],
          pushed_at: '2026-09-01T00:00:00Z',
        },
      ];

      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify(mockUser),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify(mockRepos),
        });

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ force: true, skipCooldown: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cached).toBe(false);
      expect(res.body.evidence.username).toBe('sam-student');
      expect(res.body.evidence.syncStatus).toBe('synced');
      expect(res.body.evidence.detectedSkills.length).toBeGreaterThan(0);

      const skillKeys = res.body.evidence.detectedSkills.map((s) => s.canonicalKey);
      expect(skillKeys).toContain('typescript');
      expect(skillKeys).toContain('react');

      // Crucial Security Audit: GITHUB_TOKEN never appears in client response
      const rawText = JSON.stringify(res.body);
      expect(rawText).not.toContain('ghp_');
      expect(rawText).not.toContain('Authorization');
    });

    it('returns cached response when requested again without force', async () => {
      // Seed pre-existing fresh evidence
      studentProfile.githubEvidence = {
        username: 'sam-student',
        syncedAt: new Date(Date.now() - 5000), // 5 seconds ago
        publicRepoCount: 1,
        topLanguages: ['TypeScript'],
        detectedSkills: [{ canonicalKey: 'typescript', displayName: 'TypeScript', repoCount: 1 }],
        syncStatus: 'synced',
      };
      await studentProfile.save();

      globalThis.fetch = vi.fn(); // Should not be called!

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cached).toBe(true);
      expect(res.body.evidence.username).toBe('sam-student');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('maps GitHub 404 to HTTP 404 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => JSON.stringify({ message: 'Not Found' }),
      });

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ force: true, skipCooldown: true });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('maps GitHub rate limit 429/403 to HTTP 429 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '60' }),
        text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
      });

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ force: true, skipCooldown: true });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.rateLimit?.retryAfter).toBe(60);
    });

    it('maps network disconnect to HTTP 502 response', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ force: true, skipCooldown: true });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to communicate with GitHub API');
    });

    it('maps timeout to HTTP 504 response', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      globalThis.fetch = vi.fn().mockRejectedValueOnce(abortError);

      const res = await request(app)
        .post('/api/intelligence/github/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ force: true, skipCooldown: true });

      expect(res.status).toBe(504);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('timed out');
    });
  });

  // -------------------------------------------------------------
  // 2. GET /api/intelligence/github/evidence
  // -------------------------------------------------------------
  describe('GET /api/intelligence/github/evidence', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/intelligence/github/evidence');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns clean not_connected payload when no evidence exists', async () => {
      const res = await request(app)
        .get('/api/intelligence/github/evidence')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.evidence.syncStatus).toBe('not_connected');
      expect(res.body.evidence.username).toBeNull();
      expect(res.body.evidence.detectedSkills).toEqual([]);
    });

    it('returns cached evidence without making any network calls', async () => {
      studentProfile.githubEvidence = {
        username: 'sam-student',
        syncedAt: new Date(),
        publicRepoCount: 3,
        topLanguages: ['Python'],
        detectedSkills: [{ canonicalKey: 'python', displayName: 'Python', repoCount: 2 }],
        syncStatus: 'synced',
      };
      await studentProfile.save();

      globalThis.fetch = vi.fn();

      const res = await request(app)
        .get('/api/intelligence/github/evidence')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.evidence.username).toBe('sam-student');
      expect(res.body.evidence.syncStatus).toBe('synced');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('isolates evidence per user (authorization check)', async () => {
      studentProfile.githubEvidence = {
        username: 'sam-student',
        syncStatus: 'synced',
        detectedSkills: [{ canonicalKey: 'python', displayName: 'Python' }],
      };
      await studentProfile.save();

      // other student should receive not_connected, not sam's data
      const res = await request(app)
        .get('/api/intelligence/github/evidence')
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.evidence.syncStatus).toBe('not_connected');
      expect(res.body.evidence.username).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // 3. DELETE /api/intelligence/github/disconnect
  // -------------------------------------------------------------
  describe('DELETE /api/intelligence/github/disconnect', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).delete('/api/intelligence/github/disconnect');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('clears evidence and preserves profile link by default', async () => {
      studentProfile.githubEvidence = {
        username: 'sam-student',
        syncStatus: 'synced',
        detectedSkills: [{ canonicalKey: 'python', displayName: 'Python' }],
      };
      await studentProfile.save();

      const res = await request(app)
        .delete('/api/intelligence/github/disconnect')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.linkPreserved).toBe(true);

      const refreshed = await Profile.findById(studentProfile._id);
      expect(refreshed.githubEvidence.syncStatus).toBe('not_connected');
      expect(refreshed.githubEvidence.username).toBe('');
      expect(refreshed.professionalLinks.github).toBe('https://github.com/sam-student'); // Preserved!
    });

    it('clears profile link when ?clearLink=true query parameter is provided', async () => {
      studentProfile.githubEvidence = {
        username: 'sam-student',
        syncStatus: 'synced',
      };
      await studentProfile.save();

      const res = await request(app)
        .delete('/api/intelligence/github/disconnect?clearLink=true')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.linkPreserved).toBe(false);

      const refreshed = await Profile.findById(studentProfile._id);
      expect(refreshed.githubEvidence.syncStatus).toBe('not_connected');
      expect(refreshed.professionalLinks.github).toBeUndefined(); // Cleared!
    });
  });
});
