import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Goal, GOAL_CATEGORIES, GOAL_PRIORITIES, GOAL_STATUSES } from '../../src/models/Goal.js';
import {
  validateGoalId,
  validateGoalCreate,
  validateGoalUpdate,
  validateGoalQuery,
} from '../../src/validators/goal.validator.js';
import { goalRouter } from '../../src/routes/goal.routes.js';

describe('CareerOS Goals API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;

  beforeAll(async () => {
    await setupTestDatabase();
    await Goal.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('userA_goals');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('userB_goals');
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
  describe('Goal Model Schema, Enums & Indexes', () => {
    it('defines all conceptual and timestamp fields with appropriate types', () => {
      const paths = Goal.schema.paths;

      expect(paths.userId).toBeDefined();
      expect(paths.userId.instance).toBe('ObjectId');
      expect(paths.userId.isRequired).toBe(true);

      expect(paths.title).toBeDefined();
      expect(paths.title.instance).toBe('String');
      expect(paths.title.isRequired).toBe(true);

      expect(paths.description).toBeDefined();
      expect(paths.description.instance).toBe('String');

      expect(paths.category).toBeDefined();
      expect(paths.category.instance).toBe('String');

      expect(paths.targetValue).toBeDefined();
      expect(paths.targetValue.instance).toBe('Number');
      expect(paths.targetValue.isRequired).toBe(true);

      expect(paths.currentValue).toBeDefined();
      expect(paths.currentValue.instance).toBe('Number');

      expect(paths.unit).toBeDefined();
      expect(paths.unit.instance).toBe('String');

      expect(paths.deadline).toBeDefined();
      expect(paths.deadline.instance).toBe('Date');

      expect(paths.status).toBeDefined();
      expect(paths.status.instance).toBe('String');

      expect(paths.priority).toBeDefined();
      expect(paths.priority.instance).toBe('String');

      expect(paths.createdAt).toBeDefined();
      expect(paths.updatedAt).toBeDefined();
    });

    it('defines required category, status, and priority enums', () => {
      expect(GOAL_STATUSES).toEqual(
        expect.arrayContaining(['active', 'completed', 'paused'])
      );
      expect(GOAL_PRIORITIES).toEqual(
        expect.arrayContaining(['High', 'Medium', 'Low'])
      );
      expect(GOAL_CATEGORIES).toEqual(
        expect.arrayContaining(['DSA', 'Development', 'Career', 'Learning', 'Project'])
      );
    });

    it('registers required compound MongoDB indexes for query performance', () => {
      const indexes = Goal.schema.indexes();
      const hasUserStatus = indexes.some(([spec]) => spec.userId === 1 && spec.status === 1);
      const hasUserDeadline = indexes.some(([spec]) => spec.userId === 1 && spec.deadline === 1);
      const hasUserCreatedAt = indexes.some(([spec]) => spec.userId === 1 && spec.createdAt === -1);

      expect(hasUserStatus).toBe(true);
      expect(hasUserDeadline).toBe(true);
      expect(hasUserCreatedAt).toBe(true);
    });
  });

  // ==========================================
  // 3. Validator Unit Tests
  // ==========================================
  describe('Goal Validator Unit Rules', () => {
    it('validates goal ID format correctly', () => {
      expect(validateGoalId(new mongoose.Types.ObjectId().toString())).toBe(true);
      expect(validateGoalId('12345')).toBe(false);
      expect(validateGoalId('')).toBe(false);
      expect(validateGoalId(null)).toBe(false);
      expect(validateGoalId(undefined)).toBe(false);
    });

    it('validates create payload and parses values', () => {
      const res = validateGoalCreate({
        title: 'Solve 150 LeetCode Medium DSA Problems',
        description: 'Master binary trees and DP',
        category: 'DSA',
        targetValue: 150,
        currentValue: 67,
        unit: 'problems',
        deadline: '2026-12-31',
        priority: 'High',
      });

      expect(res.error).toBeNull();
      expect(res.value.title).toBe('Solve 150 LeetCode Medium DSA Problems');
      expect(res.value.targetValue).toBe(150);
      expect(res.value.currentValue).toBe(67);
      expect(res.value.unit).toBe('problems');
      expect(res.value.deadline instanceof Date).toBe(true);
    });

    it('rejects invalid create payloads (missing title, zero/negative targetValue, negative currentValue, invalid category)', () => {
      const missingTitle = validateGoalCreate({ targetValue: 100 });
      expect(missingTitle.error).toMatch(/title/i);

      const zeroTarget = validateGoalCreate({ title: 'Goal', targetValue: 0 });
      expect(zeroTarget.error).toMatch(/target value/i);

      const negTarget = validateGoalCreate({ title: 'Goal', targetValue: -10 });
      expect(negTarget.error).toMatch(/target value/i);

      const negCurrent = validateGoalCreate({ title: 'Goal', targetValue: 100, currentValue: -5 });
      expect(negCurrent.error).toMatch(/current value/i);

      const invalidCat = validateGoalCreate({ title: 'Goal', targetValue: 100, category: 'InvalidCategoryName' });
      expect(invalidCat.error).toMatch(/category/i);
    });

    it('rejects client attempt to inject system fields on create', () => {
      const injectUser = validateGoalCreate({
        title: 'Goal',
        targetValue: 100,
        userId: '644463ea536a4f22bf92c3c7',
      });
      expect(injectUser.error).toMatch(/userId/i);

      const injectId = validateGoalCreate({
        title: 'Goal',
        targetValue: 100,
        _id: '644463ea536a4f22bf92c3c7',
      });
      expect(injectId.error).toMatch(/_id/i);

      const injectTimestamps = validateGoalCreate({
        title: 'Goal',
        targetValue: 100,
        createdAt: new Date().toISOString(),
      });
      expect(injectTimestamps.error).toMatch(/timestamps/i);
    });

    it('validates partial updates and guards immutable fields', () => {
      const validUpdate = validateGoalUpdate({
        currentValue: 75,
        status: 'active',
      });
      expect(validUpdate.error).toBeNull();
      expect(validUpdate.value.currentValue).toBe(75);
      expect(validUpdate.value.status).toBe('active');

      const immutableId = validateGoalUpdate({ _id: '644463ea536a4f22bf92c3c7' });
      expect(immutableId.error).toMatch(/immutable/i);

      const negCurrentUpdate = validateGoalUpdate({ currentValue: -10 });
      expect(negCurrentUpdate.error).toMatch(/current value/i);
    });

    it('validates query parameters and enforces range constraints', () => {
      const validQuery = validateGoalQuery({
        page: '2',
        limit: '20',
        status: 'active',
        category: 'DSA',
      });
      expect(validQuery.error).toBeNull();
      expect(validQuery.value.page).toBe(2);
      expect(validQuery.value.limit).toBe(20);
      expect(validQuery.value.status).toBe('active');
      expect(validQuery.value.category).toBe('DSA');

      const invalidDates = validateGoalQuery({
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      });
      expect(invalidDates.error).toMatch(/endDate/i);
    });
  });

  // ==========================================
  // 4. Express Router & Middleware Declarations
  // ==========================================
  describe('Express Router Declaration', () => {
    it('registers all required CRUD routes with authentication middleware', () => {
      expect(goalRouter).toBeDefined();
      const routes = goalRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes.some((r) => r.path === '/goals' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/goals' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/goals/:id' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/goals/:id' && r.methods.includes('put'))).toBe(true);
      expect(routes.some((r) => r.path === '/goals/:id' && r.methods.includes('delete'))).toBe(true);

      const routerMiddleware = goalRouter.stack.filter((layer) => !layer.route);
      expect(routerMiddleware.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 5. Authentication Boundaries
  // ==========================================
  describe('Authentication Boundary', () => {
    it('rejects unauthenticated GET /api/goals with 401', async () => {
      const res = await request(app).get('/api/goals');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated POST /api/goals with 401', async () => {
      const res = await request(app)
        .post('/api/goals')
        .send({ title: 'Test Goal', targetValue: 50 });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/goals/:id with 401', async () => {
      const res = await request(app).get('/api/goals/644463ea536a4f22bf92c3c7');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated PUT /api/goals/:id with 401', async () => {
      const res = await request(app)
        .put('/api/goals/644463ea536a4f22bf92c3c7')
        .send({ title: 'Update' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated DELETE /api/goals/:id with 401', async () => {
      const res = await request(app).delete('/api/goals/644463ea536a4f22bf92c3c7');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. Validation & Malformed ID Rejection
  // ==========================================
  describe('Validation & Malformed IDs', () => {
    it('returns 400 for malformed ID on GET /api/goals/:id', async () => {
      const res = await request(app)
        .get('/api/goals/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid goal ID');
    });

    it('returns 400 for malformed ID on PUT /api/goals/:id', async () => {
      const res = await request(app)
        .put('/api/goals/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Valid New Title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid goal ID');
    });

    it('returns 400 for malformed ID on DELETE /api/goals/:id', async () => {
      const res = await request(app)
        .delete('/api/goals/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid goal ID');
    });

    it('returns 400 on POST /api/goals with invalid payload', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: '', targetValue: -10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });

    it('returns 400 on GET /api/goals with inverted date range', async () => {
      const res = await request(app)
        .get('/api/goals?startDate=2026-12-31&endDate=2026-01-01')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/endDate/i);
    });

    it('returns 400 when client attempts to inject protected fields on POST', async () => {
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Hacked Goal',
          targetValue: 100,
          userId: fakeUserId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/userId/i);
    });

    it('returns 400 when client attempts to inject protected fields on PUT', async () => {
      const goal = await Goal.create({
        userId: userA._id,
        title: 'Original Goal',
        targetValue: 100,
      });

      const res = await request(app)
        .put(`/api/goals/${goal._id}`)
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
  describe('Full CRUD Lifecycle, Progress Rules & Persistence', () => {
    it('creates a goal, persists to database, and binds userId to session user', async () => {
      const createRes = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Master Frontend Architecture',
          description: 'Build 5 production apps',
          category: 'Development',
          targetValue: 5,
          currentValue: 2,
          unit: 'apps',
          deadline: '2026-12-31',
          priority: 'High',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.goal).toBeDefined();
      expect(createRes.body.goal.title).toBe('Master Frontend Architecture');
      expect(createRes.body.goal.targetValue).toBe(5);
      expect(createRes.body.goal.currentValue).toBe(2);
      expect(createRes.body.goal.status).toBe('active');

      const dbDoc = await Goal.findById(createRes.body.goal._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc.userId.toString()).toBe(userA._id.toString());
      expect(dbDoc.title).toBe('Master Frontend Architecture');
    });

    it('auto-completes a goal on create if currentValue >= targetValue', async () => {
      const createRes = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Already Met Goal',
          targetValue: 10,
          currentValue: 10,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.goal.status).toBe('completed');
    });

    it('retrieves an existing goal by ID', async () => {
      const goal = await Goal.create({
        userId: userA._id,
        title: 'Detail Goal Check',
        targetValue: 50,
        currentValue: 10,
      });

      const res = await request(app)
        .get(`/api/goals/${goal._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.goal._id.toString()).toBe(goal._id.toString());
      expect(res.body.goal.title).toBe('Detail Goal Check');
    });

    it('updates progress and auto-transitions status to completed when target is reached', async () => {
      const goal = await Goal.create({
        userId: userA._id,
        title: 'Progress Tracking Goal',
        targetValue: 100,
        currentValue: 80,
        status: 'active',
      });

      const updateRes = await request(app)
        .put(`/api/goals/${goal._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentValue: 100,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.goal.currentValue).toBe(100);
      expect(updateRes.body.goal.status).toBe('completed');

      const updatedDoc = await Goal.findById(goal._id);
      expect(updatedDoc.status).toBe('completed');
    });

    it('deletes a goal and verifies removal from database', async () => {
      const goal = await Goal.create({
        userId: userA._id,
        title: 'Goal To Be Deleted',
        targetValue: 20,
      });

      const deleteRes = await request(app)
        .delete(`/api/goals/${goal._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.message).toMatch(/deleted successfully/i);

      const dbDoc = await Goal.findById(goal._id);
      expect(dbDoc).toBeNull();

      // Repeated deletion returns 404
      const repeatRes = await request(app)
        .delete(`/api/goals/${goal._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(repeatRes.status).toBe(404);
    });
  });

  // ==========================================
  // 8. Cross-User Isolation & IDOR Protection
  // ==========================================
  describe('Cross-User Ownership & IDOR Protection', () => {
    let goalA;

    beforeEach(async () => {
      goalA = await Goal.create({
        userId: userA._id,
        title: 'User A Secret Goal',
        targetValue: 100,
        currentValue: 40,
        category: 'Career',
        status: 'active',
      });
    });

    it('returns 404 when User B attempts to GET User A goal', async () => {
      const res = await request(app)
        .get(`/api/goals/${goalA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 when User B attempts to PUT User A goal and leaves record unaltered', async () => {
      const res = await request(app)
        .put(`/api/goals/${goalA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: 'Hacked Goal Title' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const dbDoc = await Goal.findById(goalA._id);
      expect(dbDoc.title).toBe('User A Secret Goal');
    });

    it('returns 404 when User B attempts to DELETE User A goal and leaves record in database', async () => {
      const res = await request(app)
        .delete(`/api/goals/${goalA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const dbDoc = await Goal.findById(goalA._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc._id.toString()).toBe(goalA._id.toString());
    });

    it('ensures User B list view never contains User A records', async () => {
      await Goal.create({
        userId: userB._id,
        title: 'User B Goal',
        targetValue: 50,
      });

      const res = await request(app)
        .get('/api/goals')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.goals).toHaveLength(1);
      expect(res.body.goals[0].title).toBe('User B Goal');
      expect(res.body.goals[0].userId.toString()).toBe(userB._id.toString());
    });
  });

  // ==========================================
  // 9. Query Filtering, Pagination & Summary Calculations
  // ==========================================
  describe('Query Filtering, Pagination & Summary Stats', () => {
    beforeEach(async () => {
      await Goal.create([
        {
          userId: userA._id,
          title: 'Active DSA Goal',
          category: 'DSA',
          targetValue: 100,
          currentValue: 50,
          status: 'active',
        },
        {
          userId: userA._id,
          title: 'Completed Career Goal',
          category: 'Career',
          targetValue: 10,
          currentValue: 10,
          status: 'completed',
        },
        {
          userId: userA._id,
          title: 'Paused Project Goal',
          category: 'Project',
          targetValue: 5,
          currentValue: 2,
          status: 'paused',
        },
      ]);
    });

    it('filters goals by status "active"', async () => {
      const res = await request(app)
        .get('/api/goals?status=active')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.goals).toHaveLength(1);
      expect(res.body.goals[0].title).toBe('Active DSA Goal');
    });

    it('filters goals by category "DSA"', async () => {
      const res = await request(app)
        .get('/api/goals?category=DSA')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.goals).toHaveLength(1);
      expect(res.body.goals[0].category).toBe('DSA');
    });

    it('computes accurate summary statistics and average progress for user goals', async () => {
      const res = await request(app)
        .get('/api/goals')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.total).toBe(3);
      expect(res.body.summary.active).toBe(1);
      expect(res.body.summary.completed).toBe(1);
      expect(res.body.summary.paused).toBe(1);
      // Progress calculations:
      // Goal 1: 50 / 100 = 50%
      // Goal 2: 10 / 10 = 100%
      // Goal 3: 2 / 5 = 40%
      // Average: (50 + 100 + 40) / 3 = 190 / 3 = 63.3%
      expect(res.body.summary.averageProgress).toBe(63.3);
    });

    it('paginates results accurately', async () => {
      const res = await request(app)
        .get('/api/goals?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.goals).toHaveLength(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.pages).toBe(2);
    });
  });
});
