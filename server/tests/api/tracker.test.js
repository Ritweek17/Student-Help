import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Tracker, TRACKER_CATEGORIES, TRACKER_PRIORITIES } from '../../src/models/Tracker.js';
import {
  validateTrackerId,
  validateTrackerCreate,
  validateTrackerUpdate,
  validateTrackerQuery,
} from '../../src/validators/tracker.validator.js';
import { trackerRouter } from '../../src/routes/tracker.routes.js';

describe('CareerOS Tracker API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;

  beforeAll(async () => {
    await setupTestDatabase();
    await Tracker.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('userA_tracker');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('userB_tracker');
    userB = authB.user;
    tokenB = authB.token;
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
  // 2. Model Schema, Enums & Index Verification
  // ==========================================
  describe('Tracker Model Schema, Enums & Indexes', () => {
    it('defines all conceptual and timestamp fields with appropriate types', () => {
      const paths = Tracker.schema.paths;

      expect(paths.userId).toBeDefined();
      expect(paths.userId.instance).toBe('ObjectId');
      expect(paths.userId.isRequired).toBe(true);

      expect(paths.title).toBeDefined();
      expect(paths.title.instance).toBe('String');
      expect(paths.title.isRequired).toBe(true);

      expect(paths.category).toBeDefined();
      expect(paths.category.instance).toBe('String');
      expect(paths.category.isRequired).toBe(true);

      expect(paths.date).toBeDefined();
      expect(paths.date.instance).toBe('Date');
      expect(paths.date.isRequired).toBe(true);

      expect(paths.durationMinutes).toBeDefined();
      expect(paths.durationMinutes.instance).toBe('Number');

      expect(paths.completed).toBeDefined();
      expect(paths.completed.instance).toBe('Boolean');

      expect(paths.priority).toBeDefined();
      expect(paths.priority.instance).toBe('String');

      expect(paths.notes).toBeDefined();
      expect(paths.createdAt).toBeDefined();
      expect(paths.updatedAt).toBeDefined();
    });

    it('defines required category and priority enums', () => {
      expect(TRACKER_CATEGORIES).toEqual(
        expect.arrayContaining(['DSA', 'Development', 'Project', 'Open Source', 'Learning', 'College'])
      );
      expect(TRACKER_PRIORITIES).toContain('Low');
      expect(TRACKER_PRIORITIES).toContain('Medium');
      expect(TRACKER_PRIORITIES).toContain('High');
    });

    it('registers required compound MongoDB indexes for query performance', () => {
      const indexes = Tracker.schema.indexes();
      const hasUserDate = indexes.some(([spec]) => spec.userId === 1 && spec.date === -1);
      const hasUserCategory = indexes.some(([spec]) => spec.userId === 1 && spec.category === 1);
      const hasUserCompleted = indexes.some(([spec]) => spec.userId === 1 && spec.completed === 1);

      expect(hasUserDate).toBe(true);
      expect(hasUserCategory).toBe(true);
      expect(hasUserCompleted).toBe(true);
    });
  });

  // ==========================================
  // 3. Validator Unit Tests
  // ==========================================
  describe('Tracker Validator Unit Rules', () => {
    it('validates tracker ID format correctly', () => {
      expect(validateTrackerId(new mongoose.Types.ObjectId().toString())).toBe(true);
      expect(validateTrackerId('12345')).toBe(false);
      expect(validateTrackerId('')).toBe(false);
      expect(validateTrackerId(null)).toBe(false);
      expect(validateTrackerId(undefined)).toBe(false);
    });

    it('validates create payload and parses values', () => {
      const res = validateTrackerCreate({
        title: 'Solve LeetCode DP',
        category: 'DSA',
        date: '2026-09-12',
        durationMinutes: 90,
        priority: 'High',
        notes: 'Knapsack',
        completed: false,
      });

      expect(res.error).toBeNull();
      expect(res.value.title).toBe('Solve LeetCode DP');
      expect(res.value.category).toBe('DSA');
      expect(res.value.durationMinutes).toBe(90);
      expect(res.value.priority).toBe('High');
      expect(res.value.notes).toBe('Knapsack');
      expect(res.value.completed).toBe(false);
    });

    it('rejects invalid create payloads (missing title, invalid category, negative duration)', () => {
      const missingTitle = validateTrackerCreate({ category: 'DSA', date: '2026-09-12' });
      expect(missingTitle.error).toMatch(/title/i);

      const invalidCat = validateTrackerCreate({ title: 'Task', category: 'InvalidCat', date: '2026-09-12' });
      expect(invalidCat.error).toMatch(/category/i);

      const negDuration = validateTrackerCreate({
        title: 'Task',
        category: 'DSA',
        date: '2026-09-12',
        durationMinutes: -15,
      });
      expect(negDuration.error).toMatch(/durationMinutes/i);
    });

    it('rejects client attempt to inject system fields on create', () => {
      const injectUser = validateTrackerCreate({
        title: 'Task',
        category: 'DSA',
        date: '2026-09-12',
        userId: '644463ea536a4f22bf92c3c7',
      });
      expect(injectUser.error).toMatch(/userId/i);

      const injectId = validateTrackerCreate({
        title: 'Task',
        category: 'DSA',
        date: '2026-09-12',
        _id: '644463ea536a4f22bf92c3c7',
      });
      expect(injectId.error).toMatch(/_id/i);

      const injectTimestamps = validateTrackerCreate({
        title: 'Task',
        category: 'DSA',
        date: '2026-09-12',
        createdAt: new Date().toISOString(),
      });
      expect(injectTimestamps.error).toMatch(/timestamps/i);
    });

    it('validates partial updates and guards immutable fields', () => {
      const validUpdate = validateTrackerUpdate({
        completed: true,
        durationMinutes: 120,
      });
      expect(validUpdate.error).toBeNull();
      expect(validUpdate.value.completed).toBe(true);
      expect(validUpdate.value.durationMinutes).toBe(120);

      const immutableId = validateTrackerUpdate({ _id: '644463ea536a4f22bf92c3c7' });
      expect(immutableId.error).toMatch(/immutable/i);

      const immutableUser = validateTrackerUpdate({ userId: '644463ea536a4f22bf92c3c7' });
      expect(immutableUser.error).toMatch(/immutable/i);

      const emptyTitle = validateTrackerUpdate({ title: '   ' });
      expect(emptyTitle.error).toMatch(/title/i);
    });

    it('validates query parameters and enforces range constraints', () => {
      const validQuery = validateTrackerQuery({
        page: '2',
        limit: '25',
        date: '2026-09-12',
        category: 'Development',
        completed: 'true',
      });
      expect(validQuery.error).toBeNull();
      expect(validQuery.value.page).toBe(2);
      expect(validQuery.value.limit).toBe(25);
      expect(validQuery.value.category).toBe('Development');
      expect(validQuery.value.completed).toBe(true);

      const invalidDates = validateTrackerQuery({
        startDate: '2026-09-15',
        endDate: '2026-09-10',
      });
      expect(invalidDates.error).toMatch(/endDate/i);
    });
  });

  // ==========================================
  // 4. Express Router & Middleware Declarations
  // ==========================================
  describe('Express Router Declaration', () => {
    it('registers all required CRUD routes with authentication middleware', () => {
      expect(trackerRouter).toBeDefined();
      const routes = trackerRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes.some((r) => r.path === '/tracker' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/tracker' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/tracker/:id' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/tracker/:id' && r.methods.includes('put'))).toBe(true);
      expect(routes.some((r) => r.path === '/tracker/:id' && r.methods.includes('delete'))).toBe(true);

      const routerMiddleware = trackerRouter.stack.filter((layer) => !layer.route);
      expect(routerMiddleware.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 5. Authentication Boundaries
  // ==========================================
  describe('Authentication Boundary', () => {
    it('rejects unauthenticated GET /api/tracker with 401', async () => {
      const res = await request(app).get('/api/tracker');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated POST /api/tracker with 401', async () => {
      const res = await request(app)
        .post('/api/tracker')
        .send({ title: 'Test', category: 'DSA', date: '2026-09-12' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/tracker/:id with 401', async () => {
      const res = await request(app).get('/api/tracker/644463ea536a4f22bf92c3c7');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated PUT /api/tracker/:id with 401', async () => {
      const res = await request(app)
        .put('/api/tracker/644463ea536a4f22bf92c3c7')
        .send({ title: 'Update' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated DELETE /api/tracker/:id with 401', async () => {
      const res = await request(app).delete('/api/tracker/644463ea536a4f22bf92c3c7');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. Validation & Malformed ID Rejection
  // ==========================================
  describe('Validation & Malformed IDs', () => {
    it('returns 400 for malformed ID on GET /api/tracker/:id', async () => {
      const res = await request(app)
        .get('/api/tracker/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid activity ID');
    });

    it('returns 400 for malformed ID on PUT /api/tracker/:id', async () => {
      const res = await request(app)
        .put('/api/tracker/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Valid New Title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid activity ID');
    });

    it('returns 400 for malformed ID on DELETE /api/tracker/:id', async () => {
      const res = await request(app)
        .delete('/api/tracker/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid activity ID');
    });

    it('returns 400 on POST /api/tracker with invalid payload', async () => {
      const res = await request(app)
        .post('/api/tracker')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: '', category: 'InvalidCat' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });

    it('returns 400 on GET /api/tracker with inverted date range', async () => {
      const res = await request(app)
        .get('/api/tracker?startDate=2026-09-20&endDate=2026-09-10')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/endDate/i);
    });

    it('returns 400 when client attempts to inject protected fields on POST', async () => {
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/tracker')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Hacked Tracker',
          category: 'DSA',
          date: '2026-09-12',
          userId: fakeUserId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/userId/i);
    });

    it('returns 400 when client attempts to inject protected fields on PUT', async () => {
      const activity = await Tracker.create({
        userId: userA._id,
        title: 'Original Task',
        category: 'DSA',
        date: new Date(),
      });

      const res = await request(app)
        .put(`/api/tracker/${activity._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          userId: userB._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/immutable/i);
    });
  });

  // ==========================================
  // 7. CRUD Lifecycle & Persistence for User A
  // ==========================================
  describe('Full CRUD Lifecycle & Persistence', () => {
    it('creates an activity, persists to database, and binds userId to session user', async () => {
      const createRes = await request(app)
        .post('/api/tracker')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Implement Binary Search',
          category: 'DSA',
          date: '2026-09-15',
          durationMinutes: 45,
          priority: 'High',
          notes: 'Cover edge cases',
          completed: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.activity).toBeDefined();
      expect(createRes.body.activity.title).toBe('Implement Binary Search');
      expect(createRes.body.activity.durationMinutes).toBe(45);
      expect(createRes.body.activity.priority).toBe('High');
      expect(createRes.body.activity.completed).toBe(true);

      const dbDoc = await Tracker.findById(createRes.body.activity._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc.userId.toString()).toBe(userA._id.toString());
      expect(dbDoc.title).toBe('Implement Binary Search');
    });

    it('retrieves an existing activity by ID', async () => {
      const activity = await Tracker.create({
        userId: userA._id,
        title: 'System Design Session',
        category: 'Development',
        date: new Date('2026-09-16'),
        durationMinutes: 60,
      });

      const res = await request(app)
        .get(`/api/tracker/${activity._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activity._id.toString()).toBe(activity._id.toString());
      expect(res.body.activity.title).toBe('System Design Session');
    });

    it('updates an existing activity and verifies persistence', async () => {
      const activity = await Tracker.create({
        userId: userA._id,
        title: 'Initial Title',
        category: 'Project',
        date: new Date('2026-09-16'),
        durationMinutes: 30,
        completed: false,
      });

      const updateRes = await request(app)
        .put(`/api/tracker/${activity._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Updated Title',
          completed: true,
          durationMinutes: 90,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.activity.title).toBe('Updated Title');
      expect(updateRes.body.activity.completed).toBe(true);
      expect(updateRes.body.activity.durationMinutes).toBe(90);

      const updatedDoc = await Tracker.findById(activity._id);
      expect(updatedDoc.title).toBe('Updated Title');
      expect(updatedDoc.completed).toBe(true);
      expect(updatedDoc.durationMinutes).toBe(90);
    });

    it('deletes an activity and verifies removal from database', async () => {
      const activity = await Tracker.create({
        userId: userA._id,
        title: 'To Be Deleted',
        category: 'College',
        date: new Date(),
      });

      const deleteRes = await request(app)
        .delete(`/api/tracker/${activity._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.message).toMatch(/deleted successfully/i);

      const dbDoc = await Tracker.findById(activity._id);
      expect(dbDoc).toBeNull();

      // Repeated deletion returns 404
      const repeatRes = await request(app)
        .delete(`/api/tracker/${activity._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(repeatRes.status).toBe(404);
    });
  });

  // ==========================================
  // 8. Cross-User Isolation & IDOR Protection
  // ==========================================
  describe('Cross-User Ownership & IDOR Protection', () => {
    let activityA;

    beforeEach(async () => {
      activityA = await Tracker.create({
        userId: userA._id,
        title: 'User A Secret Activity',
        category: 'DSA',
        date: new Date('2026-09-10'),
        durationMinutes: 120,
        completed: true,
      });
    });

    it('returns 404 when User B attempts to GET User A activity', async () => {
      const res = await request(app)
        .get(`/api/tracker/${activityA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 when User B attempts to PUT User A activity and leaves record unaltered', async () => {
      const res = await request(app)
        .put(`/api/tracker/${activityA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const dbDoc = await Tracker.findById(activityA._id);
      expect(dbDoc.title).toBe('User A Secret Activity');
    });

    it('returns 404 when User B attempts to DELETE User A activity and leaves record in database', async () => {
      const res = await request(app)
        .delete(`/api/tracker/${activityA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const dbDoc = await Tracker.findById(activityA._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc._id.toString()).toBe(activityA._id.toString());
    });

    it('ensures User B list view never contains User A records', async () => {
      await Tracker.create({
        userId: userB._id,
        title: 'User B Activity',
        category: 'DSA',
        date: new Date('2026-09-10'),
      });

      const res = await request(app)
        .get('/api/tracker')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.activities).toHaveLength(1);
      expect(res.body.activities[0].title).toBe('User B Activity');
      expect(res.body.activities[0].userId.toString()).toBe(userB._id.toString());
    });
  });

  // ==========================================
  // 9. Query Filtering, Pagination & Summary Calculations
  // ==========================================
  describe('Query Filtering, Pagination & Summary Stats', () => {
    beforeEach(async () => {
      await Tracker.create([
        {
          userId: userA._id,
          title: 'DSA Problem 1',
          category: 'DSA',
          date: new Date('2026-09-01'),
          durationMinutes: 30,
          completed: true,
        },
        {
          userId: userA._id,
          title: 'DSA Problem 2',
          category: 'DSA',
          date: new Date('2026-09-02'),
          durationMinutes: 45,
          completed: false,
        },
        {
          userId: userA._id,
          title: 'React Component',
          category: 'Development',
          date: new Date('2026-09-03'),
          durationMinutes: 60,
          completed: true,
        },
      ]);
    });

    it('filters activities by category', async () => {
      const res = await request(app)
        .get('/api/tracker?category=DSA')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.activities).toHaveLength(2);
      expect(res.body.activities.every((a) => a.category === 'DSA')).toBe(true);
    });

    it('filters activities by completed status', async () => {
      const res = await request(app)
        .get('/api/tracker?completed=true')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.activities).toHaveLength(2);
      expect(res.body.activities.every((a) => a.completed === true)).toBe(true);
    });

    it('computes accurate summary statistics for user queries', async () => {
      const res = await request(app)
        .get('/api/tracker')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalActivities).toBe(3);
      expect(res.body.summary.completedActivities).toBe(2);
      // Completed duration: 30 + 60 = 90
      expect(res.body.summary.totalDurationMinutes).toBe(90);
    });

    it('paginates results accurately', async () => {
      const res = await request(app)
        .get('/api/tracker?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.activities).toHaveLength(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.pages).toBe(2);
    });
  });
});
