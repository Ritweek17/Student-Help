import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Application } from '../../src/models/Application.js';
import { Todo } from '../../src/models/Todo.js';
import { Notification } from '../../src/models/Notification.js';

describe('CareerOS Application Follow-Up Actions API Suite (Phase 11G — Batch 5B)', () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  let opp1;
  let opp2;

  const FIXED_REF_DATE = new Date('2026-10-07T12:00:00.000Z');

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      Opportunity.init(),
      Application.init(),
      Todo.init(),
      Notification.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('api_action_user_a', 'student');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('api_action_user_b', 'student');
    userB = authB.user;
    tokenB = authB.token;

    opp1 = await Opportunity.create({
      title: 'Full Stack Engineer Intern',
      organization: 'InnovateX Labs',
      description: 'Building microservices and frontend portals.',
      status: 'published',
      type: 'internship',
    });

    opp2 = await Opportunity.create({
      title: 'Cloud DevOps Specialist',
      organization: 'SkyNet Dynamics',
      description: 'Automating multi-cloud deployment pipelines.',
      status: 'published',
      type: 'internship',
    });
  });

  // -------------------------------------------------------------------------
  // 1. Unauthenticated Requests
  // -------------------------------------------------------------------------
  it('1. Unauthenticated requests - returns 401 Unauthorized', async () => {
    const res1 = await request(app).post('/api/intelligence/applications/actions/followups');
    expect(res1.status).toBe(401);

    const res2 = await request(app).post(`/api/intelligence/applications/${opp1._id}/follow-up`);
    expect(res2.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 2. Single Application Execution (Batch Route with ID)
  // -------------------------------------------------------------------------
  it('2. POST /api/intelligence/applications/actions/followups with applicationId - creates Todo & Notification', async () => {
    const appDoc = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 22 * 24 * 60 * 60 * 1000), // 22 days >= 21 -> High
    });

    const res = await request(app)
      .post('/api/intelligence/applications/actions/followups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        applicationId: appDoc._id.toString(),
        referenceDate: FIXED_REF_DATE.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created.length).toBe(1);
    expect(res.body.created[0].applicationId).toBe(appDoc._id.toString());
    expect(res.body.created[0].priority).toBe('High');
    expect(res.body.created[0].title).toBe('Follow up on application with InnovateX Labs');

    // Verify Todo in database
    const todo = await Todo.findById(res.body.created[0].todoId);
    expect(todo).toBeDefined();
    expect(todo.userId.toString()).toBe(userA._id.toString());
    expect(todo.priority).toBe('High');

    // Verify Notification in database
    const notif = await Notification.findById(res.body.created[0].notificationId);
    expect(notif).toBeDefined();
    expect(notif.userId.toString()).toBe(userA._id.toString());
    expect(notif.title).toBe('Application follow-up recommended');
  });

  // -------------------------------------------------------------------------
  // 3. Single Application Param Route
  // -------------------------------------------------------------------------
  it('3. POST /api/intelligence/applications/:applicationId/follow-up - executes single action successfully', async () => {
    const appDoc = await Application.create({
      userId: userA._id,
      opportunityId: opp2._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 16 * 24 * 60 * 60 * 1000), // 16 days (14 <= age < 21) -> Medium
    });

    const res = await request(app)
      .post(`/api/intelligence/applications/${appDoc._id}/follow-up`)
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ referenceDate: FIXED_REF_DATE.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created.length).toBe(1);
    expect(res.body.created[0].priority).toBe('Medium');
    expect(res.body.created[0].title).toBe('Follow up on application with SkyNet Dynamics');
  });

  // -------------------------------------------------------------------------
  // 4. Ownership Security: User A cannot execute User B application
  // -------------------------------------------------------------------------
  it('4. Ownership security - User A cannot execute User B application (returns 403)', async () => {
    const appB = await Application.create({
      userId: userB._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/intelligence/applications/actions/followups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        applicationId: appB._id.toString(),
        referenceDate: FIXED_REF_DATE.toISOString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Application does not belong to user');

    const todos = await Todo.find({ userId: userB._id });
    expect(todos.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. Non-Existent Application
  // -------------------------------------------------------------------------
  it('5. Non-existent application - returns 404 Not Found', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/intelligence/applications/${fakeId}/follow-up`)
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ referenceDate: FIXED_REF_DATE.toISOString() });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Application not found');
  });

  // -------------------------------------------------------------------------
  // 6. Malformed Application ID
  // -------------------------------------------------------------------------
  it('6. Malformed application ID - returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/intelligence/applications/not-a-mongo-id/follow-up')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid application ID');
  });

  // -------------------------------------------------------------------------
  // 7. Non-Stalled Application
  // -------------------------------------------------------------------------
  it('7. Non-stalled application - returns 200 with skipped reason not_stalled', async () => {
    const appDoc = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days old (< 14)
    });

    const res = await request(app)
      .post('/api/intelligence/applications/actions/followups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        applicationId: appDoc._id.toString(),
        referenceDate: FIXED_REF_DATE.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.created.length).toBe(0);
    expect(res.body.skipped.length).toBe(1);
    expect(res.body.skipped[0].reason).toBe('not_stalled');
  });

  // -------------------------------------------------------------------------
  // 8. Cooldown Protection (7 Days)
  // -------------------------------------------------------------------------
  it('8. Cooldown protection - repeated call within 7 days skips without duplicating', async () => {
    const appDoc = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000),
    });

    // Call 1: created
    const res1 = await request(app)
      .post('/api/intelligence/applications/actions/followups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        applicationId: appDoc._id.toString(),
        referenceDate: FIXED_REF_DATE.toISOString(),
      });
    expect(res1.body.created.length).toBe(1);

    // Call 2: 2 days later
    const twoDaysLater = new Date(FIXED_REF_DATE.getTime() + 2 * 24 * 60 * 60 * 1000);
    const res2 = await request(app)
      .post('/api/intelligence/applications/actions/followups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        applicationId: appDoc._id.toString(),
        referenceDate: twoDaysLater.toISOString(),
      });

    expect(res2.status).toBe(200);
    expect(res2.body.created.length).toBe(0);
    expect(res2.body.skipped.length).toBe(1);
    expect(res2.body.skipped[0].reason).toBe('cooldown_active');

    const totalTodos = await Todo.countDocuments({ userId: userA._id });
    expect(totalTodos).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 9. Batch Execution (No ID passed)
  // -------------------------------------------------------------------------
  it('9. Batch execution - executes all eligible stalled applications for user', async () => {
    // Eligible app 1
    await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 18 * 24 * 60 * 60 * 1000),
    });

    // Eligible app 2
    await Application.create({
      userId: userA._id,
      opportunityId: opp2._id,
      type: 'application',
      status: 'waiting',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/intelligence/applications/actions/followups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        referenceDate: FIXED_REF_DATE.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created.length).toBe(2);

    const todos = await Todo.find({ userId: userA._id });
    expect(todos.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 10. Security - Response Sanitization
  // -------------------------------------------------------------------------
  it('10. Security - response payload contains zero credentials or secrets', async () => {
    const appDoc = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      notes: 'Super secret notes and password: secret_password_xyz',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/intelligence/applications/actions/followups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        applicationId: appDoc._id.toString(),
        referenceDate: FIXED_REF_DATE.toISOString(),
      });

    const rawBody = JSON.stringify(res.body);
    expect(rawBody).not.toContain('secret_password_xyz');
    expect(rawBody).not.toContain('password');
    expect(rawBody).not.toContain('jwtSecret');
  });
});
