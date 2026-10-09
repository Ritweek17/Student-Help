import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { SavedOpportunity } from '../../src/models/SavedOpportunity.js';
import { Opportunity } from '../../src/models/Opportunity.js';

describe('CareerOS Saved Opportunities API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  let pubOpp1;
  let pubOpp2;
  let draftOpp;
  let archivedOpp;
  let expiredOpp;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([SavedOpportunity.init(), Opportunity.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('saved_user_a', 'student');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('saved_user_b', 'student');
    userB = authB.user;
    tokenB = authB.token;

    pubOpp1 = await Opportunity.create({
      title: 'Published Opp 1',
      organization: 'Org Alpha',
      description: 'Description 1',
      type: 'internship',
      status: 'published',
    });

    pubOpp2 = await Opportunity.create({
      title: 'Published Opp 2',
      organization: 'Org Beta',
      description: 'Description 2',
      type: 'hackathon',
      status: 'published',
    });

    draftOpp = await Opportunity.create({
      title: 'Draft Opp',
      organization: 'Org Gamma',
      description: 'Description Draft',
      type: 'workshop',
      status: 'draft',
    });

    archivedOpp = await Opportunity.create({
      title: 'Archived Opp',
      organization: 'Org Delta',
      description: 'Description Archived',
      type: 'conference',
      status: 'archived',
    });

    expiredOpp = await Opportunity.create({
      title: 'Expired Opp',
      organization: 'Org Epsilon',
      description: 'Description Expired',
      type: 'competition',
      status: 'expired',
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
  // 2. Model & Compound Unique Index
  // ==========================================
  describe('SavedOpportunity Model & Schema Constraints', () => {
    it('creates saved opportunity with timestamps and prevents DB-layer duplicate', async () => {
      const directSave = await SavedOpportunity.create({
        userId: userA._id,
        opportunityId: pubOpp1._id,
      });

      expect(directSave._id).toBeDefined();
      expect(directSave.createdAt).toBeDefined();
      expect(directSave.updatedAt).toBeDefined();

      let duplicateCaught = false;
      try {
        await SavedOpportunity.create({
          userId: userA._id,
          opportunityId: pubOpp1._id,
        });
      } catch (err) {
        if (err.code === 11000) duplicateCaught = true;
      }
      expect(duplicateCaught).toBe(true);
    });
  });

  // ==========================================
  // 3. Authentication Boundaries
  // ==========================================
  describe('Authentication Boundaries', () => {
    it('rejects unauthenticated requests with 401 across save, unsave, and list', async () => {
      const resPost = await request(app).post(`/api/opportunities/${pubOpp1._id}/save`);
      expect(resPost.status).toBe(401);

      const resDelete = await request(app).delete(`/api/opportunities/${pubOpp1._id}/save`);
      expect(resDelete.status).toBe(401);

      const resGet = await request(app).get('/api/saved-opportunities');
      expect(resGet.status).toBe(401);
    });
  });

  // ==========================================
  // 4. Visibility Rules & Non-Published Protection
  // ==========================================
  describe('Visibility Rules & Non-Published Protection', () => {
    it('returns 404 when attempting to save draft opportunity', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${draftOpp._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 when attempting to save archived opportunity', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${archivedOpp._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 when attempting to save expired opportunity', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${expiredOpp._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ==========================================
  // 5. Save Endpoint, Idempotency & User Isolation
  // ==========================================
  describe('Save Endpoint, Idempotency & User Isolation', () => {
    it('saves published opportunity and returns 201', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.saved).toBe(true);
    });

    it('returns idempotent 200 on duplicate save by same user', async () => {
      await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      const resDup = await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resDup.status).toBe(200);
      expect(resDup.body.saved).toBe(true);
    });

    it('allows User B to save same opportunity independently with 201', async () => {
      await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      const resB = await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(201);
      expect(resB.body.saved).toBe(true);
    });
  });

  // ==========================================
  // 6. Saved List, Ordering, User Isolation, & Filtering
  // ==========================================
  describe('Saved List, Ordering, User Isolation, & Filtering', () => {
    beforeEach(async () => {
      // User A saves pubOpp1 then pubOpp2
      await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      await request(app)
        .post(`/api/opportunities/${pubOpp2._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      // User B saves pubOpp1 only
      await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenB}`);
    });

    it('lists User A saved opportunities ordered by newest saved first', async () => {
      const res = await request(app)
        .get('/api/saved-opportunities')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.savedOpportunities).toHaveLength(2);
      expect(res.body.savedOpportunities[0].opportunity._id).toBe(pubOpp2._id.toString());
      expect(res.body.savedOpportunities[1].opportunity._id).toBe(pubOpp1._id.toString());
      expect(res.body.pagination.total).toBe(2);
    });

    it('isolates saved opportunities between users (User B sees only pubOpp1)', async () => {
      const res = await request(app)
        .get('/api/saved-opportunities')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.savedOpportunities).toHaveLength(1);
      expect(res.body.savedOpportunities[0].opportunity._id).toBe(pubOpp1._id.toString());
    });

    it('excludes archived opportunities from saved list and pagination count', async () => {
      // Archive pubOpp2 directly in DB
      await Opportunity.findByIdAndUpdate(pubOpp2._id, { status: 'archived' });

      const res = await request(app)
        .get('/api/saved-opportunities')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.savedOpportunities).toHaveLength(1);
      expect(res.body.savedOpportunities[0].opportunity._id).toBe(pubOpp1._id.toString());
      expect(res.body.pagination.total).toBe(1);

      // Restore
      await Opportunity.findByIdAndUpdate(pubOpp2._id, { status: 'published' });
    });
  });

  // ==========================================
  // 7. Unsave Endpoint & User Isolation
  // ==========================================
  describe('Unsave Endpoint & User Isolation', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenB}`);
    });

    it('unsaves opportunity for User A with 200', async () => {
      const res = await request(app)
        .delete(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.saved).toBe(false);
    });

    it('repeated unsave is safe (returns 200)', async () => {
      await request(app)
        .delete(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      const resRep = await request(app)
        .delete(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resRep.status).toBe(200);
      expect(resRep.body.saved).toBe(false);
    });

    it('ensures User A unsaving does not affect User B saved opportunity', async () => {
      await request(app)
        .delete(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`);

      const resListB = await request(app)
        .get('/api/saved-opportunities')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resListB.status).toBe(200);
      expect(resListB.body.savedOpportunities).toHaveLength(1);
      expect(resListB.body.savedOpportunities[0].opportunity._id).toBe(pubOpp1._id.toString());
    });
  });

  // ==========================================
  // 8. Validation & Bounds Checks
  // ==========================================
  describe('Validation & Bounds Checks', () => {
    it('returns 400 for malformed ObjectId on save', async () => {
      const res = await request(app)
        .post('/api/opportunities/invalid-id/save')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid page number page=0', async () => {
      const res = await request(app)
        .get('/api/saved-opportunities?page=0')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for limit exceeding bounds (limit=100)', async () => {
      const res = await request(app)
        .get('/api/saved-opportunities?limit=100')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 9. Security & Spoofed Payload Body
  // ==========================================
  describe('Security & Spoofed Payload Body', () => {
    it('ignores spoofed userId and opportunityId in request body', async () => {
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const fakeOppId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/opportunities/${pubOpp1._id}/save`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: fakeUserId, opportunityId: fakeOppId });

      expect(res.status).toBe(201);
      const savedDoc = await SavedOpportunity.findOne({ userId: userA._id, opportunityId: pubOpp1._id });
      expect(savedDoc).not.toBeNull();

      const fakeDoc = await SavedOpportunity.findOne({ userId: fakeUserId });
      expect(fakeDoc).toBeNull();
    });
  });

  // ==========================================
  // 10. Concurrent Save Race Condition
  // ==========================================
  describe('Concurrent Save Race Condition', () => {
    it('handles concurrent saves safely without duplicate document creation', async () => {
      const concurrentReqs = await Promise.all([
        request(app).post(`/api/opportunities/${pubOpp1._id}/save`).set('Authorization', `Bearer ${tokenA}`),
        request(app).post(`/api/opportunities/${pubOpp1._id}/save`).set('Authorization', `Bearer ${tokenA}`),
        request(app).post(`/api/opportunities/${pubOpp1._id}/save`).set('Authorization', `Bearer ${tokenA}`),
      ]);

      concurrentReqs.forEach((r) => {
        expect([200, 201]).toContain(r.status);
        expect(r.body.saved).toBe(true);
      });

      const count = await SavedOpportunity.countDocuments({ userId: userA._id, opportunityId: pubOpp1._id });
      expect(count).toBe(1);
    });
  });
});
