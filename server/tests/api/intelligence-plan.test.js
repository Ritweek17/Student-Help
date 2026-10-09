import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Profile } from '../../src/models/Profile.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Todo } from '../../src/models/Todo.js';
import { CalendarEvent } from '../../src/models/CalendarEvent.js';
import { Notification } from '../../src/models/Notification.js';
import { LearningTrack } from '../../src/models/LearningTrack.js';
import { User } from '../../src/models/User.js';

describe('CareerOS Intelligence Preparation Plan API — /api/intelligence/opportunities/:id/plan', () => {
  let studentUser;
  let studentToken;
  let otherStudentUser;
  let otherStudentToken;
  let adminUser;
  let adminToken;
  let testOpportunity;
  let draftOpportunity;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      User.init(),
      Profile.init(),
      Opportunity.init(),
      Todo.init(),
      CalendarEvent.init(),
      Notification.init(),
      LearningTrack.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const studentAuth = await createTestUser('plan_student', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;

    const otherAuth = await createTestUser('plan_other', 'student');
    otherStudentUser = otherAuth.user;
    otherStudentToken = otherAuth.token;

    const adminAuth = await createTestUser('plan_admin', 'admin');
    adminUser = adminAuth.user;
    adminToken = adminAuth.token;

    // Create published opportunity with deadline
    const futureDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    testOpportunity = await Opportunity.create({
      title: 'Full Stack Engineer Intern',
      organization: 'InnovateHub',
      type: 'internship',
      workMode: 'remote',
      status: 'published',
      deadline: futureDeadline,
      description: 'Building web applications with React, TypeScript, and Docker.',
      skills: ['react', 'typescript', 'docker'],
    });

    draftOpportunity = await Opportunity.create({
      title: 'Confidential Stealth Project',
      organization: 'StealthX',
      type: 'internship',
      workMode: 'remote',
      status: 'draft',
      description: 'Confidential stealth role description.',
      skills: ['python'],
    });

    // Create Learning Track for TypeScript
    await LearningTrack.create({
      title: 'TypeScript Masterclass',
      category: 'Web Development',
      description: 'Complete TypeScript tutorial',
      isActive: true,
    });

    // Student has React on profile and project, but missing TypeScript & Docker
    await Profile.create({
      userId: studentUser._id,
      personal: { firstName: 'Sam', lastName: 'Dev' },
      skills: [{ name: 'React', level: 'advanced' }],
      projects: [
        {
          title: 'React Portfolio',
          description: 'A React project',
          technologies: ['ReactJS'],
        },
      ],
      careerPreferences: {
        opportunityTypes: ['internship'],
        preferredWorkModes: ['remote'],
      },
    });
  });

  describe('1. GET /api/intelligence/opportunities/:id/plan (Plan Preview)', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app)
        .get(`/api/intelligence/opportunities/${testOpportunity._id}/plan`);

      expect(res.status).toBe(401);
    });

    it('rejects malformed opportunity ID with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/intelligence/opportunities/invalid-id/plan')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns HTTP 404 for nonexistent opportunity ID', async () => {
      const randomId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/intelligence/opportunities/${randomId}/plan`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
    });

    it('returns HTTP 404 for draft opportunity accessed by student', async () => {
      const res = await request(app)
        .get(`/api/intelligence/opportunities/${draftOpportunity._id}/plan`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
    });

    it('allows admin to view plan preview for draft opportunity', async () => {
      const res = await request(app)
        .get(`/api/intelligence/opportunities/${draftOpportunity._id}/plan`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBeDefined();
    });

    it('returns structured preparation plan preview for authenticated student', async () => {
      const res = await request(app)
        .get(`/api/intelligence/opportunities/${testOpportunity._id}/plan`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const plan = res.body.plan;
      expect(plan.opportunityTitle).toBe('Full Stack Engineer Intern');
      expect(plan.urgency).toBeDefined();
      expect(plan.urgency.urgency).toBe('moderate'); // 10 days left
      expect(plan.tasks.length).toBeGreaterThanOrEqual(4);

      // Check tasks
      const taskKeys = plan.tasks.map((t) => t.taskKey);
      expect(taskKeys).toContain('gap:typescript');
      expect(taskKeys).toContain('gap:docker');
      expect(taskKeys).toContain('project:review');
      expect(taskKeys).toContain('application:prepare');
      expect(taskKeys).toContain('milestone:deadline');

      // Check learning link for TypeScript
      const tsTask = plan.tasks.find((t) => t.taskKey === 'gap:typescript');
      expect(tsTask.learningLink).not.toBeNull();
      expect(tsTask.learningLink.trackTitle).toBe('TypeScript Masterclass');
    });
  });

  describe('2. POST /api/intelligence/opportunities/:id/plan/generate (Action Creation & Idempotency)', () => {
    it('creates real Todos in database on first execution', async () => {
      const res = await request(app)
        .post(`/api/intelligence/opportunities/${testOpportunity._id}/plan/generate`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ createCalendarEvent: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.createdCount).toBeGreaterThan(0);
      expect(res.body.existingCount).toBe(0);

      // Verify Todos exist in MongoDB for studentUser
      const userTodos = await Todo.find({ userId: studentUser._id });
      expect(userTodos.length).toBe(res.body.createdCount);
      expect(userTodos.some((t) => t.title.includes('TypeScript'))).toBe(true);

      // Verify CalendarEvent created for deadline
      const calendarEvent = await CalendarEvent.findOne({
        userId: studentUser._id,
        opportunityId: testOpportunity._id,
      });
      expect(calendarEvent).not.toBeNull();
      expect(calendarEvent.type).toBe('deadline');

      // Verify Notification created
      const notification = await Notification.findOne({
        userId: studentUser._id,
        opportunityId: testOpportunity._id,
      });
      expect(notification).not.toBeNull();
      expect(notification.title).toBe('Preparation Plan Created');
    });

    it('is strictly IDEMPOTENT: repeated executions create ZERO duplicate Todos', async () => {
      // First execution
      const res1 = await request(app)
        .post(`/api/intelligence/opportunities/${testOpportunity._id}/plan/generate`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ createCalendarEvent: true });

      const initialCreatedCount = res1.body.createdCount;
      expect(initialCreatedCount).toBeGreaterThan(0);

      // Second execution
      const res2 = await request(app)
        .post(`/api/intelligence/opportunities/${testOpportunity._id}/plan/generate`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ createCalendarEvent: true });

      expect(res2.status).toBe(201);
      expect(res2.body.createdCount).toBe(0); // 0 new todos!
      expect(res2.body.existingCount).toBe(initialCreatedCount); // All retained!

      // Third execution
      const res3 = await request(app)
        .post(`/api/intelligence/opportunities/${testOpportunity._id}/plan/generate`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ createCalendarEvent: true });

      expect(res3.body.createdCount).toBe(0);
      expect(res3.body.existingCount).toBe(initialCreatedCount);

      // Total todos in database still equals initial count
      const totalTodos = await Todo.countDocuments({ userId: studentUser._id });
      expect(totalTodos).toBe(initialCreatedCount);

      // CalendarEvents in database still exactly 1
      const totalCalendarEvents = await CalendarEvent.countDocuments({
        userId: studentUser._id,
        opportunityId: testOpportunity._id,
      });
      expect(totalCalendarEvents).toBe(1);
    });

    it('maintains strict user isolation: User A actions are never assigned to User B', async () => {
      await request(app)
        .post(`/api/intelligence/opportunities/${testOpportunity._id}/plan/generate`)
        .set('Authorization', `Bearer ${studentToken}`);

      const userATodos = await Todo.countDocuments({ userId: studentUser._id });
      const userBTodos = await Todo.countDocuments({ userId: otherStudentUser._id });

      expect(userATodos).toBeGreaterThan(0);
      expect(userBTodos).toBe(0); // User B has zero todos!
    });

    it('creates GitHub showcase actions in Todo database when profile has GitHub proof', async () => {
      // Add GitHub evidence for studentUser
      await Profile.updateOne(
        { userId: studentUser._id },
        {
          githubEvidence: {
            username: 'sam-student',
            syncStatus: 'synced',
            syncedAt: new Date(),
            publicRepoCount: 3,
            detectedSkills: [
              {
                canonicalKey: 'react',
                displayName: 'React',
                category: 'frontend',
                repoCount: 1,
                repositories: [
                  {
                    name: 'react-social-app',
                    url: 'https://github.com/sam-student/react-social-app',
                    isFork: false,
                    primaryLanguage: 'JavaScript',
                    updatedAt: new Date(),
                  },
                ],
              },
            ],
          },
        }
      );

      // GET preview
      const previewRes = await request(app)
        .get(`/api/intelligence/opportunities/${testOpportunity._id}/plan`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(previewRes.status).toBe(200);
      const showcaseTask = previewRes.body.plan.tasks.find((t) => t.type === 'github_showcase');
      expect(showcaseTask).toBeDefined();
      expect(showcaseTask.taskKey).toBe('github:showcase:react:react-social-app');

      // POST generate todos
      const genRes = await request(app)
        .post(`/api/intelligence/opportunities/${testOpportunity._id}/plan/generate`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(genRes.status).toBe(201);
      const ghTodo = await Todo.findOne({
        userId: studentUser._id,
        description: { $regex: 'github:showcase:react:react-social-app' },
      });
      expect(ghTodo).not.toBeNull();
      expect(ghTodo.title).toContain('react-social-app');
    });
  });
});
