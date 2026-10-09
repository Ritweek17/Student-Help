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
import { CalendarEvent } from '../../src/models/CalendarEvent.js';
import { User } from '../../src/models/User.js';
import * as appIntelligenceService from '../../src/services/intelligence/application-intelligence.service.js';

describe('CareerOS Application Intelligence API Suite (Phase 11G — Batch 3)', () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  let opp1;
  let opp2;
  let opp3;
  let opp4;

  const FIXED_REF_DATE = new Date('2026-10-07T12:00:00.000Z');

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      User.init(),
      Profile.init(),
      Opportunity.init(),
      SavedOpportunity.init(),
      Application.init(),
      Todo.init(),
      CalendarEvent.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    vi.restoreAllMocks();

    const authA = await createTestUser('app_intel_student_a', 'student');
    userA = authA.user;
    tokenA = authA.token;

    const authB = await createTestUser('app_intel_student_b', 'student');
    userB = authB.user;
    tokenB = authB.token;

    // Seed test opportunities
    opp1 = await Opportunity.create({
      title: 'Frontend Engineer Intern',
      organization: 'Acme Corp',
      type: 'internship',
      workMode: 'remote',
      status: 'published',
      description: 'Build web applications using TypeScript and React.',
      skills: ['typescript', 'react'],
    });

    opp2 = await Opportunity.create({
      title: 'Backend Developer Intern',
      organization: 'Beta Services',
      type: 'internship',
      workMode: 'remote',
      status: 'published',
      description: 'Develop APIs using TypeScript and Docker.',
      skills: ['typescript', 'docker'],
    });

    opp3 = await Opportunity.create({
      title: 'Full Stack Fellow',
      organization: 'Gamma Tech',
      type: 'fellowship',
      workMode: 'hybrid',
      status: 'published',
      description: 'Full stack development with TypeScript and Node.',
      skills: ['typescript', 'node.js'],
    });

    opp4 = await Opportunity.create({
      title: 'Systems Engineer Intern',
      organization: 'Delta Systems',
      type: 'internship',
      workMode: 'onsite',
      status: 'published',
      description: 'Systems programming with Go and Docker.',
      skills: ['go', 'docker'],
    });
  });

  // =========================================================================
  // 1. AUTHENTICATION ENFORCEMENT
  // =========================================================================
  describe('1. Authentication Enforcement', () => {
    it('returns 401 when GET /api/intelligence/applications/overview has no token', async () => {
      const res = await request(app).get('/api/intelligence/applications/overview');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('returns 401 when GET /api/intelligence/applications/outcomes has no token', async () => {
      const res = await request(app).get('/api/intelligence/applications/outcomes');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('returns 401 when Authorization header has an invalid token', async () => {
      const res = await request(app)
        .get('/api/intelligence/applications/overview')
        .set('Authorization', 'Bearer invalid-token-xyz');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 for authenticated student on overview endpoint', async () => {
      const res = await request(app)
        .get('/api/intelligence/applications/overview')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.overview).toBeDefined();
    });

    it('returns 200 for authenticated student on outcomes endpoint', async () => {
      const res = await request(app)
        .get('/api/intelligence/applications/outcomes')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.outcomes).toBeDefined();
    });
  });

  // =========================================================================
  // 2. OVERVIEW ENDPOINT PAYLOAD & OPERATIONAL CONTRACT
  // =========================================================================
  describe('2. GET /api/intelligence/applications/overview Payload Contract', () => {
    it('returns expected overview operational intelligence schema and data', async () => {
      const appliedDate = new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago -> stalled (>14)

      // User A application to opp1 (applied > 14 days)
      await Application.create({
        userId: userA._id,
        opportunityId: opp1._id,
        type: 'application',
        status: 'applied',
        appliedAt: appliedDate,
        notes: 'TOP_SECRET_STUDENT_APPLICATION_NOTE',
      });

      // User A application to opp2 (interview without calendar event)
      await Application.create({
        userId: userA._id,
        opportunityId: opp2._id,
        type: 'application',
        status: 'interview',
        appliedAt: new Date(FIXED_REF_DATE.getTime() - 5 * 24 * 60 * 60 * 1000),
      });

      // User A Todo for opp1
      await Todo.create({
        userId: userA._id,
        title: 'Complete prep task',
        description: `Review requirements [CareerOS Prep: ${opp1._id}:task1]`,
        completed: false,
      });

      const res = await request(app)
        .get(`/api/intelligence/applications/overview?referenceDate=${FIXED_REF_DATE.toISOString()}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const overview = res.body.overview;
      expect(overview).toBeDefined();

      // Health
      expect(overview.health).toBeDefined();
      expect(overview.health.state).toBe('Needs Attention');
      expect(overview.health.summary).toBeDefined();
      expect(Array.isArray(overview.health.drivers)).toBe(true);

      // Funnel
      expect(overview.funnel).toBeDefined();
      expect(overview.funnel.appliedToInterview).toBeDefined();
      expect(overview.funnel.appliedToInterview.status).toBe('insufficient_sample'); // 2 apps < 5

      // Stalled Applications
      expect(Array.isArray(overview.stalledApplications)).toBe(true);
      expect(overview.stalledApplications.length).toBe(1);
      expect(overview.stalledApplications[0].organization).toBe('Acme Corp');
      expect(overview.stalledApplications[0].ageDays).toBe(20);

      // Recent Activity
      expect(overview.recentActivity).toBeDefined();
      expect(overview.recentActivity.recentCount).toBe(2);
      expect(overview.recentActivity.velocity).toBe('low');

      // Interview Insights
      expect(Array.isArray(overview.interviewInsights)).toBe(true);
      expect(overview.interviewInsights.length).toBe(1);
      expect(overview.interviewInsights[0].interviewScheduled).toBe(false);
      expect(overview.interviewInsights[0].preparationSignal).toContain('without scheduled calendar event');

      // Preparation Feedback
      expect(Array.isArray(overview.preparationFeedback)).toBe(true);
      const opp1Prep = overview.preparationFeedback.find((p) => p.opportunityId === String(opp1._id));
      expect(opp1Prep).toBeDefined();
      expect(opp1Prep.prepStatus).toBe('prep_pending_at_apply');

      // Follow-up Actions
      expect(Array.isArray(overview.actions)).toBe(true);
      expect(overview.actions.length).toBe(1);
      expect(overview.actions[0].actionKey).toMatch(/^followup:/);
      expect(overview.actions[0].priority).toBe('Medium'); // 20 days < 21 days for High

      // Generated timestamp
      expect(overview.generatedAt).toBeDefined();

      // Sanitization check: Student notes must not leak
      expect(JSON.stringify(res.body)).not.toContain('TOP_SECRET_STUDENT_APPLICATION_NOTE');
    });
  });

  // =========================================================================
  // 3. OUTCOMES ENDPOINT PAYLOAD & REJECTION GAP CONTRACT
  // =========================================================================
  describe('3. GET /api/intelligence/applications/outcomes Payload Contract', () => {
    it('returns outcomes summary, role patterns, conversion metrics, and rejection gaps', async () => {
      // Create candidate profile with only intermediate react (typescript missing)
      await Profile.create({
        userId: userA._id,
        skills: [{ name: 'react', level: 'intermediate' }],
        projects: [],
      });

      // 3 rejected applications (all requiring TypeScript)
      await Application.create([
        {
          userId: userA._id,
          opportunityId: opp1._id,
          type: 'application',
          status: 'rejected',
          appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
        },
        {
          userId: userA._id,
          opportunityId: opp2._id,
          type: 'application',
          status: 'rejected',
          appliedAt: new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000),
        },
        {
          userId: userA._id,
          opportunityId: opp3._id,
          type: 'application',
          status: 'rejected',
          appliedAt: new Date(FIXED_REF_DATE.getTime() - 15 * 24 * 60 * 60 * 1000),
        },
      ]);

      const res = await request(app)
        .get(`/api/intelligence/applications/outcomes?referenceDate=${FIXED_REF_DATE.toISOString()}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const outcomes = res.body.outcomes;
      expect(outcomes).toBeDefined();

      // Outcomes counts
      expect(outcomes.outcomes.rejected).toBe(3);
      expect(outcomes.outcomes.selected).toBe(0);
      expect(outcomes.outcomes.active).toBe(0);

      // Rejection Patterns
      expect(outcomes.rejectionPatterns.status).toBe('available');
      expect(outcomes.rejectionPatterns.totalRejectedOpportunitiesAnalyzed).toBe(3);
      expect(Array.isArray(outcomes.rejectionPatterns.patterns)).toBe(true);

      const tsGap = outcomes.rejectionPatterns.patterns.find((p) => p.canonicalKey === 'typescript');
      expect(tsGap).toBeDefined();
      expect(tsGap.rejectedOpportunityCount).toBe(3);
      expect(tsGap.recurrencePercent).toBe(100);
      expect(tsGap.candidateEvidence).toBe('unverified');

      // Role Patterns
      expect(Array.isArray(outcomes.rolePatterns)).toBe(true);
      const internshipGroup = outcomes.rolePatterns.find((p) => p.groupKey === 'type:internship');
      expect(internshipGroup).toBeDefined();
      expect(internshipGroup.applications).toBe(2);
      expect(internshipGroup.rejected).toBe(2);

      // Conversion Metrics
      expect(outcomes.conversionMetrics).toBeDefined();
      expect(outcomes.conversionMetrics.appliedToInterview).toBeDefined();

      // Preparation outcome observations
      expect(Array.isArray(outcomes.preparationOutcomeObservations)).toBe(true);
    });
  });

  // =========================================================================
  // 4. CAUSALITY GUARDRAIL VERIFICATION
  // =========================================================================
  describe('4. Causality Guardrail Verification in API Responses', () => {
    it('strictly outputs observational language and never contains forbidden causal phrases', async () => {
      await Profile.create({
        userId: userA._id,
        skills: [],
      });

      // 3 rejected applications
      await Application.create([
        { userId: userA._id, opportunityId: opp1._id, type: 'application', status: 'rejected', appliedAt: FIXED_REF_DATE },
        { userId: userA._id, opportunityId: opp2._id, type: 'application', status: 'rejected', appliedAt: FIXED_REF_DATE },
        { userId: userA._id, opportunityId: opp3._id, type: 'application', status: 'rejected', appliedAt: FIXED_REF_DATE },
      ]);

      const res = await request(app)
        .get(`/api/intelligence/applications/outcomes?referenceDate=${FIXED_REF_DATE.toISOString()}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const patterns = res.body.outcomes.rejectionPatterns.patterns;
      expect(patterns.length).toBeGreaterThan(0);

      const forbiddenPhrases = [
        'rejected because',
        'caused your rejection',
        'reason for rejection',
        'employer rejected you because',
        'fault',
      ];

      for (const pattern of patterns) {
        expect(pattern.observation).toMatch(/^Observational Pattern:/i);
        const lowerObs = pattern.observation.toLowerCase();
        for (const forbidden of forbiddenPhrases) {
          expect(lowerObs).not.toContain(forbidden);
        }
      }
    });
  });

  // =========================================================================
  // 5. SAMPLE SIZE SUPPRESSION & FUNNEL SEMANTICS
  // =========================================================================
  describe('5. Sample Size Suppression & Funnel Semantics', () => {
    it('suppresses percentage when sample size < 5 and preserves numerator/denominator', async () => {
      // 3 applications: 1 selected, 2 interview
      await Application.create([
        { userId: userA._id, opportunityId: opp1._id, type: 'application', status: 'interview', appliedAt: FIXED_REF_DATE },
        { userId: userA._id, opportunityId: opp2._id, type: 'application', status: 'interview', appliedAt: FIXED_REF_DATE },
        { userId: userA._id, opportunityId: opp3._id, type: 'application', status: 'selected', appliedAt: FIXED_REF_DATE },
      ]);

      const res = await request(app)
        .get('/api/intelligence/applications/overview')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const funnel = res.body.overview.funnel;

      expect(funnel.overallSelected.percentage).toBeNull();
      expect(funnel.overallSelected.status).toBe('insufficient_sample');
      expect(funnel.overallSelected.numerator).toBe(1);
      expect(funnel.overallSelected.denominator).toBe(3);
      expect(funnel.overallSelected.message).toMatch(/unlock after tracking 5 applications/i);
    });

    it('calculates deterministic percentages when sample size >= 5', async () => {
      // Create 5 saved opportunities
      const savedOps = [opp1, opp2, opp3, opp4];
      for (const opp of savedOps) {
        await SavedOpportunity.create({ userId: userA._id, opportunityId: opp._id });
      }
      const opp5 = await Opportunity.create({
        title: 'Fifth Opportunity',
        organization: 'Fifth Corp',
        type: 'internship',
        status: 'published',
        description: 'Fifth description',
      });
      await SavedOpportunity.create({ userId: userA._id, opportunityId: opp5._id });

      // Create 5 applications (all saved were applied)
      for (const opp of [opp1, opp2, opp3, opp4, opp5]) {
        await Application.create({
          userId: userA._id,
          opportunityId: opp._id,
          type: 'application',
          status: 'applied',
          appliedAt: FIXED_REF_DATE,
        });
      }

      const res = await request(app)
        .get('/api/intelligence/applications/overview')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const funnel = res.body.overview.funnel;

      expect(funnel.savedToApplied.status).toBe('available');
      expect(funnel.savedToApplied.percentage).toBe(100);
      expect(funnel.savedToApplied.numerator).toBe(5);
      expect(funnel.savedToApplied.denominator).toBe(5);
    });
  });

  // =========================================================================
  // 6. OWNERSHIP & MULTI-TENANT ISOLATION
  // =========================================================================
  describe('6. Ownership & Multi-Tenant Isolation', () => {
    it('isolates User A and User B intelligence completely and ignores query/body userId parameters', async () => {
      // User A application to opp1 (stalled)
      await Application.create({
        userId: userA._id,
        opportunityId: opp1._id,
        type: 'application',
        status: 'applied',
        appliedAt: new Date(FIXED_REF_DATE.getTime() - 25 * 24 * 60 * 60 * 1000),
      });

      // User B application to opp2 (active, not stalled)
      await Application.create({
        userId: userB._id,
        opportunityId: opp2._id,
        type: 'application',
        status: 'applied',
        appliedAt: new Date(FIXED_REF_DATE.getTime() - 2 * 24 * 60 * 60 * 1000),
      });

      // User A requests overview with malicious query ?userId=<User B's ID>
      const resA = await request(app)
        .get(`/api/intelligence/applications/overview?userId=${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      // User A must see only their own stalled application to opp1, not User B's app
      expect(resA.body.overview.stalledApplications.length).toBe(1);
      expect(resA.body.overview.stalledApplications[0].opportunityId).toBe(String(opp1._id));

      // User B requests overview
      const resB = await request(app)
        .get('/api/intelligence/applications/overview')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(200);
      // User B has 0 stalled applications
      expect(resB.body.overview.stalledApplications.length).toBe(0);
      expect(resB.body.overview.health.state).toBe('Healthy');
    });
  });

  // =========================================================================
  // 7. ERROR HANDLING & SANITIZATION
  // =========================================================================
  describe('7. Error Handling & Sanitization', () => {
    it('returns sanitized 500 when core intelligence calculation encounters unexpected error', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        vi.spyOn(appIntelligenceService, 'calculateApplicationIntelligence').mockRejectedValueOnce(
          new Error('Database cluster unreachable at mongodb://admin:secretpass@db:27017')
        );

        const res = await request(app)
          .get('/api/intelligence/applications/overview')
          .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Internal server error');
        expect(res.body.stack).toBeUndefined();
        // Stack trace or connection string must NOT leak
        expect(JSON.stringify(res.body)).not.toContain('secretpass');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // =========================================================================
  // 8. BACKWARD COMPATIBILITY
  // =========================================================================
  describe('8. Backward Compatibility with Existing Routes', () => {
    it('existing readiness and application routes remain fully functional', async () => {
      const resReadiness = await request(app)
        .get('/api/intelligence/readiness')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resReadiness.status).toBe(200);
      expect(resReadiness.body.success).toBe(true);
      expect(resReadiness.body.readiness).toBeDefined();

      const resApps = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resApps.status).toBe(200);
      expect(resApps.body.success).toBe(true);
      expect(Array.isArray(resApps.body.applications)).toBe(true);
    });
  });
});
