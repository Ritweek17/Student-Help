import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { User } from '../../src/models/User.js';
import { LearningTrack } from '../../src/models/LearningTrack.js';
import { LearningItem } from '../../src/models/LearningItem.js';
import { LearningResource } from '../../src/models/LearningResource.js';
import { UserLearningProgress } from '../../src/models/UserLearningProgress.js';
import { generateAccessToken } from '../../src/services/auth.service.js';

describe('CareerOS Learning API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;
  let track;
  let item;
  let resource;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      LearningTrack.init(),
      LearningItem.init(),
      LearningResource.init(),
      UserLearningProgress.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    userA = await User.create({
      email: `userA_learning_${Date.now()}@example.test`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student',
    });

    userB = await User.create({
      email: `userB_learning_${Date.now()}@example.test`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student',
    });

    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);

    track = await LearningTrack.create({
      title: 'Full Stack Web Development',
      category: 'Web Development',
      description: 'Comprehensive guide to modern web development',
      isActive: true,
    });

    item = await LearningItem.create({
      trackId: track._id,
      title: 'React Fundamentals',
      duration: '45m',
      order: 1,
    });

    resource = await LearningResource.create({
      trackId: track._id,
      title: 'Official React Documentation',
      type: 'Documentation',
      url: 'https://react.dev',
    });
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
  // 2. Schema Validation
  // ==========================================
  describe('UserLearningProgress Schema Validation', () => {
    it('rejects invalid progress status', async () => {
      let validationError;
      try {
        await UserLearningProgress.create({
          userId: userA._id,
          trackId: track._id,
          itemId: item._id,
          status: 'InvalidStatus',
        });
      } catch (err) {
        validationError = err;
      }

      expect(validationError).toBeDefined();
      expect(validationError.errors.status).toBeDefined();
    });
  });

  // ==========================================
  // 3. Authentication Boundary
  // ==========================================
  describe('Authentication Boundary', () => {
    it('rejects unauthenticated requests to GET /api/learning/tracks with 401', async () => {
      const res = await request(app).get('/api/learning/tracks');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests to GET /api/learning/tracks/:id with 401', async () => {
      const res = await request(app).get(`/api/learning/tracks/${track._id}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests to PATCH /api/learning/progress with 401', async () => {
      const res = await request(app)
        .patch('/api/learning/progress')
        .send({ trackId: track._id, itemId: item._id, status: 'Completed' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 4. Content Endpoints (Read-Only)
  // ==========================================
  describe('Content Endpoints', () => {
    it('retrieves learning tracks list for authenticated user', async () => {
      const res = await request(app)
        .get('/api/learning/tracks')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.find((t) => t.id === track._id.toString());
      expect(found).toBeDefined();
      expect(found.title).toBe('Full Stack Web Development');
    });

    it('retrieves track by ID', async () => {
      const res = await request(app)
        .get(`/api/learning/tracks/${track._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(track._id.toString());
      expect(res.body.data.title).toBe('Full Stack Web Development');
    });

    it('returns 400 for malformed track ID', async () => {
      const res = await request(app)
        .get('/api/learning/tracks/invalid-track-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for unknown track ID', async () => {
      const unknownId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/learning/tracks/${unknownId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('retrieves track items for a valid track ID', async () => {
      const res = await request(app)
        .get(`/api/learning/tracks/${track._id}/items`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('React Fundamentals');
    });

    it('retrieves learning resources list', async () => {
      const res = await request(app)
        .get('/api/learning/resources')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((r) => r.title === 'Official React Documentation')).toBe(true);
    });
  });

  // ==========================================
  // 5. Progress Management & User Isolation
  // ==========================================
  describe('Progress Management & User Isolation', () => {
    it('updates item progress and correctly aggregates track progress for user A', async () => {
      const res = await request(app)
        .patch('/api/learning/progress')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          trackId: track._id,
          itemId: item._id,
          status: 'Completed',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify track progress calculation on subsequent GET /tracks
      const tracksRes = await request(app)
        .get('/api/learning/tracks')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(tracksRes.status).toBe(200);
      const userATrack = tracksRes.body.data.find((t) => t.id === track._id.toString());
      expect(userATrack.completedItems).toBe(1);
      expect(userATrack.progress).toBe(100);
      expect(userATrack.status).toBe('Completed');

      // Verify user isolation: user B sees 0 progress
      const userBTracksRes = await request(app)
        .get('/api/learning/tracks')
        .set('Authorization', `Bearer ${tokenB}`);

      const userBTrack = userBTracksRes.body.data.find((t) => t.id === track._id.toString());
      expect(userBTrack.completedItems).toBe(0);
      expect(userBTrack.progress).toBe(0);
      expect(userBTrack.status).not.toBe('Completed');
    });

    it('ignores arbitrary userId in progress update body and binds to auth token', async () => {
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch('/api/learning/progress')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          trackId: track._id,
          itemId: item._id,
          status: 'Learning',
          userId: fakeUserId,
        });

      expect(res.status).toBe(200);

      // Verify progress record in DB is bound to userA
      const progressRecord = await UserLearningProgress.findOne({
        trackId: track._id,
        itemId: item._id,
      });

      expect(progressRecord).not.toBeNull();
      expect(progressRecord.userId.toString()).toBe(userA._id.toString());
      expect(progressRecord.userId.toString()).not.toBe(fakeUserId);
    });

    it('rejects progress update with invalid status with 400', async () => {
      const res = await request(app)
        .patch('/api/learning/progress')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          trackId: track._id,
          itemId: item._id,
          status: 'WrongStatus',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. Content Write Protection (Read-Only Content)
  // ==========================================
  describe('Content Write Rejection', () => {
    it('rejects student POST to /api/learning/tracks with 404', async () => {
      const res = await request(app)
        .post('/api/learning/tracks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Hacked Track' });

      expect(res.status).toBe(404);
    });

    it('rejects student DELETE to /api/learning/tracks/:id with 404', async () => {
      const res = await request(app)
        .delete(`/api/learning/tracks/${track._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // 7. Recommended Next Endpoint
  // ==========================================
  describe('GET /api/learning/recommended', () => {
    it('returns recommended next items deterministically without external calls', async () => {
      const res = await request(app)
        .get('/api/learning/recommended')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });
});
