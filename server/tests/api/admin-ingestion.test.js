import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../src/models/OpportunityIngestionRun.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import * as ingestionService from '../../src/services/ingestion/ingestion.service.js';
import { adminIngestionRouter } from '../../src/routes/admin.ingestion.routes.js';

describe('CareerOS Admin Ingestion API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let studentUser;
  let studentToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      OpportunitySource.init(),
      OpportunityIngestionRun.init(),
      Opportunity.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const studentAuth = await createTestUser('student_ingestion', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;

    const adminAuth = await createTestUser('admin_ingestion', 'admin');
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
  // 2. Express Router Configuration
  // ==========================================
  describe('Express Admin Ingestion Router Declarations', () => {
    it('registers all required source, ingestion run, and curation endpoints protected by admin middleware', () => {
      expect(adminIngestionRouter).toBeDefined();
      const routes = adminIngestionRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes.some((r) => r.path === '/sources' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/sources/:id' && r.methods.includes('patch'))).toBe(true);
      expect(routes.some((r) => r.path === '/ingestion-runs' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/ingestion-runs/:id' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/opportunities/bulk' && r.methods.includes('post'))).toBe(true);

      const routerMiddleware = adminIngestionRouter.stack.filter((layer) => !layer.route);
      expect(routerMiddleware.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 3. Authentication & Role Boundaries
  // ==========================================
  describe('Authentication & Role Authorization Boundaries', () => {
    it('rejects unauthenticated requests to all admin ingestion endpoints with 401', async () => {
      const getSources = await request(app).get('/api/admin/sources');
      expect(getSources.status).toBe(401);
      expect(getSources.body.success).toBe(false);

      const patchSource = await request(app).patch('/api/admin/sources/644463ea536a4f22bf92c3c7');
      expect(patchSource.status).toBe(401);

      const getRuns = await request(app).get('/api/admin/ingestion-runs');
      expect(getRuns.status).toBe(401);

      const getRun = await request(app).get('/api/admin/ingestion-runs/644463ea536a4f22bf92c3c7');
      expect(getRun.status).toBe(401);

      const bulkCurate = await request(app).post('/api/admin/opportunities/bulk');
      expect(bulkCurate.status).toBe(401);
    });

    it('rejects student role requests to all admin ingestion endpoints with 403 Forbidden', async () => {
      const getSources = await request(app)
        .get('/api/admin/sources')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(getSources.status).toBe(403);
      expect(getSources.body.success).toBe(false);

      const patchSource = await request(app)
        .patch('/api/admin/sources/644463ea536a4f22bf92c3c7')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ enabled: false });
      expect(patchSource.status).toBe(403);

      const getRuns = await request(app)
        .get('/api/admin/ingestion-runs')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(getRuns.status).toBe(403);

      const getRun = await request(app)
        .get('/api/admin/ingestion-runs/644463ea536a4f22bf92c3c7')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(getRun.status).toBe(403);

      const bulkCurate = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ action: 'approve', ids: [] });
      expect(bulkCurate.status).toBe(403);
    });
  });

  // ==========================================
  // 4. Source Management API (/api/admin/sources)
  // ==========================================
  describe('Source Management API (/api/admin/sources)', () => {
    let source;

    beforeEach(async () => {
      source = await OpportunitySource.create({
        name: 'Remote Jobs API',
        slug: 'remote-jobs-api',
        type: 'api',
        baseUrl: 'https://api.remotejobs.test',
        enabled: true,
        priority: 5,
        isLocked: false,
        lockedBy: 'worker-1',
      });
    });

    it('lists opportunity sources with safe projection (never leaks lockedBy)', async () => {
      const res = await request(app)
        .get('/api/admin/sources')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.sources)).toBe(true);
      expect(res.body.sources.length).toBeGreaterThan(0);

      // Strict security check: lockedBy must NEVER be projected
      expect(res.body.sources.some((s) => 'lockedBy' in s)).toBe(false);

      const matched = res.body.sources.find((s) => s.slug === 'remote-jobs-api');
      expect(matched).toBeDefined();
      expect(matched.name).toBe('Remote Jobs API');
      expect(matched.priority).toBe(5);
    });

    it('updates source enabled state and priority and persists to database', async () => {
      const res = await request(app)
        .patch(`/api/admin/sources/${source._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: false,
          priority: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source.enabled).toBe(false);
      expect(res.body.source.priority).toBe(10);

      const dbDoc = await OpportunitySource.findById(source._id);
      expect(dbDoc.enabled).toBe(false);
      expect(dbDoc.priority).toBe(10);
    });

    it('ignores client attempts to alter protected fields such as lockedBy during update', async () => {
      const res = await request(app)
        .patch(`/api/admin/sources/${source._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 8,
          lockedBy: 'hacker-override',
          isLocked: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.source.priority).toBe(8);

      const dbDoc = await OpportunitySource.findById(source._id);
      expect(dbDoc.priority).toBe(8);
      // lockedBy should not be altered to 'hacker-override'
      expect(dbDoc.lockedBy).toBe('worker-1');
    });

    it('returns 400 when no valid update fields are supplied', async () => {
      const res = await request(app)
        .patch(`/api/admin/sources/${source._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lockedBy: 'attempt-only-protected-field',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/no valid fields to update/i);
    });

    it('returns 400 for malformed source ID on PATCH', async () => {
      const res = await request(app)
        .patch('/api/admin/sources/not-an-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid source ID');
    });

    it('returns 404 for nonexistent source ID on PATCH', async () => {
      const nonexistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/sources/${nonexistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Source not found');
    });
  });

  // ==========================================
  // 5. Ingestion Runs API (/api/admin/ingestion-runs)
  // ==========================================
  describe('Ingestion Runs API (/api/admin/ingestion-runs)', () => {
    let sourceA;
    let sourceB;
    let runA;
    let runB;

    beforeEach(async () => {
      sourceA = await OpportunitySource.create({
        name: 'Source Alpha',
        slug: 'source-alpha',
        type: 'api',
        priority: 1,
      });

      sourceB = await OpportunitySource.create({
        name: 'Source Beta',
        slug: 'source-beta',
        type: 'api',
        priority: 2,
      });

      runA = await ingestionService.createIngestionRun(sourceA._id, { test: true });
      await ingestionService.markRunSuccess(runA._id, { fetchedCount: 25, createdCount: 5 });

      runB = await ingestionService.createIngestionRun(sourceB._id, { test: true });
    });

    it('lists ingestion runs with populated source information and pagination', async () => {
      const res = await request(app)
        .get('/api/admin/ingestion-runs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.runs)).toBe(true);
      expect(res.body.runs).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);

      // Verify populated source
      const firstRun = res.body.runs[0];
      expect(firstRun.sourceId).toBeDefined();
      expect(firstRun.sourceId.name).toBeDefined();
      expect(firstRun.sourceId.slug).toBeDefined();
    });

    it('filters ingestion runs by sourceId and status', async () => {
      const resSourceFilter = await request(app)
        .get(`/api/admin/ingestion-runs?sourceId=${sourceA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resSourceFilter.status).toBe(200);
      expect(resSourceFilter.body.runs).toHaveLength(1);
      expect(resSourceFilter.body.runs[0]._id.toString()).toBe(runA._id.toString());

      const resStatusFilter = await request(app)
        .get('/api/admin/ingestion-runs?status=completed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resStatusFilter.status).toBe(200);
      expect(resStatusFilter.body.runs).toHaveLength(1);
      expect(resStatusFilter.body.runs[0].status).toBe('completed');
    });

    it('returns 400 for malformed sourceId query filter', async () => {
      const res = await request(app)
        .get('/api/admin/ingestion-runs?sourceId=invalid-source-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid source id filter/i);
    });

    it('retrieves single ingestion run by ID with populated source', async () => {
      const res = await request(app)
        .get(`/api/admin/ingestion-runs/${runA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.run._id.toString()).toBe(runA._id.toString());
      expect(res.body.run.fetchedCount).toBe(25);
      expect(res.body.run.sourceId.slug).toBe('source-alpha');
    });

    it('returns 400 for malformed run ID', async () => {
      const res = await request(app)
        .get('/api/admin/ingestion-runs/not-a-valid-run-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid run ID');
    });

    it('returns 404 for nonexistent run ID', async () => {
      const nonexistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/admin/ingestion-runs/${nonexistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Run not found');
    });
  });

  // ==========================================
  // 6. Bulk Curation API (/api/admin/opportunities/bulk)
  // ==========================================
  describe('Bulk Curation API (/api/admin/opportunities/bulk)', () => {
    let draft1;
    let draft2;

    beforeEach(async () => {
      draft1 = await Opportunity.create({
        title: 'Draft Ingested Opp 1',
        organization: 'Acme Test',
        description: 'Testing bulk curation',
        type: 'internship',
        status: 'draft',
        verified: false,
      });

      draft2 = await Opportunity.create({
        title: 'Draft Ingested Opp 2',
        organization: 'Acme Test',
        description: 'Testing bulk curation',
        type: 'internship',
        status: 'draft',
        verified: false,
      });
    });

    it('approves draft opportunities in bulk, publishing and setting verification metadata', async () => {
      const res = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          ids: [draft1._id.toString(), 'invalid-id-format'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.successful).toBe(1);
      expect(res.body.results.skipped).toBe(1);

      // Verify in DB that draft1 was published, verified=true, verifiedBy=adminUser._id
      const approvedDoc = await Opportunity.findById(draft1._id);
      expect(approvedDoc.status).toBe('published');
      expect(approvedDoc.verified).toBe(true);
      expect(approvedDoc.verifiedBy.toString()).toBe(adminUser._id.toString());
      expect(approvedDoc.verifiedAt).toBeDefined();
    });

    it('archives draft opportunities in bulk', async () => {
      const res = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'archive',
          ids: [draft2._id.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.successful).toBe(1);

      const archivedDoc = await Opportunity.findById(draft2._id);
      expect(archivedDoc.status).toBe('archived');
    });

    it('rejects batch size exceeding maximum limit of 50 with 400', async () => {
      const largeBatch = Array(60).fill(draft1._id.toString());
      const res = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          ids: largeBatch,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/batch size exceeds maximum limit of 50/i);
    });

    it('rejects invalid bulk action with 400', async () => {
      const res = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'delete_permanent',
          ids: [draft1._id.toString()],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid bulk action/i);
    });

    it('rejects empty or non-array ids with 400', async () => {
      const emptyRes = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          ids: [],
        });
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.message).toMatch(/must provide an array/i);

      const notArrayRes = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          ids: 'not-an-array',
        });
      expect(notArrayRes.status).toBe(400);
    });

    it('rejects request with 400 when no valid ObjectIds are provided', async () => {
      const res = await request(app)
        .post('/api/admin/opportunities/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          ids: ['invalid-id-1', 'invalid-id-2'],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/no valid opportunity ids provided/i);
    });
  });
});
