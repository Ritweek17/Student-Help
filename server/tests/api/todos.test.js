import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Todo, TODO_CATEGORIES, TODO_PRIORITIES } from '../../src/models/Todo.js';
import {
  validateTodoId,
  validateTodoCreate,
  validateTodoUpdate,
  validateTodoQuery,
} from '../../src/validators/todo.validator.js';
import { todoRouter } from '../../src/routes/todo.routes.js';

describe('CareerOS Todos API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;

  beforeAll(async () => {
    await setupTestDatabase();
    await Todo.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('userA_todos');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('userB_todos');
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
  describe('Todo Model Schema, Enums & Indexes', () => {
    it('defines all conceptual and timestamp fields with appropriate types', () => {
      const paths = Todo.schema.paths;

      expect(paths.userId).toBeDefined();
      expect(paths.userId.instance).toBe('ObjectId');
      expect(paths.userId.isRequired).toBe(true);

      expect(paths.title).toBeDefined();
      expect(paths.title.instance).toBe('String');
      expect(paths.title.isRequired).toBe(true);

      expect(paths.description).toBeDefined();
      expect(paths.description.instance).toBe('String');

      expect(paths.priority).toBeDefined();
      expect(paths.priority.instance).toBe('String');

      expect(paths.category).toBeDefined();
      expect(paths.category.instance).toBe('String');

      expect(paths.dueDate).toBeDefined();
      expect(paths.dueDate.instance).toBe('Date');

      expect(paths.completed).toBeDefined();
      expect(paths.completed.instance).toBe('Boolean');

      expect(paths.completedAt).toBeDefined();
      expect(paths.completedAt.instance).toBe('Date');

      expect(paths.createdAt).toBeDefined();
      expect(paths.updatedAt).toBeDefined();
    });

    it('defines required category and priority enums', () => {
      expect(TODO_PRIORITIES).toContain('High');
      expect(TODO_PRIORITIES).toContain('Medium');
      expect(TODO_PRIORITIES).toContain('Low');

      expect(TODO_CATEGORIES).toEqual(
        expect.arrayContaining(['DSA', 'Development', 'Learning', 'Application', 'General'])
      );
    });

    it('registers required compound MongoDB indexes for query performance', () => {
      const indexes = Todo.schema.indexes();
      const hasUserDueDate = indexes.some(([spec]) => spec.userId === 1 && spec.dueDate === 1);
      const hasUserCompleted = indexes.some(([spec]) => spec.userId === 1 && spec.completed === 1);
      const hasUserCreatedAt = indexes.some(([spec]) => spec.userId === 1 && spec.createdAt === -1);

      expect(hasUserDueDate).toBe(true);
      expect(hasUserCompleted).toBe(true);
      expect(hasUserCreatedAt).toBe(true);
    });
  });

  // ==========================================
  // 3. Validator Unit Tests
  // ==========================================
  describe('Todo Validator Unit Rules', () => {
    it('validates todo ID format correctly', () => {
      expect(validateTodoId(new mongoose.Types.ObjectId().toString())).toBe(true);
      expect(validateTodoId('12345')).toBe(false);
      expect(validateTodoId('')).toBe(false);
      expect(validateTodoId(null)).toBe(false);
      expect(validateTodoId(undefined)).toBe(false);
    });

    it('validates create payload and parses values', () => {
      const res = validateTodoCreate({
        title: 'Complete React 19 Tutorial',
        description: 'Study custom hooks and action patterns',
        priority: 'High',
        category: 'Learning',
        dueDate: '2026-09-15',
        completed: false,
      });

      expect(res.error).toBeNull();
      expect(res.value.title).toBe('Complete React 19 Tutorial');
      expect(res.value.priority).toBe('High');
      expect(res.value.category).toBe('Learning');
      expect(res.value.dueDate instanceof Date).toBe(true);
    });

    it('rejects invalid create payloads (missing title, excessive length, invalid priority)', () => {
      const missingTitle = validateTodoCreate({ description: 'No title' });
      expect(missingTitle.error).toMatch(/title/i);

      const longTitle = validateTodoCreate({ title: 'a'.repeat(201) });
      expect(longTitle.error).toMatch(/200/i);

      const invalidPriority = validateTodoCreate({ title: 'Valid', priority: 'SuperUrgent' });
      expect(invalidPriority.error).toMatch(/priority/i);
    });

    it('rejects client attempt to inject system fields on create', () => {
      const injectUser = validateTodoCreate({
        title: 'Valid title',
        userId: '644463ea536a4f22bf92c3c7',
      });
      expect(injectUser.error).toMatch(/userId/i);

      const injectCompletedAt = validateTodoCreate({
        title: 'Valid title',
        completedAt: new Date(),
      });
      expect(injectCompletedAt.error).toMatch(/timestamp/i);
    });

    it('validates partial updates and guards immutable fields', () => {
      const validUpdate = validateTodoUpdate({
        completed: true,
        priority: 'Low',
        description: 'Updated notes',
      });
      expect(validUpdate.error).toBeNull();
      expect(validUpdate.value.completed).toBe(true);
      expect(validUpdate.value.priority).toBe('Low');

      const immutableId = validateTodoUpdate({ _id: '644463ea536a4f22bf92c3c7' });
      expect(immutableId.error).toMatch(/immutable/i);

      const emptyTitle = validateTodoUpdate({ title: '   ' });
      expect(emptyTitle.error).toMatch(/title/i);
    });

    it('validates query parameters and enforces range constraints', () => {
      const validQuery = validateTodoQuery({
        page: '2',
        limit: '20',
        completed: 'false',
        priority: 'High',
        status: 'today',
      });
      expect(validQuery.error).toBeNull();
      expect(validQuery.value.page).toBe(2);
      expect(validQuery.value.limit).toBe(20);
      expect(validQuery.value.completed).toBe(false);
      expect(validQuery.value.status).toBe('today');

      const invalidDates = validateTodoQuery({
        startDate: '2026-09-20',
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
      expect(todoRouter).toBeDefined();
      const routes = todoRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes.some((r) => r.path === '/todos' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/todos' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/todos/:id' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/todos/:id' && r.methods.includes('put'))).toBe(true);
      expect(routes.some((r) => r.path === '/todos/:id' && r.methods.includes('delete'))).toBe(true);

      const routerMiddleware = todoRouter.stack.filter((layer) => !layer.route);
      expect(routerMiddleware.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 5. Authentication Boundaries
  // ==========================================
  describe('Authentication Boundary', () => {
    it('rejects unauthenticated GET /api/todos with 401', async () => {
      const res = await request(app).get('/api/todos');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated POST /api/todos with 401', async () => {
      const res = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/todos/:id with 401', async () => {
      const res = await request(app).get('/api/todos/644463ea536a4f22bf92c3c7');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated PUT /api/todos/:id with 401', async () => {
      const res = await request(app)
        .put('/api/todos/644463ea536a4f22bf92c3c7')
        .send({ title: 'Update' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated DELETE /api/todos/:id with 401', async () => {
      const res = await request(app).delete('/api/todos/644463ea536a4f22bf92c3c7');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. Validation & Malformed ID Rejection
  // ==========================================
  describe('Validation & Malformed IDs', () => {
    it('returns 400 for malformed ID on GET /api/todos/:id', async () => {
      const res = await request(app)
        .get('/api/todos/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid todo ID');
    });

    it('returns 400 for malformed ID on PUT /api/todos/:id', async () => {
      const res = await request(app)
        .put('/api/todos/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Valid Title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid todo ID');
    });

    it('returns 400 for malformed ID on DELETE /api/todos/:id', async () => {
      const res = await request(app)
        .delete('/api/todos/not-an-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid todo ID');
    });

    it('returns 400 on POST /api/todos with invalid payload', async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: '', priority: 'InvalidPriority' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });

    it('returns 400 on GET /api/todos with inverted date range', async () => {
      const res = await request(app)
        .get('/api/todos?startDate=2026-09-20&endDate=2026-09-10')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/endDate/i);
    });

    it('returns 400 when client attempts to inject protected fields on POST', async () => {
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Hacked Todo',
          userId: fakeUserId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/userId/i);
    });

    it('returns 400 when client attempts to inject protected fields on PUT', async () => {
      const todo = await Todo.create({
        userId: userA._id,
        title: 'Original Todo',
      });

      const res = await request(app)
        .put(`/api/todos/${todo._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          completedAt: new Date().toISOString(),
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
    it('creates a todo, persists to database, and binds userId to session user', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Review System Architecture',
          description: 'Study database replica sets',
          priority: 'High',
          category: 'Development',
          dueDate: '2026-09-20',
          completed: false,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.todo).toBeDefined();
      expect(createRes.body.todo.title).toBe('Review System Architecture');
      expect(createRes.body.todo.priority).toBe('High');
      expect(createRes.body.todo.category).toBe('Development');
      expect(createRes.body.todo.completed).toBe(false);

      const dbDoc = await Todo.findById(createRes.body.todo._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc.userId.toString()).toBe(userA._id.toString());
      expect(dbDoc.title).toBe('Review System Architecture');
    });

    it('sets completedAt when creating a todo with completed: true', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Pre-completed Todo',
          completed: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.todo.completed).toBe(true);
      expect(createRes.body.todo.completedAt).toBeDefined();
    });

    it('retrieves an existing todo by ID', async () => {
      const todo = await Todo.create({
        userId: userA._id,
        title: 'Detail Todo Check',
        priority: 'Medium',
      });

      const res = await request(app)
        .get(`/api/todos/${todo._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.todo._id.toString()).toBe(todo._id.toString());
      expect(res.body.todo.title).toBe('Detail Todo Check');
    });

    it('updates an existing todo and sets completedAt when completed changes to true', async () => {
      const todo = await Todo.create({
        userId: userA._id,
        title: 'Initial Todo Title',
        completed: false,
        completedAt: null,
      });

      const updateRes = await request(app)
        .put(`/api/todos/${todo._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Updated Todo Title',
          completed: true,
          priority: 'High',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.todo.title).toBe('Updated Todo Title');
      expect(updateRes.body.todo.completed).toBe(true);
      expect(updateRes.body.todo.completedAt).toBeDefined();

      const updatedDoc = await Todo.findById(todo._id);
      expect(updatedDoc.title).toBe('Updated Todo Title');
      expect(updatedDoc.completed).toBe(true);
      expect(updatedDoc.completedAt).not.toBeNull();
    });

    it('deletes a todo and verifies removal from database', async () => {
      const todo = await Todo.create({
        userId: userA._id,
        title: 'Todo To Be Deleted',
      });

      const deleteRes = await request(app)
        .delete(`/api/todos/${todo._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.message).toMatch(/deleted successfully/i);

      const dbDoc = await Todo.findById(todo._id);
      expect(dbDoc).toBeNull();

      // Repeated deletion returns 404
      const repeatRes = await request(app)
        .delete(`/api/todos/${todo._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(repeatRes.status).toBe(404);
    });
  });

  // ==========================================
  // 8. Cross-User Isolation & IDOR Protection
  // ==========================================
  describe('Cross-User Ownership & IDOR Protection', () => {
    let todoA;

    beforeEach(async () => {
      todoA = await Todo.create({
        userId: userA._id,
        title: 'User A Secret Todo',
        priority: 'High',
        category: 'Learning',
      });
    });

    it('returns 404 when User B attempts to GET User A todo', async () => {
      const res = await request(app)
        .get(`/api/todos/${todoA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 when User B attempts to PUT User A todo and leaves record unaltered', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const dbDoc = await Todo.findById(todoA._id);
      expect(dbDoc.title).toBe('User A Secret Todo');
    });

    it('returns 404 when User B attempts to DELETE User A todo and leaves record in database', async () => {
      const res = await request(app)
        .delete(`/api/todos/${todoA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const dbDoc = await Todo.findById(todoA._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc._id.toString()).toBe(todoA._id.toString());
    });

    it('ensures User B list view never contains User A records', async () => {
      await Todo.create({
        userId: userB._id,
        title: 'User B Todo',
      });

      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.todos).toHaveLength(1);
      expect(res.body.todos[0].title).toBe('User B Todo');
      expect(res.body.todos[0].userId.toString()).toBe(userB._id.toString());
    });
  });

  // ==========================================
  // 9. Query Filtering, Status Views & Summary Calculations
  // ==========================================
  describe('Query Filtering, Status Views & Summary Stats', () => {
    const today = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    beforeEach(async () => {
      await Todo.create([
        {
          userId: userA._id,
          title: 'Today Todo',
          dueDate: today,
          completed: false,
          priority: 'High',
          category: 'DSA',
        },
        {
          userId: userA._id,
          title: 'Upcoming Todo',
          dueDate: tomorrow,
          completed: false,
          priority: 'Medium',
          category: 'Development',
        },
        {
          userId: userA._id,
          title: 'Completed Todo',
          dueDate: today,
          completed: true,
          priority: 'Low',
          category: 'DSA',
        },
      ]);
    });

    it('filters todos by status "today"', async () => {
      const res = await request(app)
        .get('/api/todos?status=today')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.todos).toHaveLength(1);
      expect(res.body.todos[0].title).toBe('Today Todo');
    });

    it('filters todos by status "upcoming"', async () => {
      const res = await request(app)
        .get('/api/todos?status=upcoming')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.todos).toHaveLength(1);
      expect(res.body.todos[0].title).toBe('Upcoming Todo');
    });

    it('filters todos by priority "High"', async () => {
      const res = await request(app)
        .get('/api/todos?priority=High')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.todos).toHaveLength(1);
      expect(res.body.todos[0].title).toBe('Today Todo');
    });

    it('computes accurate summary statistics for user todos', async () => {
      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.total).toBe(3);
      expect(res.body.summary.completed).toBe(1);
      expect(res.body.summary.pending).toBe(2);
      expect(res.body.summary.today).toBe(1);
      expect(res.body.summary.upcoming).toBe(1);
    });

    it('paginates results accurately', async () => {
      const res = await request(app)
        .get('/api/todos?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.todos).toHaveLength(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.pages).toBe(2);
    });
  });
});
