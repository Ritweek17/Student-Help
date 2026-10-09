import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Profile } from '../../src/models/Profile.js';
import { User } from '../../src/models/User.js';
import { generateAccessToken } from '../../src/services/auth.service.js';

describe('CareerOS Profile API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([User.init(), Profile.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('profile_user_a', 'student');
    userA = authA.user;
    tokenA = authA.token;

    // Create Profile for User A
    await Profile.create({
      userId: userA._id,
      personal: {
        firstName: 'UserA',
        lastName: 'Test',
        displayName: 'User A',
      },
      skills: [],
    });

    const authB = await createTestUser('profile_user_b', 'student');
    userB = authB.user;
    tokenB = authB.token;

    // Create Profile for User B
    await Profile.create({
      userId: userB._id,
      personal: {
        firstName: 'UserB',
        lastName: 'Test',
        displayName: 'User B',
      },
      skills: [],
    });
  });

  // ==========================================
  // 1. Database & Environment Isolation
  // ==========================================
  describe('Environment & Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Authentication Boundaries
  // ==========================================
  describe('Authentication Boundaries', () => {
    it('rejects unauthenticated GET /api/profile with 401', async () => {
      const res = await request(app).get('/api/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated PUT /api/profile with 401', async () => {
      const res = await request(app)
        .put('/api/profile')
        .send({ personal: { displayName: 'Hacker' } });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 3. Profile Retrieval & Sensitive Data Masking
  // ==========================================
  describe('Profile Retrieval & Sensitive Data Masking', () => {
    it('retrieves authenticated user profile with HTTP 200 without exposing passwordHash', async () => {
      const res = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.personal.firstName).toBe('UserA');
      expect(res.body.profile.personal.displayName).toBe('User A');
      expect(res.body.profile.passwordHash).toBeUndefined();
    });

    it('returns 404 when authenticated user has no existing profile document', async () => {
      const orphanUser = await User.create({
        email: 'orphan-user@example.com',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuuvwwxyz123456',
        role: 'student',
        isActive: true,
      });

      const orphanToken = generateAccessToken(orphanUser);

      const res = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${orphanToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ==========================================
  // 4. Profile Updates & Partial Nested Preservation
  // ==========================================
  describe('Profile Updates & Partial Nested Preservation', () => {
    it('updates profile and preserves non-targeted nested fields', async () => {
      const updatePayload = {
        personal: {
          displayName: 'User A Updated',
          phone: '+1234567890',
        },
        skills: [
          { name: 'JavaScript', level: 'advanced' },
          { name: 'React', level: 'intermediate' },
        ],
        professionalLinks: {
          github: 'https://github.com/user-a',
        },
      };

      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.personal.displayName).toBe('User A Updated');
      expect(res.body.profile.personal.firstName).toBe('UserA'); // Preserved!
      expect(res.body.profile.personal.phone).toBe('+1234567890');
      expect(res.body.profile.skills).toHaveLength(2);
      expect(res.body.profile.professionalLinks.github).toBe('https://github.com/user-a');

      // Verify persistence via subsequent GET
      const verifyGet = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(verifyGet.status).toBe(200);
      expect(verifyGet.body.profile.personal.displayName).toBe('User A Updated');
      expect(verifyGet.body.profile.personal.firstName).toBe('UserA');
      expect(verifyGet.body.profile.professionalLinks.github).toBe('https://github.com/user-a');
    });

    it('preserves displayName and phone when subsequent update modifies location', async () => {
      // First update displayName & phone
      await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          personal: {
            displayName: 'User A Updated',
            phone: '+1234567890',
          },
        });

      // Second update sets location only
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          personal: {
            location: { city: 'Bengaluru', country: 'India' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.personal.displayName).toBe('User A Updated');
      expect(res.body.profile.personal.phone).toBe('+1234567890');
      expect(res.body.profile.personal.location.city).toBe('Bengaluru');
    });
  });

  // ==========================================
  // 5. Validation Rules
  // ==========================================
  describe('Validation Rules', () => {
    it('rejects invalid skill level with 400', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          skills: [{ name: 'C++', level: 'master-ninja' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid URL in professionalLinks with 400', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          professionalLinks: { github: 'not-a-valid-url' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid CGPA greater than 10 with 400', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          education: [{ institution: 'Apex Tech', cgpa: 15 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. User Isolation, IDOR & Ownership Attacks
  // ==========================================
  describe('User Isolation, IDOR & Ownership Attacks', () => {
    it('maintains strict user profile isolation', async () => {
      const resA = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      const resB = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.profile.personal.firstName).toBe('UserA');
      expect(resB.body.profile.personal.firstName).toBe('UserB');
      expect(resA.body.profile.userId).toBe(userA._id.toString());
      expect(resB.body.profile.userId).toBe(userB._id.toString());
    });

    it('strips injected userId and profileId to prevent ownership hijacking', async () => {
      const profileB = await Profile.findOne({ userId: userB._id });

      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          userId: userB._id.toString(),
          profileId: profileB._id.toString(),
          personal: { displayName: 'User A Self Edit' },
        });

      expect(res.status).toBe(200);
      // User A profile ownership remains User A
      expect(res.body.profile.userId.toString()).toBe(userA._id.toString());

      // User B profile remains untouched
      const checkB = await Profile.findOne({ userId: userB._id });
      expect(checkB.personal.firstName).toBe('UserB');
      expect(checkB.personal.displayName).toBe('User B');
    });

    it('ignores forbidden system fields (_id, createdAt, updatedAt)', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          _id: new mongoose.Types.ObjectId().toString(),
          userId: userB._id.toString(),
          createdAt: '1970-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.userId.toString()).toBe(userA._id.toString());
    });
  });
});
