import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Profile } from '../../src/models/Profile.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { SavedOpportunity } from '../../src/models/SavedOpportunity.js';
import { Application } from '../../src/models/Application.js';
import { Todo } from '../../src/models/Todo.js';
import { User } from '../../src/models/User.js';
import * as careerReadinessService from '../../src/services/intelligence/career-readiness.service.js';

describe('CareerOS Career Readiness API Suite — GET /api/intelligence/readiness', () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  let reactOpp;
  let pythonOpp;
  let fallbackOpp;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      User.init(),
      Profile.init(),
      Opportunity.init(),
      SavedOpportunity.init(),
      Application.init(),
      Todo.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    vi.restoreAllMocks();

    const authA = await createTestUser('readiness_student_a', 'student');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('readiness_student_b', 'student');
    userB = authB.user;
    tokenB = authB.token;

    // Opportunity 1: Frontend Developer (React, TypeScript)
    reactOpp = await Opportunity.create({
      title: 'Frontend Engineer Intern',
      organization: 'Acme UI Labs',
      type: 'internship',
      workMode: 'remote',
      status: 'published',
      description: 'Build web applications using React and TypeScript.',
      skills: ['react', 'typescript'],
    });

    // Opportunity 2: Backend Developer (Python, Django)
    pythonOpp = await Opportunity.create({
      title: 'Python Backend Intern',
      organization: 'DataCorp',
      type: 'internship',
      workMode: 'hybrid',
      status: 'published',
      description: 'Develop APIs using Python and Django.',
      skills: ['python', 'django'],
    });

    // Opportunity 3: Fallback Opportunity (Fullstack)
    fallbackOpp = await Opportunity.create({
      title: 'General Software Intern',
      organization: 'Global Systems',
      type: 'internship',
      workMode: 'remote',
      status: 'published',
      description: 'Software internship for computer science students.',
      skills: ['git', 'javascript'],
    });
  });

  // -------------------------------------------------------------
  // 1. Authentication
  // -------------------------------------------------------------
  describe('1. Authentication Enforcement', () => {
    it('returns 401 when request has no Authorization header', async () => {
      const res = await request(app).get('/api/intelligence/readiness');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('returns 401 when Authorization header contains an invalid token', async () => {
      const res = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', 'Bearer invalid-token-12345');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('returns 200 when request is authenticated with a valid token', async () => {
      const res = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.readiness).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 2. Ownership & User Isolation
  // -------------------------------------------------------------
  describe('2. Ownership & User Isolation', () => {
    it('returns data belonging strictly to authenticated User A and not User B', async () => {
      // User A saves reactOpp
      await SavedOpportunity.create({
        userId: userA._id,
        opportunityId: reactOpp._id,
      });

      // User B saves pythonOpp
      await SavedOpportunity.create({
        userId: userB._id,
        opportunityId: pythonOpp._id,
      });

      // User A requests readiness
      const resA = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.readiness.sourceOpportunities).toHaveLength(1);
      expect(resA.body.readiness.sourceOpportunities[0].id).toBe(String(reactOpp._id));
      expect(resA.body.readiness.sourceOpportunities[0].title).toBe('Frontend Engineer Intern');

      // User B requests readiness
      const resB = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(200);
      expect(resB.body.readiness.sourceOpportunities).toHaveLength(1);
      expect(resB.body.readiness.sourceOpportunities[0].id).toBe(String(pythonOpp._id));
      expect(resB.body.readiness.sourceOpportunities[0].title).toBe('Python Backend Intern');
    });

    it('completely ignores client attempts to supply a different userId via query parameters', async () => {
      await SavedOpportunity.create({
        userId: userA._id,
        opportunityId: reactOpp._id,
      });

      await SavedOpportunity.create({
        userId: userB._id,
        opportunityId: pythonOpp._id,
      });

      // User B attempts to query User A's readiness via ?userId=
      const res = await request(app)
        .get(`/api/intelligence/readiness?userId=${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.readiness.sourceOpportunities).toHaveLength(1);
      expect(res.body.readiness.sourceOpportunities[0].id).toBe(String(pythonOpp._id));
      expect(res.body.readiness.sourceOpportunities[0].id).not.toBe(String(reactOpp._id));
    });
  });

  // -------------------------------------------------------------
  // 3. Cold Start Behavior
  // -------------------------------------------------------------
  describe('3. Cold-Start Handling', () => {
    it('returns clean Early Stage state when student has no targets and no career preferences', async () => {
      // Create empty profile
      await Profile.create({
        userId: userA._id,
        personal: { firstName: 'Alice', lastName: 'Newbie' },
        skills: [],
      });

      // Remove fallback published opportunities to test absolute zero state
      await Opportunity.deleteMany({});

      const res = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.readiness.readinessBand.band).toBe('Early Stage');
      expect(res.body.readiness.targetProfile.totalOpportunities).toBe(0);
      expect(res.body.readiness.targetProfile.guidance).toBe(
        'Save 3 target opportunities to personalize your career readiness.'
      );
      expect(res.body.readiness.dimensions.skillCoverage.percentage).toBe(0);
      expect(res.body.readiness.dimensions.evidenceStrength.verifiedCount).toBe(0);
      expect(res.body.readiness.dimensions.preparationExecution.percentage).toBe(0);
      expect(res.body.readiness.actions.length).toBeGreaterThan(0);
      expect(res.body.readiness.actions[0].actionKey).toBe('action:save_target_opportunities');
    });

    it('uses published opportunities fallback when user has career preferences but no saved/applied opps', async () => {
      await Profile.create({
        userId: userA._id,
        personal: { firstName: 'Alice', lastName: 'Explorer' },
        careerPreferences: {
          opportunityTypes: ['internship'],
        },
      });

      const res = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.readiness.targetProfile.totalOpportunities).toBeGreaterThan(0);
      expect(res.body.readiness.targetProfile.cohortSources.fallbackCount).toBeGreaterThan(0);
      expect(res.body.readiness.targetProfile.guidance).toBe(
        'Save 3 target opportunities to personalize your career readiness.'
      );
    });
  });

  // -------------------------------------------------------------
  // 4. Response Contract & Structure
  // -------------------------------------------------------------
  describe('4. Response Contract Verification', () => {
    it('returns all required dimensions and properties in stable format', async () => {
      // Setup comprehensive profile
      await Profile.create({
        userId: userA._id,
        personal: { firstName: 'Alice', lastName: 'Engineer' },
        skills: [
          { name: 'React', level: 'advanced' },
          { name: 'TypeScript', level: 'intermediate' },
        ],
        projects: [
          {
            title: 'React Dashboard',
            description: 'Interactive dashboard',
            technologies: ['React', 'TypeScript'],
          },
        ],
        careerGoal: {
          title: 'Frontend Engineer',
        },
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'react',
              displayName: 'React',
              category: 'frontend',
              repoCount: 1,
              repositories: [
                {
                  name: 'react-app',
                  url: 'https://github.com/alice/react-app',
                  primaryLanguage: 'JavaScript',
                  isFork: false,
                  updatedAt: new Date(),
                },
              ],
            },
          ],
        },
      });

      // User A saves reactOpp
      await SavedOpportunity.create({
        userId: userA._id,
        opportunityId: reactOpp._id,
      });

      // User A applies to pythonOpp
      await Application.create({
        userId: userA._id,
        opportunityId: pythonOpp._id,
        type: 'application',
        status: 'applied',
        appliedAt: new Date(),
      });

      // User A has preparation Todo
      await Todo.create({
        userId: userA._id,
        title: 'Build a React demo',
        description: `[CareerOS Prep: ${reactOpp._id}: Skills] Build a React demo`,
        type: 'action',
        completed: true,
        completedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const readiness = res.body.readiness;

      // 1. Band
      expect(['Target Ready', 'Advancing', 'Developing', 'Early Stage']).toContain(
        readiness.readinessBand.band
      );

      // 2. Target Profile
      expect(readiness.targetProfile).toBeDefined();
      expect(readiness.targetProfile.totalOpportunities).toBe(2);
      expect(readiness.targetProfile.targetRoles).toEqual(['Frontend Engineer']);
      expect(readiness.targetProfile.cohortSources).toBeDefined();
      expect(readiness.targetProfile.cohortSources.savedCount).toBe(1);
      expect(readiness.targetProfile.cohortSources.appliedCount).toBe(1);

      // 3. Dimensions
      expect(readiness.dimensions).toBeDefined();
      expect(readiness.dimensions.skillCoverage).toBeDefined();
      expect(readiness.dimensions.skillCoverage.percentage).toBeTypeOf('number');
      expect(readiness.dimensions.evidenceStrength).toBeDefined();
      expect(readiness.dimensions.evidenceStrength.verificationRate).toBeTypeOf('number');
      expect(readiness.dimensions.preparationExecution).toBeDefined();
      expect(readiness.dimensions.preparationExecution.completed).toBe(1);
      expect(readiness.dimensions.learningVelocity).toBeDefined();
      expect(readiness.dimensions.applicationPipeline).toBeDefined();
      expect(readiness.dimensions.applicationPipeline.activeApplications).toBe(1);

      // 4. Skill Gaps & Evidence
      expect(Array.isArray(readiness.skillGaps)).toBe(true);
      expect(Array.isArray(readiness.evidence)).toBe(true);
      const reactEvidence = readiness.evidence.find((e) => e.canonicalKey === 'react');
      expect(reactEvidence).toBeDefined();
      expect(reactEvidence.evidenceStrength).toBe('verified');
      expect(reactEvidence.sources.githubVerified).toBe(true);

      // 5. Actions
      expect(Array.isArray(readiness.actions)).toBe(true);
      readiness.actions.forEach((act) => {
        expect(act.actionKey).toBeDefined();
        expect(act.type).toBeDefined();
        expect(act.priority).toBeDefined();
        expect(act.title).toBeDefined();
        expect(act.description).toBeDefined();
      });

      // 6. Source Opportunities
      expect(Array.isArray(readiness.sourceOpportunities)).toBe(true);
      expect(readiness.sourceOpportunities).toHaveLength(2);
      readiness.sourceOpportunities.forEach((opp) => {
        expect(opp.id).toBeDefined();
        expect(opp.title).toBeDefined();
        expect(opp.organization).toBeDefined();
        expect(opp.type).toBeDefined();
      });

      // 7. GeneratedAt
      expect(readiness.generatedAt).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 5. Security & Sanitization
  // -------------------------------------------------------------
  describe('5. Security & Secret Leak Prevention', () => {
    it('does not leak internal database properties, passwords, or tokens', async () => {
      await Profile.create({
        userId: userA._id,
        personal: { firstName: 'Alice', lastName: 'Engineer' },
      });

      const res = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const jsonString = JSON.stringify(res.body);

      expect(jsonString).not.toContain('password');
      expect(jsonString).not.toContain('githubToken');
      expect(jsonString).not.toContain('jwtSecret');
      expect(jsonString).not.toContain('__v');
      expect(jsonString).not.toContain('sourceCode');
    });
  });

  // -------------------------------------------------------------
  // 6. Error Handling
  // -------------------------------------------------------------
  describe('6. Error Handling & Resilience', () => {
    it('returns sanitized 500 when readiness computation throws an unexpected error', async () => {
      vi.spyOn(careerReadinessService, 'calculateCareerReadiness').mockRejectedValueOnce(
        new Error('Simulated database breakdown')
      );

      const res = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
      // Must not leak raw database credentials or URI
      expect(res.body.message).not.toContain('mongodb://');
    });
  });

  // -------------------------------------------------------------
  // 7. Deterministic Reference Date (Test Parameter)
  // -------------------------------------------------------------
  describe('7. Deterministic Reference Date Option', () => {
    it('accepts referenceDate query param in test mode and reflects it in generatedAt', async () => {
      const targetDate = '2026-06-01T12:00:00.000Z';
      const res = await request(app)
        .get(`/api/intelligence/readiness?referenceDate=${encodeURIComponent(targetDate)}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(new Date(res.body.readiness.generatedAt).toISOString()).toBe(targetDate);
    });
  });
});
