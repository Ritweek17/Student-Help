import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Application } from '../../src/models/Application.js';
import { Opportunity } from '../../src/models/Opportunity.js';

describe('CareerOS Applications API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  let pubOpp1;
  let pubOpp2;
  let draftOpp;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([Application.init(), Opportunity.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('app_user_a', 'student');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('app_user_b', 'student');
    userB = authB.user;
    tokenB = authB.token;

    pubOpp1 = await Opportunity.create({
      title: 'Internship 1',
      organization: 'TechCorp',
      description: 'Description Internship 1',
      type: 'internship',
      status: 'published',
    });

    pubOpp2 = await Opportunity.create({
      title: 'Hackathon 2',
      organization: 'HackInc',
      description: 'Description Hackathon 2',
      type: 'hackathon',
      status: 'published',
    });

    draftOpp = await Opportunity.create({
      title: 'Draft Opp',
      organization: 'DraftOrg',
      description: 'Description Draft',
      type: 'workshop',
      status: 'draft',
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
  // 2. Application Model & Schema Constraints
  // ==========================================
  describe('Application Model & Schema Constraints', () => {
    it('creates direct application with timestamps and enforces unique compound index', async () => {
      const directApp = await Application.create({
        userId: userA._id,
        opportunityId: pubOpp1._id,
        type: 'application',
        status: 'applied',
        notes: 'Direct test note',
      });

      expect(directApp._id).toBeDefined();
      expect(directApp.createdAt).toBeDefined();
      expect(directApp.updatedAt).toBeDefined();

      let dupCaught = false;
      try {
        await Application.create({
          userId: userA._id,
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'interview',
        });
      } catch (err) {
        if (err.code === 11000) dupCaught = true;
      }
      expect(dupCaught).toBe(true);
    });

    it('rejects invalid status for application type at schema validation layer', async () => {
      let invalidStatusCaught = false;
      try {
        await Application.create({
          userId: userA._id,
          opportunityId: pubOpp2._id,
          type: 'application',
          status: 'registered', // Invalid for application type
        });
      } catch {
        invalidStatusCaught = true;
      }
      expect(invalidStatusCaught).toBe(true);
    });
  });

  // ==========================================
  // 3. Authentication Boundaries
  // ==========================================
  describe('Authentication Boundaries', () => {
    it('rejects unauthenticated requests with 401 across all endpoints', async () => {
      const resPost = await request(app).post('/api/applications').send({});
      expect(resPost.status).toBe(401);

      const resList = await request(app).get('/api/applications');
      expect(resList.status).toBe(401);

      const resGet = await request(app).get(`/api/applications/${pubOpp1._id}?type=application`);
      expect(resGet.status).toBe(401);

      const resPut = await request(app).put(`/api/applications/${pubOpp1._id}?type=application`).send({});
      expect(resPut.status).toBe(401);

      const resDel = await request(app).delete(`/api/applications/${pubOpp1._id}?type=application`);
      expect(resDel.status).toBe(401);
    });
  });

  // ==========================================
  // 4. Request Validation & Visibility Bounds
  // ==========================================
  describe('Request Validation & Visibility Bounds', () => {
    it('returns 400 for malformed ObjectId on GET single', async () => {
      const res = await request(app)
        .get('/api/applications/invalid-id?type=application')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid.*id/i);
    });

    it('returns 400 for invalid page number page=0', async () => {
      const res = await request(app)
        .get('/api/applications?page=0')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when externalUrl has an unsupported scheme', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          externalUrl: 'ftp://bad-scheme.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/url/i);
    });

    it('returns 404 when attempting to create application for draft/hidden opportunity', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: draftOpp._id,
          type: 'application',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when GET single lacks type parameter or provides invalid type', async () => {
      const resNoType = await request(app)
        .get(`/api/applications/${pubOpp1._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resNoType.status).toBe(400);

      const resBadType = await request(app)
        .get(`/api/applications/${pubOpp1._id}?type=invalidType`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resBadType.status).toBe(400);
    });
  });

  // ==========================================
  // 5. Application Creation & Idempotency
  // ==========================================
  describe('Application Creation & Idempotency', () => {
    it('creates an application and auto-populates appliedAt', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
          notes: 'Applied on official site',
          externalUrl: 'https://careers.techcorp.com/app/1',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.application).toBeDefined();
      expect(res.body.application.appliedAt).toBeDefined();
      expect(res.body.application.type).toBe('application');
      expect(res.body.application.status).toBe('applied');
    });

    it('creates a registration for same opportunity with auto-populated registeredAt', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'registration',
          status: 'registered',
          notes: 'Registered for webinar',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.application.registeredAt).toBeDefined();
      expect(res.body.application.type).toBe('registration');
    });

    it('returns idempotent 200 on duplicate application creation by same user', async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
        });

      const resDup = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
        });

      expect(resDup.status).toBe(200);
      expect(resDup.body.success).toBe(true);
    });

    it('allows User B to create application for same opportunity independently', async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
        });

      const resB = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
        });

      expect(resB.status).toBe(201);
      expect(resB.body.success).toBe(true);
      expect(resB.body.application.userId.toString()).toBe(userB._id.toString());
    });
  });

  // ==========================================
  // 6. Retrieval, Population & Ownership (IDOR)
  // ==========================================
  describe('Retrieval, Population & Ownership (IDOR)', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
        });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'registration',
          status: 'registered',
        });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp2._id,
          type: 'application',
          status: 'interview',
        });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
        });
    });

    it('retrieves own application with populated opportunity details', async () => {
      const res = await request(app)
        .get(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.application.opportunity).toBeDefined();
      expect(res.body.application.opportunity.title).toBe(pubOpp1.title);
    });

    it('prevents User B from accessing User A application for pubOpp2 (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/applications/${pubOpp2._id}?type=application`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 7. List Isolation, Filtering, & Pagination
  // ==========================================
  describe('List Isolation, Filtering, & Pagination', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ opportunityId: pubOpp1._id, type: 'application', status: 'applied' });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ opportunityId: pubOpp1._id, type: 'registration', status: 'registered' });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ opportunityId: pubOpp2._id, type: 'application', status: 'interview' });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ opportunityId: pubOpp1._id, type: 'application', status: 'applied' });
    });

    it('isolates user applications in listing (User A sees 3, User B sees 1)', async () => {
      const resA = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resA.status).toBe(200);
      expect(resA.body.applications).toHaveLength(3);

      const resB = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(resB.status).toBe(200);
      expect(resB.body.applications).toHaveLength(1);
    });

    it('paginates results correctly with limit and total count', async () => {
      const res = await request(app)
        .get('/api/applications?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.applications).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.pages).toBe(2);
    });

    it('filters applications by type', async () => {
      const res = await request(app)
        .get('/api/applications?type=registration')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.applications).toHaveLength(1);
      expect(res.body.applications[0].type).toBe('registration');
    });

    it('filters applications by status', async () => {
      const res = await request(app)
        .get('/api/applications?status=interview')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.applications).toHaveLength(1);
      expect(res.body.applications[0].status).toBe('interview');
    });

    it('returns applications sorted by newest first (createdAt desc)', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const apps = res.body.applications;
      expect(new Date(apps[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(apps[1].createdAt).getTime());
    });

    it('hides applications from list when associated opportunity is archived', async () => {
      await Opportunity.findByIdAndUpdate(pubOpp2._id, { status: 'archived' });

      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.applications).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);

      // Restore opportunity
      await Opportunity.findByIdAndUpdate(pubOpp2._id, { status: 'published' });
    });
  });

  // ==========================================
  // 8. Update Endpoint, IDOR & Immutability
  // ==========================================
  describe('Update Endpoint, IDOR & Immutability', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          opportunityId: pubOpp1._id,
          type: 'application',
          status: 'applied',
        });
    });

    it('allows User A to update status, notes, and externalUrl', async () => {
      const res = await request(app)
        .put(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'interview',
          notes: 'Scheduled for technical round',
          externalUrl: 'https://careers.techcorp.com/app/1/interview',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.application.status).toBe('interview');
      expect(res.body.application.notes).toBe('Scheduled for technical round');
    });

    it('rejects invalid status for type with 400', async () => {
      const res = await request(app)
        .put(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'attended' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects attempts to modify immutable type or userId with 400', async () => {
      const res = await request(app)
        .put(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'registration', userId: userB._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('prevents User B from updating User A application (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/applications/${pubOpp2._id}?type=application`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 9. Deletion & Isolation
  // ==========================================
  describe('Deletion & Isolation', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ opportunityId: pubOpp1._id, type: 'application', status: 'applied' });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ opportunityId: pubOpp1._id, type: 'registration', status: 'registered' });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ opportunityId: pubOpp1._id, type: 'application', status: 'applied' });
    });

    it('allows User A to delete own application and registration', async () => {
      const resApp = await request(app)
        .delete(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resApp.status).toBe(200);

      const resReg = await request(app)
        .delete(`/api/applications/${pubOpp1._id}?type=registration`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resReg.status).toBe(200);
    });

    it('repeated delete is safe (idempotent 200)', async () => {
      await request(app)
        .delete(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`);

      const resRep = await request(app)
        .delete(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resRep.status).toBe(200);
    });

    it('ensures User A deletion does not affect User B application', async () => {
      await request(app)
        .delete(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenA}`);

      const resGetB = await request(app)
        .get(`/api/applications/${pubOpp1._id}?type=application`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resGetB.status).toBe(200);
      expect(resGetB.body.application).toBeDefined();
    });
  });
});
