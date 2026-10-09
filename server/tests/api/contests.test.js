import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { User } from '../../src/models/User.js';
import { Contest } from '../../src/models/Contest.js';
import { generateAccessToken } from '../../src/services/auth.service.js';

describe('CareerOS Contests API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let user;
  let token;

  beforeAll(async () => {
    await setupTestDatabase();
    await Contest.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    user = await User.create({
      email: `contest_user_${Date.now()}@example.test`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student',
    });

    token = generateAccessToken(user);
  });

  // ==========================================
  // 1. Database Isolation
  // ==========================================
  describe('Environment & Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Model & Schema Validation
  // ==========================================
  describe('Contest Model & Schema Validation', () => {
    it('enforces required fields (platform, eventDate)', async () => {
      let validationError;
      try {
        await Contest.create({ name: 'Short' });
      } catch (err) {
        validationError = err;
      }

      expect(validationError).toBeDefined();
      expect(validationError.errors.platform).toBeDefined();
      expect(validationError.errors.eventDate).toBeDefined();
    });

    it('enforces valid HTTP/HTTPS URL for contestUrl', async () => {
      let validationError;
      try {
        await Contest.create({
          name: 'Test Contest',
          platform: 'TestPlatform',
          contestUrl: 'invalid-url',
          eventDate: new Date(),
          endDate: new Date(),
          duration: '1h',
        });
      } catch (err) {
        validationError = err;
      }

      expect(validationError).toBeDefined();
      expect(validationError.errors.contestUrl).toBeDefined();
    });

    it('successfully persists a valid Contest document', async () => {
      const contestDoc = await Contest.create({
        name: 'Valid Contest',
        platform: 'LeetCode',
        contestUrl: 'https://leetcode.com',
        eventDate: new Date('2026-10-10T10:00:00Z'),
        endDate: new Date('2026-10-10T11:00:00Z'),
        duration: '1h',
      });

      expect(contestDoc._id).toBeDefined();
      expect(contestDoc.name).toBe('Valid Contest');
      expect(contestDoc.platform).toBe('LeetCode');
    });
  });

  // ==========================================
  // 3. Authentication Boundary
  // ==========================================
  describe('Authentication Boundary', () => {
    it('rejects unauthenticated GET /api/contests with 401', async () => {
      const res = await request(app).get('/api/contests');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/contests/:id with 401', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/contests/${dummyId}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 4. Student Read Access & Filtering
  // ==========================================
  describe('GET /api/contests', () => {
    beforeEach(async () => {
      await Contest.create([
        {
          name: 'Weekly Contest 400',
          platform: 'LeetCode',
          contestUrl: 'https://leetcode.com/contest/400',
          eventDate: new Date('2026-10-10T10:00:00Z'),
          endDate: new Date('2026-10-10T11:30:00Z'),
          duration: '1.5h',
        },
        {
          name: 'Codeforces Round 950',
          platform: 'Codeforces',
          contestUrl: 'https://codeforces.com/contest/950',
          eventDate: new Date('2026-10-12T14:35:00Z'),
          endDate: new Date('2026-10-12T16:35:00Z'),
          duration: '2h',
        },
      ]);
    });

    it('lists all contests for authenticated student', async () => {
      const res = await request(app)
        .get('/api/contests')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.contests)).toBe(true);
      expect(res.body.contests.length).toBeGreaterThanOrEqual(2);
    });

    it('filters contests by platform', async () => {
      const res = await request(app)
        .get('/api/contests?platform=LeetCode')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.contests).toHaveLength(1);
      expect(res.body.contests[0].platform).toBe('LeetCode');
      expect(res.body.contests[0].name).toBe('Weekly Contest 400');
    });
  });

  // ==========================================
  // 5. Contest Detail & ID Validation
  // ==========================================
  describe('GET /api/contests/:id', () => {
    let contestDoc;

    beforeEach(async () => {
      contestDoc = await Contest.create({
        name: 'Biweekly Contest 120',
        platform: 'LeetCode',
        contestUrl: 'https://leetcode.com/contest/biweekly-120',
        eventDate: new Date('2026-10-15T14:30:00Z'),
        endDate: new Date('2026-10-15T16:00:00Z'),
        duration: '1.5h',
      });
    });

    it('returns contest details for valid ID', async () => {
      const res = await request(app)
        .get(`/api/contests/${contestDoc._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.contest).toBeDefined();
      expect(res.body.contest.name).toBe('Biweekly Contest 120');
      expect(res.body.contest.platform).toBe('LeetCode');
    });

    it('returns 400 for malformed ObjectId', async () => {
      const res = await request(app)
        .get('/api/contests/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for nonexistent contest ID', async () => {
      const unknownId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/contests/${unknownId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. Student Write Rejection / Read-Only Boundary
  // ==========================================
  describe('Student Write Rejection (Read-Only Feature)', () => {
    it('rejects POST to /api/contests with 404 (unsupported route)', async () => {
      const res = await request(app)
        .post('/api/contests')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Contest' });

      expect(res.status).toBe(404);
    });

    it('rejects PATCH to /api/contests/:id with 404 (unsupported route)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/contests/${dummyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Contest' });

      expect(res.status).toBe(404);
    });

    it('rejects DELETE to /api/contests/:id with 404 (unsupported route)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/contests/${dummyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
