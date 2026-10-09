import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Opportunity } from '../../src/models/Opportunity.js';

describe('CareerOS Opportunity Management API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let studentUser;
  let studentToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    await setupTestDatabase();
    await Opportunity.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const studentAuth = await createTestUser('mgmt_student', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;

    const adminAuth = await createTestUser('mgmt_admin', 'admin');
    adminUser = adminAuth.user;
    adminToken = adminAuth.token;
  });

  // ==========================================
  // 1. Environment & Database Isolation
  // ==========================================
  describe('Environment & Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Creation Defaults & Verification Transition
  // ==========================================
  describe('Creation Defaults & Verification State Transitions', () => {
    it('creates an opportunity with default draft status, unverified flag, and false featured', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Management Default Opportunity',
          organization: 'Admin Org',
          description: 'Full description of default opportunity',
          shortDescription: 'Short desc',
          type: 'hackathon',
          workMode: 'remote',
          skills: ['react', 'node.js'],
          tags: ['AI', 'Web'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const created = res.body.opportunity;
      expect(created._id).toBeDefined();
      expect(created.status).toBe('draft');
      expect(created.verified).toBe(false);
      expect(created.featured).toBe(false);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('sets verified to false and clears verifiedAt and verifiedBy when unverified by admin', async () => {
      // First create a verified opportunity
      const opp = await Opportunity.create({
        title: 'Verified Opportunity',
        organization: 'Verified Org',
        description: 'Verified description',
        type: 'internship',
        status: 'published',
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: adminUser._id,
      });

      // Now admin explicitly un-verifies the opportunity
      const res = await request(app)
        .put(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verified: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const unverified = res.body.opportunity;
      expect(unverified.verified).toBe(false);
      expect(unverified.verifiedAt).toBeNull();
      expect(unverified.verifiedBy).toBeNull();

      // Check database persistence
      const dbOpp = await Opportunity.findById(opp._id);
      expect(dbOpp.verified).toBe(false);
      expect(dbOpp.verifiedAt).toBeNull();
      expect(dbOpp.verifiedBy).toBeNull();
    });
  });

  // ==========================================
  // 3. Soft Delete Persistence & Student Visibility
  // ==========================================
  describe('Soft Delete Persistence & Student Visibility', () => {
    it('persists archived status in MongoDB and returns 404 to students', async () => {
      const opp = await Opportunity.create({
        title: 'Opportunity To Archive',
        organization: 'Org Alpha',
        description: 'Initial Description',
        type: 'internship',
        status: 'published',
      });

      // Admin archives via DELETE endpoint
      const delRes = await request(app)
        .delete(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.opportunity.status).toBe('archived');

      // Check document still physically exists in MongoDB
      const docInDb = await Opportunity.findById(opp._id);
      expect(docInDb).not.toBeNull();
      expect(docInDb.status).toBe('archived');

      // Check student GET by ID returns 404 for archived opportunity
      const studentGetRes = await request(app)
        .get(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentGetRes.status).toBe(404);
      expect(studentGetRes.body.success).toBe(false);
    });
  });

  // ==========================================
  // 4. Detailed Write Validation Boundaries
  // ==========================================
  describe('Detailed Write Validation Boundaries', () => {
    it('rejects POST with missing title', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organization: 'Org', description: 'Desc', type: 'internship' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/title/i);
    });

    it('rejects POST with missing organization', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Title', description: 'Desc', type: 'internship' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/organization/i);
    });

    it('rejects POST with missing description', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Title', organization: 'Org', type: 'internship' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/description/i);
    });

    it('rejects POST with invalid applicationUrl scheme', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Title',
          organization: 'Org',
          description: 'Desc',
          type: 'internship',
          applicationUrl: 'ftp://example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/applicationUrl/i);
    });

    it('rejects POST with invalid registrationUrl scheme', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Title',
          organization: 'Org',
          description: 'Desc',
          type: 'internship',
          registrationUrl: 'javascript:alert(1)',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/registrationUrl/i);
    });

    it('rejects POST with negative stipend amount', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Title',
          organization: 'Org',
          description: 'Desc',
          type: 'internship',
          stipend: { amount: -500 },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/stipend/i);
    });

    it('rejects POST with negative prize amount', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Title',
          organization: 'Org',
          description: 'Desc',
          type: 'hackathon',
          prize: { amount: -1000 },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/prize/i);
    });

    it('rejects POST with invalid date sequence where endDate is earlier than eventDate', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Title',
          organization: 'Org',
          description: 'Desc',
          type: 'hackathon',
          eventDate: '2026-10-15T00:00:00Z',
          endDate: '2026-10-10T00:00:00Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/end date.*event date/i);
    });
  });

  // ==========================================
  // 5. Immutable & System Fields HTTP Protection
  // ==========================================
  describe('Immutable & System Fields HTTP Protection', () => {
    it('ignores client attempts to overwrite _id, createdAt, userId, and profileId via HTTP PUT', async () => {
      const opp = await Opportunity.create({
        title: 'Original Title',
        organization: 'Acme Corp',
        description: 'Original description',
        type: 'internship',
        status: 'draft',
      });

      const originalCreatedAt = opp.createdAt.toISOString();
      const fakeId = new mongoose.Types.ObjectId().toString();
      const fakeUserId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .put(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Title',
          _id: fakeId,
          createdAt: '2000-01-01T00:00:00.000Z',
          userId: fakeUserId,
          profileId: fakeUserId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.opportunity._id).toBe(opp._id.toString());
      expect(new Date(res.body.opportunity.createdAt).toISOString()).toBe(originalCreatedAt);

      // Verify in DB
      const dbDoc = await Opportunity.findById(opp._id);
      expect(dbDoc._id.toString()).toBe(opp._id.toString());
      expect(dbDoc.createdAt.toISOString()).toBe(originalCreatedAt);
    });
  });
});
