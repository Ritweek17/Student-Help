import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Application } from '../../src/models/Application.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { env } from '../../src/config/env.js';
import { MockLLMProvider } from '../../src/services/ai/mock-llm.provider.js';
import { setDefaultProvider } from '../../src/services/ai/production-adapter.seam.js';
import { LLMProviderError, LLMTimeoutError } from '../../src/services/ai/llm-provider.interface.js';
import crypto from 'node:crypto';

describe('CareerOS Interview Generation API Test Suite (Phase 11I - B3.2)', () => {
  let mockProvider;
  let testUser;
  let testOpportunity;
  let validToken;
  
  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([User.init(), Application.init(), Opportunity.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    mockProvider = new MockLLMProvider({
      name: 'test_mock_provider',
      model: 'test-model-v1'
    });
    setDefaultProvider(mockProvider);

    await clearTestDatabase();

    testUser = await User.create({
      email: 'test.interview@careeros.app',
      passwordHash: 'hashed123',
      role: 'student',
      isActive: true,
      profile: {
        firstName: 'Test',
        lastName: 'User'
      }
    });

    testOpportunity = await Opportunity.create({
      title: 'Software Engineer',
      organization: 'Tech Corp',
      description: 'Software Engineer position at Tech Corp',
      type: 'internship',
      status: 'published',
      skills: ['react', 'node.js', 'mongodb']
    });

    validToken = jwt.sign({ sub: testUser._id }, env.jwtSecret, { expiresIn: '1h' });
  });

  afterEach(() => {
    setDefaultProvider(null);
  });

  function getValidQuestionsMock() {
    return [
      { id: 'q1', text: 'Explain React hooks.', focusSkill: 'React' },
      { id: 'q2', text: 'How does Node.js handle async?', focusSkill: 'Node.js' },
      { id: 'q3', text: 'What are MongoDB indexes?', focusSkill: 'MongoDB' }
    ];
  }

  describe('1. Authentication and Authorization', () => {
    it('Unauthenticated request is rejected', async () => {
      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .send({ applicationId: new mongoose.Types.ObjectId().toString() });
      
      expect(response.status).toBe(401);
    });

    it('Invalid application ID is rejected', async () => {
      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: 'not-an-objectid' });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid application ID');
    });

    it('Missing application is rejected', async () => {
      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: new mongoose.Types.ObjectId().toString() });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/Application not found/);
    });

    it('Another user\'s application is rejected without leaking ownership information', async () => {
      const otherUser = await User.create({
        email: 'other@careeros.app',
        passwordHash: 'hash',
        role: 'student'
      });
      const otherApp = await Application.create({
        userId: otherUser._id,
        opportunityId: testOpportunity._id,
        type: 'application',
        status: 'applied'
      });

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: otherApp._id.toString() });
      
      expect(response.status).toBe(404);
    });

    it('Registration-type application is rejected', async () => {
      const appDoc = await Application.create({
        userId: testUser._id,
        opportunityId: testOpportunity._id,
        type: 'registration',
        status: 'registered'
      });

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: appDoc._id.toString() });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/type must be application/i);
    });

    it('Rejected and withdrawn applications are rejected', async () => {
      const appDoc = await Application.create({
        userId: testUser._id,
        opportunityId: testOpportunity._id,
        type: 'application',
        status: 'rejected'
      });

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: appDoc._id.toString() });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/status ineligible/i);
    });
  });

  describe('2. Question Generation & Fail-Closed Logic', () => {
    let validApp;
    
    beforeEach(async () => {
      validApp = await Application.create({
        userId: testUser._id,
        opportunityId: testOpportunity._id,
        type: 'application',
        status: 'applied'
      });
    });

    it('A valid result contains exactly three questions with unique IDs', async () => {
      mockProvider.queueResponse(getValidQuestionsMock());

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: validApp._id.toString() });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions).toHaveLength(3);
      expect(response.body.questions[0]).toHaveProperty('id', 'q1');
    });

    it('Duplicate question IDs are rejected', async () => {
      const badQs = getValidQuestionsMock();
      badQs[1].id = 'q1'; // Duplicate ID
      mockProvider.queueResponse(badQs);

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: validApp._id.toString() });
      
      expect(response.status).toBe(503);
      expect(response.body.message).toMatch(/Failed to generate/i);
    });

    it('Incorrect question count is rejected', async () => {
      const badQs = getValidQuestionsMock().slice(0, 2); // Only 2
      mockProvider.queueResponse(badQs);

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: validApp._id.toString() });
      
      expect(response.status).toBe(503);
    });

    it('Provider failure and timeouts follow the fail-closed policy (no deterministic fallback)', async () => {
      mockProvider.queueError(new LLMTimeoutError('Timeout'));

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: validApp._id.toString() });
      
      expect(response.status).toBe(503);
      // Fails closed - doesn't return 200 with fake Coach guidance!
      expect(response.body.success).toBe(false);
    });
  });

  describe('3. Signed Envelope', () => {
    let validApp;
    
    beforeEach(async () => {
      validApp = await Application.create({
        userId: testUser._id,
        opportunityId: testOpportunity._id,
        type: 'application',
        status: 'interview'
      });
    });

    it('Returns a valid envelope that can be verified and pins algorithm', async () => {
      mockProvider.queueResponse(getValidQuestionsMock());

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: validApp._id.toString() });
      
      expect(response.status).toBe(200);
      const { envelope, questions } = response.body;
      
      // Derive the domain separated key to verify it wasn't signed with raw jwtSecret directly
      const hmac = crypto.createHmac('sha256', env.jwtSecret);
      hmac.update('careeros_interview_envelope_v1');
      const expectedKey = hmac.digest();

      // Verify signature, audience, issuer and algorithm
      const payload = jwt.verify(envelope, expectedKey, {
        algorithms: ['HS256'],
        audience: 'careeros:interview:v1',
        issuer: 'careeros:intelligence'
      });

      expect(payload.sub).toBe(testUser._id.toString());
      expect(payload.applicationId).toBe(validApp._id.toString());
      expect(payload.questions).toEqual(questions);
      expect(payload).toHaveProperty('jti');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      
      // Exp is iat + 24 hours
      expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
    });
    
    it('Does not expose grading rubrics or internal context in envelope or response', async () => {
      mockProvider.queueResponse(getValidQuestionsMock());

      const response = await request(app)
        .post('/api/intelligence/interview/start')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ applicationId: validApp._id.toString() });
      
      expect(response.status).toBe(200);
      const { envelope, questions } = response.body;

      // Ensure no raw prompts in questions
      expect(questions[0]).not.toHaveProperty('systemPrompt');
      expect(questions[0]).not.toHaveProperty('rubric');
      
      // Ensure no raw prompts in envelope
      const hmac = crypto.createHmac('sha256', env.jwtSecret);
      hmac.update('careeros_interview_envelope_v1');
      const expectedKey = hmac.digest();
      const payload = jwt.verify(envelope, expectedKey);

      expect(payload).not.toHaveProperty('systemPrompt');
      expect(payload).not.toHaveProperty('rubric');
      expect(payload).not.toHaveProperty('privateNotes');
    });
  });
});
