import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import {
  Opportunity,
  OPPORTUNITY_TYPES,
  WORK_MODES,
  OPPORTUNITY_STATUSES,
} from '../../src/models/Opportunity.js';
import { validateOpportunityWrite } from '../../src/validators/opportunity.write.validator.js';
import { validateOpportunityQuery } from '../../src/validators/opportunity.validator.js';
import { requireRole } from '../../src/middleware/authorize.js';
import { opportunityRouter } from '../../src/routes/opportunity.routes.js';

describe('CareerOS Admin API Test Suite (Supertest + In-Memory ReplSet)', () => {
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

    const studentAuth = await createTestUser('student_user', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;

    const adminAuth = await createTestUser('admin_user', 'admin');
    adminUser = adminAuth.user;
    adminToken = adminAuth.token;
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
  // 2. Model Schema & Enums Verification
  // ==========================================
  describe('Opportunity Model Schema & Enums', () => {
    it('defines all core and curation fields with timestamps', () => {
      const schemaPaths = Opportunity.schema.paths;
      expect(schemaPaths.title).toBeDefined();
      expect(schemaPaths.organization).toBeDefined();
      expect(schemaPaths.description).toBeDefined();
      expect(schemaPaths.type).toBeDefined();
      expect(schemaPaths.status).toBeDefined();
      expect(schemaPaths.workMode).toBeDefined();
      expect(schemaPaths.verified).toBeDefined();
      expect(schemaPaths.featured).toBeDefined();
      expect(schemaPaths.deadline).toBeDefined();
      expect(schemaPaths.createdAt).toBeDefined();
      expect(schemaPaths.updatedAt).toBeDefined();
    });

    it('defines valid opportunity types, work modes, and status enums conforming to specification', () => {
      expect(Array.isArray(OPPORTUNITY_TYPES)).toBe(true);
      expect(OPPORTUNITY_TYPES.length).toBeGreaterThanOrEqual(10);
      expect(OPPORTUNITY_TYPES).toContain('internship');
      expect(OPPORTUNITY_TYPES).toContain('hackathon');

      expect(Array.isArray(WORK_MODES)).toBe(true);
      expect(WORK_MODES).toContain('remote');
      expect(WORK_MODES).toContain('onsite');

      expect(Array.isArray(OPPORTUNITY_STATUSES)).toBe(true);
      expect(OPPORTUNITY_STATUSES).toContain('published');
      expect(OPPORTUNITY_STATUSES).toContain('archived');
    });
  });

  // ==========================================
  // 3. Write & Query Validator Unit Tests
  // ==========================================
  describe('Write & Query Validator Unit Rules', () => {
    it('enforces all mandatory fields on creation in validateOpportunityWrite', () => {
      const missingTitle = validateOpportunityWrite({ organization: 'Acme', description: 'Desc', type: 'internship' }, false);
      expect(missingTitle.error).toMatch(/title is required/i);

      const missingOrg = validateOpportunityWrite({ title: 'Role', description: 'Desc', type: 'internship' }, false);
      expect(missingOrg.error).toMatch(/organization name is required/i);

      const missingDesc = validateOpportunityWrite({ title: 'Role', organization: 'Acme', type: 'internship' }, false);
      expect(missingDesc.error).toMatch(/description is required/i);

      const missingType = validateOpportunityWrite({ title: 'Role', organization: 'Acme', description: 'Desc' }, false);
      expect(missingType.error).toMatch(/type is required/i);
    });

    it('rejects invalid opportunity type, workMode, and status in validateOpportunityWrite', () => {
      const badType = validateOpportunityWrite({ title: 'T', organization: 'O', description: 'D', type: 'fake_type' }, false);
      expect(badType.error).toMatch(/invalid opportunity type/i);

      const badMode = validateOpportunityWrite({ title: 'T', organization: 'O', description: 'D', type: 'internship', workMode: 'in_space' }, false);
      expect(badMode.error).toMatch(/invalid work mode/i);

      const badStatus = validateOpportunityWrite({ title: 'T', organization: 'O', description: 'D', type: 'internship', status: 'unknown_status' }, false);
      expect(badStatus.error).toMatch(/invalid opportunity status/i);
    });

    it('strictly enforces HTTP/HTTPS URL protocols', () => {
      const badUrl = validateOpportunityWrite({
        title: 'T',
        organization: 'O',
        description: 'D',
        type: 'internship',
        applicationUrl: 'ftp://bad-link.com',
      }, false);
      expect(badUrl.error).toMatch(/applicationUrl/i);

      const validUrl = validateOpportunityWrite({
        title: 'Valid Opportunity',
        organization: 'Acme Corp',
        description: 'Full description',
        type: 'internship',
        applicationUrl: 'https://acme.example.com/apply',
        status: 'published',
      }, false);
      expect(validUrl.error).toBeNull();
      expect(validUrl.value.applicationUrl).toBe('https://acme.example.com/apply');
    });

    it('strips client-supplied immutable and system fields', () => {
      const injectionTest = validateOpportunityWrite({
        title: 'Hacked Opportunity',
        organization: 'Evil Corp',
        description: 'Desc',
        type: 'internship',
        _id: '507f1f77bcf86cd799439011',
        createdAt: '1970-01-01T00:00:00.000Z',
        userId: '507f1f77bcf86cd799439022',
        verifiedBy: '507f1f77bcf86cd799439033',
      }, false);

      expect(injectionTest.value._id).toBeUndefined();
      expect(injectionTest.value.createdAt).toBeUndefined();
      expect(injectionTest.value.userId).toBeUndefined();
      expect(injectionTest.value.verifiedBy).toBeUndefined();
    });

    it('supports status filter and pagination in validateOpportunityQuery', () => {
      const queryWithAll = validateOpportunityQuery({ status: 'all', page: '2', limit: '10' });
      expect(queryWithAll.error).toBeNull();
      expect(queryWithAll.value.status).toBe('all');
      expect(queryWithAll.value.page).toBe(2);
      expect(queryWithAll.value.limit).toBe(10);

      const queryWithDraft = validateOpportunityQuery({ status: 'draft' });
      expect(queryWithDraft.error).toBeNull();
      expect(queryWithDraft.value.status).toBe('draft');

      const queryWithBadStatus = validateOpportunityQuery({ status: 'nonexistent' });
      expect(queryWithBadStatus.error).toMatch(/invalid status filter/i);
    });
  });

  // ==========================================
  // 4. Role Authorization Middleware Unit Tests
  // ==========================================
  describe('Role Authorization Middleware Unit Tests', () => {
    const adminGuard = requireRole('admin');

    it('rejects unauthenticated requests with HTTP 401', () => {
      let status = null;
      let body = null;
      const fakeReq = {};
      const fakeRes = {
        status(code) { status = code; return this; },
        json(data) { body = data; return this; },
      };

      adminGuard(fakeReq, fakeRes, () => {
        throw new Error('next() should not be called');
      });

      expect(status).toBe(401);
      expect(body?.success).toBe(false);
    });

    it('strictly rejects student role with HTTP 403 Forbidden', () => {
      let status = null;
      let body = null;
      const fakeReq = { auth: { userId: '123', role: 'student' } };
      const fakeRes = {
        status(code) { status = code; return this; },
        json(data) { body = data; return this; },
      };

      adminGuard(fakeReq, fakeRes, () => {
        throw new Error('next() should not be called');
      });

      expect(status).toBe(403);
      expect(body?.success).toBe(false);
    });

    it('allows authenticated admin requests to proceed', () => {
      let passed = false;
      const fakeReq = { auth: { userId: '456', role: 'admin' } };
      const fakeRes = {
        status() { return this; },
        json() { return this; },
      };

      adminGuard(fakeReq, fakeRes, () => {
        passed = true;
      });

      expect(passed).toBe(true);
    });
  });

  // ==========================================
  // 5. Router Registration
  // ==========================================
  describe('Express Router Registration', () => {
    it('registers POST /, PUT /:id, and DELETE /:id endpoints in opportunityRouter', () => {
      expect(opportunityRouter).toBeDefined();
      const routes = opportunityRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes.some((r) => r.path === '/' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/:id' && r.methods.includes('put'))).toBe(true);
      expect(routes.some((r) => r.path === '/:id' && r.methods.includes('delete'))).toBe(true);
    });
  });

  // ==========================================
  // 6. HTTP Server & Role Enforcement Boundaries
  // ==========================================
  describe('HTTP Role Enforcement & Security Boundaries', () => {
    it('rejects unauthenticated POST /api/opportunities with 401', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .send({ title: 'Test Role' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated PUT /api/opportunities/:id with 401', async () => {
      const res = await request(app)
        .put('/api/opportunities/644463ea536a4f22bf92c3c7')
        .send({ title: 'Update Title' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated DELETE /api/opportunities/:id with 401', async () => {
      const res = await request(app)
        .delete('/api/opportunities/644463ea536a4f22bf92c3c7');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects student requests to POST /api/opportunities with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Created Opportunity',
          organization: 'Unauthorized Org',
          description: 'Desc',
          type: 'internship',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects student requests to PUT /api/opportunities/:id with 403 Forbidden', async () => {
      const opp = await Opportunity.create({
        title: 'Existing Opp',
        organization: 'Acme',
        description: 'Desc',
        type: 'internship',
      });

      const res = await request(app)
        .put(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Student Edited Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      // Verify unaltered
      const checkOpp = await Opportunity.findById(opp._id);
      expect(checkOpp.title).toBe('Existing Opp');
    });

    it('rejects student requests to DELETE /api/opportunities/:id with 403 Forbidden', async () => {
      const opp = await Opportunity.create({
        title: 'Undeleted Opp',
        organization: 'Acme',
        description: 'Desc',
        type: 'internship',
      });

      const res = await request(app)
        .delete(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      const checkOpp = await Opportunity.findById(opp._id);
      expect(checkOpp.status).not.toBe('archived');
    });
  });

  // ==========================================
  // 7. Validation & Malformed ID Rejections
  // ==========================================
  describe('Validation & Malformed IDs', () => {
    it('returns 400 for malformed ID on GET /api/opportunities/:id', async () => {
      const res = await request(app)
        .get('/api/opportunities/invalid-opp-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid opportunity id/i);
    });

    it('returns 400 for malformed ID on PUT /api/opportunities/:id', async () => {
      const res = await request(app)
        .put('/api/opportunities/not-a-valid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid opportunity id/i);
    });

    it('returns 400 for malformed ID on DELETE /api/opportunities/:id', async () => {
      const res = await request(app)
        .delete('/api/opportunities/not-a-valid-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid opportunity id/i);
    });

    it('returns 404 for nonexistent ID on PUT /api/opportunities/:id', async () => {
      const nonexistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/opportunities/${nonexistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Valid Title' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 for nonexistent ID on DELETE /api/opportunities/:id', async () => {
      const nonexistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/opportunities/${nonexistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 400 on POST with invalid creation payload', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          type: 'invalid_type',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  // ==========================================
  // 8. Admin Opportunity CRUD & Persistence
  // ==========================================
  describe('Admin Opportunity CRUD & Persistence', () => {
    it('creates an opportunity as admin with verification metadata and persistence', async () => {
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Senior Software Engineer Internship',
          organization: 'Google DeepMind',
          description: 'Core research internship role',
          type: 'internship',
          workMode: 'remote',
          status: 'published',
          verified: true,
          applicationUrl: 'https://deepmind.google/careers',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.opportunity).toBeDefined();
      expect(res.body.opportunity.title).toBe('Senior Software Engineer Internship');
      expect(res.body.opportunity.verified).toBe(true);
      expect(res.body.opportunity.verifiedBy.toString()).toBe(adminUser._id.toString());
      expect(res.body.opportunity.verifiedAt).toBeDefined();

      // Verify in DB
      const dbOpp = await Opportunity.findById(res.body.opportunity._id);
      expect(dbOpp).not.toBeNull();
      expect(dbOpp.title).toBe('Senior Software Engineer Internship');
      expect(dbOpp.verifiedBy.toString()).toBe(adminUser._id.toString());
    });

    it('strips injected system fields and verifiedBy from payload and retains server authority', async () => {
      const fakeAdminId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/opportunities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Injection Test Role',
          organization: 'Test Org',
          description: 'Testing injection stripping',
          type: 'fellowship',
          verified: true,
          verifiedBy: fakeAdminId.toString(),
          _id: new mongoose.Types.ObjectId().toString(),
          userId: new mongoose.Types.ObjectId().toString(),
        });

      expect(res.status).toBe(201);
      // The server must override verifiedBy with the actual authenticated adminUser._id
      expect(res.body.opportunity.verifiedBy.toString()).toBe(adminUser._id.toString());
      expect(res.body.opportunity.verifiedBy.toString()).not.toBe(fakeAdminId.toString());
    });

    it('updates an existing opportunity and persists changes to database', async () => {
      const opp = await Opportunity.create({
        title: 'Original Title',
        organization: 'Acme Corp',
        description: 'Original description',
        type: 'internship',
        status: 'draft',
        verified: false,
      });

      const res = await request(app)
        .put(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Title by Admin',
          status: 'published',
          verified: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.opportunity.title).toBe('Updated Title by Admin');
      expect(res.body.opportunity.status).toBe('published');
      expect(res.body.opportunity.verified).toBe(true);
      expect(res.body.opportunity.verifiedBy.toString()).toBe(adminUser._id.toString());

      const dbDoc = await Opportunity.findById(opp._id);
      expect(dbDoc.title).toBe('Updated Title by Admin');
      expect(dbDoc.status).toBe('published');
    });

    it('archives an opportunity on DELETE (soft-delete) and persists archived status', async () => {
      const opp = await Opportunity.create({
        title: 'To Be Archived',
        organization: 'Acme Corp',
        description: 'Description',
        type: 'hackathon',
        status: 'published',
      });

      const res = await request(app)
        .delete(`/api/opportunities/${opp._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.opportunity.status).toBe('archived');

      // Verify soft deletion in DB
      const dbDoc = await Opportunity.findById(opp._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc.status).toBe('archived');
    });
  });

  // ==========================================
  // 9. Catalog Querying with Admin Status Filters
  // ==========================================
  describe('Opportunity Catalog Querying with Status Filters', () => {
    beforeEach(async () => {
      await Opportunity.create([
        {
          title: 'Published Internship',
          organization: 'Org 1',
          description: 'Desc',
          type: 'internship',
          status: 'published',
        },
        {
          title: 'Draft Fellowship',
          organization: 'Org 2',
          description: 'Desc',
          type: 'fellowship',
          status: 'draft',
        },
        {
          title: 'Archived Hackathon',
          organization: 'Org 3',
          description: 'Desc',
          type: 'hackathon',
          status: 'archived',
        },
      ]);
    });

    it('retrieves opportunities of all statuses with ?status=all', async () => {
      const res = await request(app)
        .get('/api/opportunities?status=all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities).toHaveLength(3);
    });

    it('retrieves only draft opportunities with ?status=draft', async () => {
      const res = await request(app)
        .get('/api/opportunities?status=draft')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities).toHaveLength(1);
      expect(res.body.opportunities[0].title).toBe('Draft Fellowship');
    });

    it('defaults to published opportunities when no status filter is provided', async () => {
      const res = await request(app)
        .get('/api/opportunities')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities).toHaveLength(1);
      expect(res.body.opportunities[0].title).toBe('Published Internship');
    });
  });
});
