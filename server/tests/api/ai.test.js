/**
 * CareerOS AI API & Security Test Suite (Phase 11H — B4)
 *
 * Verifies HTTP routes, authentication, strict request validation,
 * per-user rate limiting, daily quota enforcement, provider wiring,
 * safe fallback semantics, and all 23 security test conditions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Profile } from '../../src/models/Profile.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Application } from '../../src/models/Application.js';
import { MockLLMProvider } from '../../src/services/ai/mock-llm.provider.js';
import { setDefaultProvider, getAIProvider } from '../../src/services/ai/production-adapter.seam.js';
import { LLMTimeoutError, LLMProviderError } from '../../src/services/ai/llm-provider.interface.js';
import { resetAIRateLimits, resetAIMinuteLimit } from '../../src/middleware/rateLimiter.js';
import { validateAIConfiguration } from '../../src/config/env.js';

describe('CareerOS AI HTTP API — /api/ai/career-coach (Phase 11H — B4)', () => {
  let studentUser;
  let studentToken;
  let otherStudentUser;
  let otherStudentToken;
  let aliceOpportunity;
  let bobOpportunity;
  let mockProvider;

  const validAIResponse = {
    adviceType: 'general_guidance',
    headline: 'Build portfolio proof and projects',
    keyPoints: [
      'Focus on practical applications with verified repository evidence.',
      'Maintain regular practice and track your applications.',
    ],
    referencedSkills: [],
    suggestedAction: 'Explore published opportunities and align your learning goals.',
  };

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([User.init(), Profile.init(), Opportunity.init(), Application.init()]);
  });

  afterAll(async () => {
    setDefaultProvider(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // 1. Create primary student user (Alice) with React and Node.js
    const studentAuth = await createTestUser('alice_ai', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;

    await Profile.create({
      userId: studentUser._id,
      personal: { firstName: 'Alice', lastName: 'Developer' },
      careerGoal: { title: 'Full Stack React Engineer' },
      skills: [
        { name: 'React', level: 'advanced' },
        { name: 'Node.js', level: 'intermediate' },
      ],
      careerPreferences: {
        opportunityTypes: ['internship'],
        preferredWorkModes: ['remote'],
      },
    });

    // Create target opportunity and application for Alice
    aliceOpportunity = await Opportunity.create({
      title: 'Full Stack React Intern',
      organization: 'TechCorp',
      description: 'Hands on full stack internship with React and Node.js.',
      skills: ['react', 'node.js', 'docker'],
      type: 'internship',
      workMode: 'remote',
      status: 'published',
    });

    await Application.create({
      userId: studentUser._id,
      opportunityId: aliceOpportunity._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(),
    });

    // 2. Create secondary student user (Bob) with Python and Django
    const otherAuth = await createTestUser('bob_ai', 'student');
    otherStudentUser = otherAuth.user;
    otherStudentToken = otherAuth.token;

    await Profile.create({
      userId: otherStudentUser._id,
      personal: { firstName: 'Bob', lastName: 'Engineer' },
      careerGoal: { title: 'Backend Python Engineer' },
      skills: [
        { name: 'Python', level: 'intermediate' },
        { name: 'Django', level: 'intermediate' },
      ],
      careerPreferences: {
        opportunityTypes: ['internship'],
        preferredWorkModes: ['hybrid'],
      },
    });

    // Create target opportunity and application for Bob
    bobOpportunity = await Opportunity.create({
      title: 'Backend Python Engineer',
      organization: 'PyCorp',
      description: 'Python and Django backend services role.',
      skills: ['python', 'django', 'aws'],
      type: 'internship',
      workMode: 'hybrid',
      status: 'published',
    });

    await Application.create({
      userId: otherStudentUser._id,
      opportunityId: bobOpportunity._id,
      type: 'application',
      status: 'applied',
      appliedAt: new Date(),
    });

    // 3. Setup mock provider default
    mockProvider = new MockLLMProvider();
    mockProvider.defaultResponse = validAIResponse;
    setDefaultProvider(mockProvider);

    // 4. Reset rate limits
    await resetAIRateLimits(studentUser._id.toString());
    await resetAIRateLimits(otherStudentUser._id.toString());
  });

  // =========================================================================
  // 1. Unauthenticated Request -> 401
  // =========================================================================
  it('1. unauthenticated request → 401', async () => {
    const res = await request(app)
      .post('/api/ai/career-coach')
      .send({ query: 'How do I improve my resume?' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Authentication required/i);
  });

  // =========================================================================
  // 2. Authenticated Request -> Allowed
  // =========================================================================
  it('2. authenticated request → allowed', async () => {
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'What skills should I focus on next?' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe('ai');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.headline).toBe('Build portfolio proof and projects');
    expect(Array.isArray(res.body.data.keyPoints)).toBe(true);
    expect(res.body.requestId).toBeDefined();
  });

  // =========================================================================
  // 3. Missing Query -> 400
  // =========================================================================
  it('3. missing query → 400', async () => {
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.category).toBe('invalid_request');
    expect(res.body.message).toMatch(/query is required/i);
  });

  // =========================================================================
  // 4. Non-String Query -> 400
  // =========================================================================
  it('4. non-string query → 400', async () => {
    const resNumber = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 12345 });

    expect(resNumber.status).toBe(400);
    expect(resNumber.body.ok).toBe(false);
    expect(resNumber.body.category).toBe('invalid_request');
    expect(resNumber.body.message).toMatch(/query must be a string/i);

    const resArray = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: ['not', 'a', 'string'] });

    expect(resArray.status).toBe(400);

    const resEmpty = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: '   ' });

    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.message).toMatch(/query cannot be empty/i);
  });

  // =========================================================================
  // 5. Oversized Query -> 400
  // =========================================================================
  it('5. oversized query → 400', async () => {
    const longQuery = 'x'.repeat(501);
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: longQuery });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.category).toBe('invalid_request');
    expect(res.body.message).toMatch(/exceeds maximum length of 500 characters/i);
  });

  // =========================================================================
  // 6. Unsupported Body Fields -> 400
  // =========================================================================
  it('6. unsupported body fields', async () => {
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        query: 'Help me plan',
        injectedField: 'malicious',
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.category).toBe('invalid_request');
    expect(res.body.message).toMatch(/unsupported field/i);
  });

  // =========================================================================
  // 7. Client userId Cannot Alter Identity
  // =========================================================================
  it('7. client userId cannot alter identity', async () => {
    // Attempting to send userId in body is rejected by strict schema
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        query: 'What should I learn?',
        userId: otherStudentUser._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);

    // When valid query is processed, context passed to provider reflects Alice's opportunity
    const validRes = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'What should I learn?' });

    expect(validRes.status).toBe(200);
    expect(mockProvider.callHistory.length).toBe(1);
    const call = mockProvider.callHistory[0];
    expect(call.context.version).toBe('1');
    expect(call.context.careerGoalTitle).toBe('Full Stack React Engineer');
    expect(call.context.applicationPipelineHealth.totalTracked).toBe(1);
  });

  // =========================================================================
  // 8. Client Match Score Cannot Alter Context
  // =========================================================================
  it('8. client match score cannot alter context', async () => {
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        query: 'Evaluate my match',
        matchScore: 99,
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  // =========================================================================
  // 9. Client Readiness Cannot Alter Context
  // =========================================================================
  it('9. client readiness cannot alter context', async () => {
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        query: 'Evaluate readiness',
        readinessScore: 100,
        skillGaps: ['python'],
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  // =========================================================================
  // 10. Rate Limit After 5 Requests/Minute
  // =========================================================================
  it('10. rate limit after 5 requests/minute', async () => {
    // Send 5 successful requests
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/ai/career-coach')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ query: `Question ${i}` });
      expect(res.status).toBe(200);
    }

    // 6th request within same minute must be blocked
    const blockedRes = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Question 6' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.ok).toBe(false);
    expect(blockedRes.body.category).toBe('quota_exceeded');

    // Does not expose internal AI limiter state in body
    expect(blockedRes.body.remaining).toBeUndefined();
    expect(blockedRes.body.reset).toBeUndefined();
  });

  // =========================================================================
  // 11. Daily Quota Behavior (50 requests/day)
  // =========================================================================
  it('11. daily quota behavior', async () => {
    const userId = studentUser._id.toString();

    // Send 10 batches of 5 requests (= 50 total requests),
    // resetting the minute window between batches to simulate passing time.
    for (let batch = 0; batch < 10; batch++) {
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/ai/career-coach')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ query: `Batch ${batch} query ${i}` });
        expect(res.status).toBe(200);
      }
      // Reset minute limit only to allow next batch within daily window
      await resetAIMinuteLimit(userId);
    }

    // The 51st request exceeds daily quota (50 requests/day)
    const quotaExceededRes = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Request 51' });

    expect(quotaExceededRes.status).toBe(429);
    expect(quotaExceededRes.body.ok).toBe(false);
    expect(quotaExceededRes.body.category).toBe('quota_exceeded');
    expect(quotaExceededRes.body.message).toMatch(/daily quota exceeded/i);
  });

  // =========================================================================
  // 12. Provider Timeout -> Safe Fallback (200)
  // =========================================================================
  it('12. provider timeout', async () => {
    // Queue timeout errors (initial + retry)
    mockProvider.queueError(new LLMTimeoutError('Simulated timeout'));
    mockProvider.queueError(new LLMTimeoutError('Simulated timeout'));

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'How to prepare?' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');
    expect(res.body.reason).toBe('provider_timeout');
    expect(res.body.fallbackData).toBeDefined();
    expect(res.body.fallbackData.headline).toBeDefined();
  });

  // =========================================================================
  // 13. Provider Failure -> Safe Fallback (200)
  // =========================================================================
  it('13. provider failure', async () => {
    mockProvider.queueError(new LLMProviderError('Model unavailable', { category: 'provider_error' }));
    mockProvider.queueError(new LLMProviderError('Model unavailable', { category: 'provider_error' }));

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'How to prepare?' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');
    expect(res.body.reason).toBe('provider_error');
    expect(res.body.fallbackData).toBeDefined();
  });

  // =========================================================================
  // 14. Deterministic Fallback Structure
  // =========================================================================
  it('14. deterministic fallback', async () => {
    mockProvider.queueError(new LLMProviderError('Crashed', { category: 'provider_error' }));
    mockProvider.queueError(new LLMProviderError('Crashed', { category: 'provider_error' }));

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Next action?' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');

    const fallback = res.body.fallbackData;
    expect(fallback).toBeDefined();
    expect(typeof fallback.headline).toBe('string');
    expect(Array.isArray(fallback.keyPoints)).toBe(true);
    expect(Array.isArray(fallback.referencedSkills)).toBe(true);
    expect(typeof fallback.suggestedAction).toBe('string');
  });

  // =========================================================================
  // 15. Malformed AI Output -> Fallback
  // =========================================================================
  it('15. malformed AI output', async () => {
    // Unparseable JSON from model
    mockProvider.queueResponse('NOT_JSON_AT_ALL {{{');
    mockProvider.queueResponse('NOT_JSON_AT_ALL {{{');

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Advise me' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');
    expect(['invalid_json', 'schema_invalid']).toContain(res.body.reason);
    expect(res.body.fallbackData).toBeDefined();
  });

  // =========================================================================
  // 16. Grounding Failure -> Fallback
  // =========================================================================
  it('16. grounding failure', async () => {
    // AI references a skill that doesn't exist in TrustedAIContext
    const ungroundedResponse = {
      adviceType: 'skill_guidance',
      headline: 'Study quantum computing',
      keyPoints: ['Quantum computing is essential.'],
      referencedSkills: ['quantum-cryptography'],
      suggestedAction: 'Take a quantum mechanics course.',
    };
    mockProvider.queueResponse(ungroundedResponse);

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'What next?' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');
    expect(res.body.reason).toBe('grounding_failed');
    expect(res.body.fallbackData).toBeDefined();
  });

  // =========================================================================
  // 17. Unsafe Causal Rejection Statement -> Fallback
  // =========================================================================
  it('17. unsafe causal rejection statement', async () => {
    const causalResponse = {
      adviceType: 'skill_guidance',
      headline: 'Outcome Analysis',
      keyPoints: [
        'You were rejected because you lack Go skills.',
      ],
      referencedSkills: [],
      suggestedAction: 'Build projects demonstrating skills.',
    };
    mockProvider.queueResponse(causalResponse);

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Why was I rejected?' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');
    expect(res.body.reason).toBe('unsafe_output');
  });

  // =========================================================================
  // 18. Protected-Attribute Claim -> Fallback
  // =========================================================================
  it('18. protected-attribute claim', async () => {
    const biasedResponse = {
      adviceType: 'general_guidance',
      headline: 'Career Outlook',
      keyPoints: [
        'You will succeed because you are young and energetic.',
      ],
      referencedSkills: [],
      suggestedAction: 'Apply to open positions.',
    };
    mockProvider.queueResponse(biasedResponse);

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Advice for my background' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');
    expect(res.body.reason).toBe('unsafe_output');
  });

  // =========================================================================
  // 19. Missing Provider Credentials -> Safe Fallback
  // =========================================================================
  it('19. missing provider credentials', async () => {
    // When external provider is requested without API key, seam rejects cleanly
    expect(() => getAIProvider({ providerType: 'gemini', apiKey: null })).toThrow(/Missing credentials/i);

    // Endpoint handles unconfigured provider with machine-safe fallback
    const unconfiguredSeamError = new LLMProviderError('Provider credentials missing', {
      category: 'provider_unavailable',
    });
    mockProvider.queueError(unconfiguredSeamError);

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Hello' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.source).toBe('deterministic_fallback');
    expect(res.body.reason).toBe('provider_unavailable');
  });

  // =========================================================================
  // 20. Provider Credentials Never Appear in Response
  // =========================================================================
  it('20. provider credentials never appear in response', async () => {
    const mockApiKey = 'secret_test_api_key_xyz987';
    process.env.AI_API_KEY = mockApiKey;

    try {
      const resSuccess = await request(app)
        .post('/api/ai/career-coach')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ query: 'Check security' });

      expect(resSuccess.text).not.toContain(mockApiKey);

      const res400 = await request(app)
        .post('/api/ai/career-coach')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ query: 123 });

      expect(res400.text).not.toContain(mockApiKey);

      const res401 = await request(app)
        .post('/api/ai/career-coach')
        .send({ query: 'Unauth' });

      expect(res401.text).not.toContain(mockApiKey);
    } finally {
      delete process.env.AI_API_KEY;
    }
  });

  // =========================================================================
  // 21. Stack Traces Never Exposed
  // =========================================================================
  it('21. stack traces never exposed', async () => {
    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Valid query' });

    expect(res.body.stack).toBeUndefined();

    const resErr = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(resErr.body.stack).toBeUndefined();
  });

  // =========================================================================
  // 22. Cross-User Isolation
  // =========================================================================
  it('22. cross-user isolation', async () => {
    // 1. User A exhausts minute rate limit (5 requests)
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/ai/career-coach')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ query: `User A query ${i}` });
      expect(res.status).toBe(200);
    }

    // User A is now blocked
    const userABlocked = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'User A query 6' });
    expect(userABlocked.status).toBe(429);

    // 2. User B must NOT be blocked (independent rate limit bucket)
    const userBAllowed = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${otherStudentToken}`)
      .send({ query: 'User B query 1' });
    expect(userBAllowed.status).toBe(200);
    expect(userBAllowed.body.ok).toBe(true);

    // 3. User B context reflects User B's career goal and applications (not User A's)
    const callHistory = mockProvider.callHistory;
    const lastCall = callHistory[callHistory.length - 1];
    expect(lastCall.context.version).toBe('1');
    expect(lastCall.context.careerGoalTitle).toBe('Backend Python Engineer');
    expect(lastCall.context.careerGoalTitle).not.toBe('Full Stack React Engineer');
    expect(lastCall.context.applicationPipelineHealth.totalTracked).toBe(1);
  });

  // =========================================================================
  // 23. RequestId Propagation
  // =========================================================================
  it('23. requestId propagation', async () => {
    const clientRequestId = 'client-custom-req-uuid-999';

    const res = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .set('X-Request-Id', clientRequestId)
      .send({ query: 'Track this request' });

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(clientRequestId);
    expect(res.body.requestId).toBe(clientRequestId);

    // When client does not provide requestId, server generates UUID
    const resAuto = await request(app)
      .post('/api/ai/career-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ query: 'Auto request ID' });

    expect(resAuto.status).toBe(200);
    expect(resAuto.headers['x-request-id']).toBeDefined();
    expect(resAuto.headers['x-request-id'].length).toBeGreaterThan(10);
    expect(resAuto.body.requestId).toBe(resAuto.headers['x-request-id']);
  });

  // =========================================================================
  // 24. Environment Validation Tests
  // =========================================================================
  it('24. validates AI provider environment configuration', () => {
    // Valid mock
    const valid = validateAIConfiguration({ AI_PROVIDER: 'mock' });
    expect(valid.provider).toBe('mock');

    // Unsupported provider throws
    expect(() => validateAIConfiguration({ AI_PROVIDER: 'anthropic_not_supported' }))
      .toThrow(/Unsupported AI provider/i);

    // Gemini without key throws
    expect(() => validateAIConfiguration({ AI_PROVIDER: 'gemini', AI_API_KEY: '' }))
      .toThrow(/Missing provider credentials/i);

    // Invalid timeout throws
    expect(() => validateAIConfiguration({ AI_PROVIDER: 'mock', AI_TIMEOUT_MS: '-10' }))
      .toThrow(/AI_TIMEOUT_MS must be a positive number/i);
  });
});
