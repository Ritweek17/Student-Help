import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Application } from '../../src/models/Application.js';
import { Todo } from '../../src/models/Todo.js';
import { Notification } from '../../src/models/Notification.js';
import {
  executeApplicationFollowUps,
  buildTodoTag,
  buildNotificationKey,
  FOLLOW_UP_COOLDOWN_MS,
  STALLED_DAYS_THRESHOLD,
} from '../../src/services/intelligence/application-followup.service.js';
import { calculateApplicationIntelligence } from '../../src/services/intelligence/application-intelligence.service.js';

describe('Application Follow-Up Execution Service (Phase 11G — Batch 5B)', () => {
  let userA;
  let userB;
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

    const authA = await createTestUser('followup_student_a', 'student');
    userA = authA.user;

    const authB = await createTestUser('followup_student_b', 'student');
    userB = authB.user;

    opp1 = await Opportunity.create({
      title: 'Backend Engineer Intern',
      organization: 'TechFlow Systems',
      description: 'Exciting backend engineering internship working on cloud systems.',
      status: 'published',
      type: 'internship',
    });

    opp2 = await Opportunity.create({
      title: 'Frontend Developer',
      organization: 'PixelCraft Labs',
      description: 'Building modern interfaces with React and TypeScript.',
      status: 'published',
      type: 'internship',
    });
  });

  // -------------------------------------------------------------------------
  // A. Eligible Stalled Application
  // -------------------------------------------------------------------------
  it('A. Eligible stalled application - generates Todo and Notification', async () => {
    const appliedAt = new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago (> 14 days)
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt,
    });

    const result = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(result.success).toBe(true);
    expect(result.created.length).toBe(1);
    expect(result.created[0].applicationId).toBe(String(app._id));
    expect(result.created[0].title).toBe('Follow up on application with TechFlow Systems');
    expect(result.created[0].priority).toBe('Medium'); // 20 days is < 21 days

    // Verify Todo was persisted
    const todo = await Todo.findById(result.created[0].todoId);
    expect(todo).toBeDefined();
    expect(todo.userId.toString()).toBe(userA._id.toString());
    expect(todo.category).toBe('Application');
    expect(todo.title).toBe('Follow up on application with TechFlow Systems');
    expect(todo.description).toContain(`[CareerOS App: ${app._id}:followup]`);
    expect(todo.description).toContain('has been active for 20 days without a recent update');
    expect(todo.completed).toBe(false);

    // Verify Notification was persisted
    const notif = await Notification.findById(result.created[0].notificationId);
    expect(notif).toBeDefined();
    expect(notif.userId.toString()).toBe(userA._id.toString());
    expect(notif.type).toBe('application_update');
    expect(notif.title).toBe('Application follow-up recommended');
    expect(notif.message).toContain('TechFlow Systems');
    expect(notif.notificationKey).toBe(buildNotificationKey(app._id, FIXED_REF_DATE));
  });

  // -------------------------------------------------------------------------
  // B. Non-Stalled Active Application
  // -------------------------------------------------------------------------
  it('B. Non-stalled active application - skipped without creating actions', async () => {
    const appliedAt = new Date(FIXED_REF_DATE.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago (< 14 days)
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt,
    });

    const result = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(result.success).toBe(true);
    expect(result.created.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].reason).toBe('not_stalled');
    expect(result.skipped[0].ageDays).toBe(5);

    const todoCount = await Todo.countDocuments({ userId: userA._id });
    expect(todoCount).toBe(0);
    const notifCount = await Notification.countDocuments({ userId: userA._id });
    expect(notifCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // C. Rejected Application
  // -------------------------------------------------------------------------
  it('C. Rejected application - skipped as terminal inactive status', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'rejected',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 30 * 24 * 60 * 60 * 1000),
    });

    const result = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(result.created.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].reason).toBe('inactive_status');
    expect(result.skipped[0].status).toBe('rejected');
  });

  // -------------------------------------------------------------------------
  // D. Selected Application
  // -------------------------------------------------------------------------
  it('D. Selected application - skipped as terminal inactive status', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'selected',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 30 * 24 * 60 * 60 * 1000),
    });

    const result = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(result.created.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].reason).toBe('inactive_status');
  });

  // -------------------------------------------------------------------------
  // E. Withdrawn Application
  // -------------------------------------------------------------------------
  it('E. Withdrawn application - skipped as terminal inactive status', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'withdrawn',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 30 * 24 * 60 * 60 * 1000),
    });

    const result = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(result.created.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].reason).toBe('inactive_status');
  });

  // -------------------------------------------------------------------------
  // F. Ownership Verification
  // -------------------------------------------------------------------------
  it('F. Ownership - User A cannot execute User B application', async () => {
    const appB = await Application.create({
      userId: userB._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    await expect(
      executeApplicationFollowUps(userA._id, {
        applicationId: appB._id,
        referenceDate: FIXED_REF_DATE,
      })
    ).rejects.toThrow('Application does not belong to user');

    const todoCountB = await Todo.countDocuments({ userId: userB._id });
    expect(todoCountB).toBe(0);
    const todoCountA = await Todo.countDocuments({ userId: userA._id });
    expect(todoCountA).toBe(0);
  });

  // -------------------------------------------------------------------------
  // G. Cooldown
  // -------------------------------------------------------------------------
  it('G. Cooldown - second execution within 7 days creates nothing', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    // Run 1: First execution creates Todo & Notification
    const res1 = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });
    expect(res1.created.length).toBe(1);

    // Run 2: Executed 3 days later (within 7-day cooldown)
    const threeDaysLater = new Date(FIXED_REF_DATE.getTime() + 3 * 24 * 60 * 60 * 1000);
    const res2 = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: threeDaysLater,
    });

    expect(res2.created.length).toBe(0);
    expect(res2.skipped.length).toBe(1);
    expect(res2.skipped[0].reason).toBe('cooldown_active');
    expect(res2.retained.length).toBe(1);
    expect(res2.retained[0].todoId).toBe(res1.created[0].todoId);

    // Assert counts in database unchanged
    const totalTodos = await Todo.countDocuments({ userId: userA._id });
    expect(totalTodos).toBe(1);
    const totalNotifs = await Notification.countDocuments({ userId: userA._id });
    expect(totalNotifs).toBe(1);
  });

  // -------------------------------------------------------------------------
  // H. Idempotency
  // -------------------------------------------------------------------------
  it('H. Idempotency - repeated execution after existing Todo creates zero duplicate', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    // Run 3 times consecutively
    await executeApplicationFollowUps(userA._id, { applicationId: app._id, referenceDate: FIXED_REF_DATE });
    await executeApplicationFollowUps(userA._id, { applicationId: app._id, referenceDate: FIXED_REF_DATE });
    await executeApplicationFollowUps(userA._id, { applicationId: app._id, referenceDate: FIXED_REF_DATE });

    const todos = await Todo.find({ userId: userA._id });
    expect(todos.length).toBe(1);

    const notifs = await Notification.find({ userId: userA._id });
    expect(notifs.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // I. Completed Todo Preservation
  // -------------------------------------------------------------------------
  it('I. Completed Todo - preserves completion state without reopening or duplicating', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    // Create initial Todo
    const res1 = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });
    const todoId = res1.created[0].todoId;

    // Student marks it completed
    const completedAt = new Date(FIXED_REF_DATE.getTime() + 1 * 24 * 60 * 60 * 1000);
    await Todo.findByIdAndUpdate(todoId, {
      completed: true,
      completedAt,
    });

    // Run again 2 days later
    const twoDaysLater = new Date(FIXED_REF_DATE.getTime() + 2 * 24 * 60 * 60 * 1000);
    const res2 = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: twoDaysLater,
    });

    expect(res2.created.length).toBe(0);

    // Verify existing Todo is still marked completed
    const freshTodo = await Todo.findById(todoId);
    expect(freshTodo.completed).toBe(true);
    expect(freshTodo.completedAt.toISOString()).toBe(completedAt.toISOString());
  });

  // -------------------------------------------------------------------------
  // J. User-Edited Todo Preservation
  // -------------------------------------------------------------------------
  it('J. User-edited Todo - does not overwrite custom user edits', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    const res1 = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });
    const todoId = res1.created[0].todoId;

    // User customized the task
    const customTitle = 'Custom followup: Email engineering lead on LinkedIn';
    const customDesc = `[CareerOS App: ${app._id}:followup] User notes: reached out to team lead.`;
    await Todo.findByIdAndUpdate(todoId, {
      title: customTitle,
      description: customDesc,
      priority: 'Low',
    });

    // Run follow-up execution again
    await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: new Date(FIXED_REF_DATE.getTime() + 2 * 24 * 60 * 60 * 1000),
    });

    const freshTodo = await Todo.findById(todoId);
    expect(freshTodo.title).toBe(customTitle);
    expect(freshTodo.description).toBe(customDesc);
    expect(freshTodo.priority).toBe('Low');
  });

  // -------------------------------------------------------------------------
  // K. Status Race Safety
  // -------------------------------------------------------------------------
  it('K. Race condition - application becomes non-stalled before execution is skipped', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000),
    });

    // In the meantime, application status advances to 'interview'
    await Application.findByIdAndUpdate(app._id, {
      status: 'interview',
    });

    const res = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(res.created.length).toBe(0);
    expect(res.skipped.length).toBe(1);
    expect(res.skipped[0].reason).toBe('inactive_status');
    expect(res.skipped[0].status).toBe('interview');

    const totalTodos = await Todo.countDocuments({ userId: userA._id });
    expect(totalTodos).toBe(0);
  });

  // -------------------------------------------------------------------------
  // L. Notification Deduplication
  // -------------------------------------------------------------------------
  it('L. Notification deduplication - deterministic notificationKey', async () => {
    const key1 = buildNotificationKey('app-123', new Date('2026-10-01T10:00:00Z'));
    const key2 = buildNotificationKey('app-123', new Date('2026-10-05T10:00:00Z'));
    // Within same 7-day period window -> keys match
    expect(key1).toBe(key2);

    // Far in the future -> different period window
    const key3 = buildNotificationKey('app-123', new Date('2026-10-20T10:00:00Z'));
    expect(key1).not.toBe(key3);
  });

  // -------------------------------------------------------------------------
  // M. Invalid Application Handled Cleanly
  // -------------------------------------------------------------------------
  it('M. Invalid application - safe response on non-existent or invalid ID', async () => {
    await expect(
      executeApplicationFollowUps(userA._id, {
        applicationId: 'not-an-id',
        referenceDate: FIXED_REF_DATE,
      })
    ).rejects.toThrow('Invalid application ID');

    const fakeId = new mongoose.Types.ObjectId();
    await expect(
      executeApplicationFollowUps(userA._id, {
        applicationId: fakeId,
        referenceDate: FIXED_REF_DATE,
      })
    ).rejects.toThrow('Application not found');
  });

  // -------------------------------------------------------------------------
  // N. No Arbitrary Client Action Trust
  // -------------------------------------------------------------------------
  it('N. No arbitrary client action - server recomputes eligibility against DB', async () => {
    // Application is recent (3 days old)
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 3 * 24 * 60 * 60 * 1000),
    });

    // Client requests execution claiming it is stalled
    const res = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(res.created.length).toBe(0);
    expect(res.skipped[0].reason).toBe('not_stalled');
  });

  // -------------------------------------------------------------------------
  // O. Read-Only Intelligence Calculation Remains Read-Only
  // -------------------------------------------------------------------------
  it('O. Read-only intelligence calculation - analytics itself performs zero writes', async () => {
    await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    // Run calculateApplicationIntelligence (from Phase 11G Batch 2)
    const intel = await calculateApplicationIntelligence(userA._id, { referenceDate: FIXED_REF_DATE });
    expect(intel.actions.length).toBeGreaterThanOrEqual(1);

    // Verify ZERO Todos and ZERO Notifications were created by intelligence read
    const todoCount = await Todo.countDocuments({ userId: userA._id });
    expect(todoCount).toBe(0);
    const notifCount = await Notification.countDocuments({ userId: userA._id });
    expect(notifCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // P. Security - No Secrets or Credential Leaks in Execution Summary
  // -------------------------------------------------------------------------
  it('P. Security - execution summary contains zero credentials or private notes', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      notes: 'Private recruiter email: recruiter@secret.com; internal interview link: https://secret.zoom.us',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
    });

    const res = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain('recruiter@secret.com');
    expect(serialized).not.toContain('secret.zoom.us');
    expect(serialized).not.toContain('password');
  });

  // -------------------------------------------------------------------------
  // Q. Urgent Priority on Long-Stalled Applications (>= 21 days)
  // -------------------------------------------------------------------------
  it('Q. Urgent priority - sets High priority for applications stalled >= 21 days', async () => {
    const app = await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days >= 21
    });

    const res = await executeApplicationFollowUps(userA._id, {
      applicationId: app._id,
      referenceDate: FIXED_REF_DATE,
    });

    expect(res.created.length).toBe(1);
    expect(res.created[0].priority).toBe('High');

    const todo = await Todo.findById(res.created[0].todoId);
    expect(todo.priority).toBe('High');
  });

  // -------------------------------------------------------------------------
  // R. Batch Execution across Multiple Applications
  // -------------------------------------------------------------------------
  it('R. Batch execution - executes all eligible stalled applications for user', async () => {
    // App 1: Stalled 20 days (Eligible)
    await Application.create({
      userId: userA._id,
      opportunityId: opp1._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000),
    });

    // App 2: Stalled 30 days (Eligible)
    await Application.create({
      userId: userA._id,
      opportunityId: opp2._id,
      type: 'application',
      status: 'waiting',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 30 * 24 * 60 * 60 * 1000),
    });

    const opp3 = await Opportunity.create({
      title: 'DevOps Intern',
      organization: 'CloudBase',
      description: 'Infrastructure automation with Docker and Kubernetes.',
      status: 'published',
      type: 'internship',
    });

    // App 3: Recent (5 days, Not Eligible)
    await Application.create({
      userId: userA._id,
      opportunityId: opp3._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(FIXED_REF_DATE.getTime() - 5 * 24 * 60 * 60 * 1000),
    });

    // Run batch execution (no applicationId provided)
    const res = await executeApplicationFollowUps(userA._id, {
      referenceDate: FIXED_REF_DATE,
    });

    expect(res.success).toBe(true);
    expect(res.created.length).toBe(2);
    expect(res.skipped.length).toBe(1);
    expect(res.skipped[0].reason).toBe('not_stalled');

    const todos = await Todo.find({ userId: userA._id });
    expect(todos.length).toBe(2);
    const notifs = await Notification.find({ userId: userA._id });
    expect(notifs.length).toBe(2);
  });
});
