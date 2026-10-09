import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Profile } from '../../src/models/Profile.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { User } from '../../src/models/User.js';

describe('CareerOS Intelligence Match API — /api/intelligence/opportunities/:id/match', () => {
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
    await Promise.all([User.init(), Profile.init(), Opportunity.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const studentAuth = await createTestUser('intel_student', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;

    const otherAuth = await createTestUser('intel_other', 'student');
    otherStudentUser = otherAuth.user;
    otherStudentToken = otherAuth.token;

    const adminAuth = await createTestUser('intel_admin', 'admin');
    adminUser = adminAuth.user;
    adminToken = adminAuth.token;

    // Create published opportunity
    testOpportunity = await Opportunity.create({
      title: 'Frontend Engineer Intern',
      organization: 'TechCorp',
      type: 'internship',
      workMode: 'remote',
      status: 'published',
      description: 'Join our UI team building with React, TypeScript, and Tailwind CSS.',
      skills: ['react', 'typescript', 'tailwind css'],
    });

    // Create draft opportunity
    draftOpportunity = await Opportunity.create({
      title: 'Secret Stealth Role',
      organization: 'StealthStartup',
      type: 'internship',
      workMode: 'remote',
      status: 'draft',
      description: 'Confidential unreleased posting.',
      skills: ['python'],
    });

    // Setup student profile with React and TypeScript
    await Profile.create({
      userId: studentUser._id,
      personal: {
        firstName: 'Alice',
        lastName: 'Student',
      },
      skills: [
        { name: 'React', level: 'advanced' },
        { name: 'TypeScript', level: 'intermediate' },
      ],
      projects: [
        {
          title: 'Campus Portal',
          description: 'A student portal',
          technologies: ['ReactJS', 'Tailwind CSS'],
        },
      ],
      careerPreferences: {
        opportunityTypes: ['internship'],
        preferredWorkModes: ['remote'],
      },
    });

    // Setup other student with different skills
    await Profile.create({
      userId: otherStudentUser._id,
      personal: {
        firstName: 'Bob',
        lastName: 'Coder',
      },
      skills: [
        { name: 'Python', level: 'beginner' },
      ],
      projects: [],
    });
  });

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const res = await request(app)
      .get(`/api/intelligence/opportunities/${testOpportunity._id}/match`);

    expect(res.status).toBe(401);
  });

  it('rejects malformed opportunity ID with HTTP 400', async () => {
    const res = await request(app)
      .get('/api/intelligence/opportunities/not-a-valid-id/match')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid opportunity ID/i);
  });

  it('returns HTTP 404 for nonexistent opportunity ID', async () => {
    const randomId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/intelligence/opportunities/${randomId}/match`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Opportunity not found/i);
  });

  it('returns HTTP 404 for draft opportunities accessed by non-admin student', async () => {
    const res = await request(app)
      .get(`/api/intelligence/opportunities/${draftOpportunity._id}/match`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
  });

  it('allows admin to calculate match on draft opportunity', async () => {
    const res = await request(app)
      .get(`/api/intelligence/opportunities/${draftOpportunity._id}/match`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.match).toBeDefined();
  });

  it('returns complete match payload for student with skills and projects', async () => {
    const res = await request(app)
      .get(`/api/intelligence/opportunities/${testOpportunity._id}/match`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(String(res.body.opportunityId)).toBe(String(testOpportunity._id));

    const match = res.body.match;
    expect(match.score).toBeGreaterThanOrEqual(75);
    expect(match.fitLevel).toMatch(/Strong Fit|Excellent Fit/);
    expect(match.summary).toBeDefined();

    // Check matched skills
    const matchedNames = match.matchedSkills.map((s) => s.canonicalKey);
    expect(matchedNames).toContain('react');
    expect(matchedNames).toContain('typescript');
    expect(matchedNames).toContain('tailwind');

    // Evidence
    expect(match.evidence.length).toBeGreaterThan(0);
    expect(match.evidence.some((e) => e.skill === 'React' || e.skill === 'Tailwind CSS')).toBe(true);

    // Signals
    expect(match.signals.skillAlignment).toBeDefined();
    expect(match.signals.demonstratedEvidence).toBeDefined();
    expect(match.signals.preferences).toBeDefined();

    // Explanations
    expect(match.explanations.positive.length).toBeGreaterThan(0);
  });

  it('maintains strict user isolation: never leaks other user profile or scores', async () => {
    // Student Alice has React, TypeScript, Tailwind
    const resAlice = await request(app)
      .get(`/api/intelligence/opportunities/${testOpportunity._id}/match`)
      .set('Authorization', `Bearer ${studentToken}`);

    // Student Bob only has Python
    const resBob = await request(app)
      .get(`/api/intelligence/opportunities/${testOpportunity._id}/match`)
      .set('Authorization', `Bearer ${otherStudentToken}`);

    expect(resAlice.body.match.score).toBeGreaterThan(resBob.body.match.score);
    expect(resAlice.body.match.matchedSkills.length).toBe(3);
    expect(resBob.body.match.matchedSkills.length).toBe(0);
    expect(resBob.body.match.skillGaps.length).toBe(3);
  });

  it('handles brand new user without a Profile document gracefully', async () => {
    const freshUserAuth = await createTestUser('brand_new_user', 'student');

    const res = await request(app)
      .get(`/api/intelligence/opportunities/${testOpportunity._id}/match`)
      .set('Authorization', `Bearer ${freshUserAuth.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.match).toBeDefined();
    expect(res.body.match.matchedSkills).toHaveLength(0);
  });

  it('incorporates GitHub proof of work into API match payload when synced', async () => {
    // Add GitHub evidence to Alice's profile
    await Profile.updateOne(
      { userId: studentUser._id },
      {
        githubEvidence: {
          username: 'alice-coder',
          syncStatus: 'synced',
          syncedAt: new Date(),
          publicRepoCount: 5,
          detectedSkills: [
            {
              canonicalKey: 'typescript',
              displayName: 'TypeScript',
              category: 'languages',
              repoCount: 2,
              repositories: [
                {
                  name: 'ts-microservices',
                  url: 'https://github.com/alice-coder/ts-microservices',
                  isFork: false,
                  primaryLanguage: 'TypeScript',
                  updatedAt: new Date(),
                },
              ],
            },
          ],
        },
      }
    );

    const res = await request(app)
      .get(`/api/intelligence/opportunities/${testOpportunity._id}/match`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    const match = res.body.match;
    expect(match.signals.demonstratedEvidence.githubEvidenceCount).toBe(1);

    const tsMatch = match.matchedSkills.find((s) => s.canonicalKey === 'typescript');
    expect(tsMatch.hasGitHubEvidence).toBe(true);
    expect(tsMatch.githubEvidence.topRepository.name).toBe('ts-microservices');

    const ghEvidence = match.evidence.find((e) => e.type === 'github_verified');
    expect(ghEvidence).toBeDefined();
    expect(ghEvidence.skill).toBe('TypeScript');
    expect(ghEvidence.repository.name).toBe('ts-microservices');
  });
});
