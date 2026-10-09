import { describe, it, expect } from 'vitest';
import {
  calculateCompletenessScore,
  calculateRelevanceScore,
  calculateQualityScore,
} from '../../src/services/ingestion/scoring.service.js';

describe('Opportunity Scoring Service Test Suite', () => {
  describe('1. Completeness Score (calculateCompletenessScore)', () => {
    it('scores high completeness (>= 80) for fully populated opportunity', () => {
      const highComp = {
        title: 'Software Engineer Intern',
        organization: 'Google',
        description: 'A very long description that meets the length requirements easily by being over fifty characters.',
        applicationUrl: 'https://google.com',
        type: 'internship',
        workMode: 'remote',
        skills: ['react'],
        deadline: new Date('2026-12-31'),
      };

      const score = calculateCompletenessScore(highComp);
      expect(score).toBeGreaterThanOrEqual(80);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('scores low completeness (<= 40) for minimal/sparse opportunity', () => {
      const lowComp = {
        title: 'X',
        organization: 'Y',
        description: 'short',
      };

      const score = calculateCompletenessScore(lowComp);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(40);
    });

    it('differentiates description length (>= 50 chars gives 30 pts, >= 20 chars gives 15 pts)', () => {
      const base = {
        title: 'Software Engineer',
        organization: 'Google',
        applicationUrl: 'https://google.com',
      };

      const longDesc = {
        ...base,
        description: 'This is a description that is definitely longer than fifty characters in total length.',
      };

      const mediumDesc = {
        ...base,
        description: 'Between 20 and 49 chars!',
      };

      const scoreLong = calculateCompletenessScore(longDesc);
      const scoreMedium = calculateCompletenessScore(mediumDesc);

      expect(scoreLong).toBeGreaterThan(scoreMedium);
      expect(scoreLong - scoreMedium).toBe(15);
    });

    it('awards logistics points for remote workMode or structured location', () => {
      const base = {
        title: 'Engineer',
        organization: 'Stripe',
        description: 'Description of reasonable length for test purposes here 12345.',
      };

      const remoteOpp = { ...base, workMode: 'remote' };
      const locationOpp = { ...base, location: { country: 'India', city: 'Bengaluru' } };
      const nonRemoteMode = { ...base, workMode: 'hybrid' };

      const scoreRemote = calculateCompletenessScore(remoteOpp);
      const scoreLocation = calculateCompletenessScore(locationOpp);
      const scoreHybrid = calculateCompletenessScore(nonRemoteMode);

      expect(scoreRemote).toBe(scoreLocation);
      expect(scoreRemote).toBeGreaterThan(scoreHybrid);
    });

    it('awards enrichment points for skills/tags and deadline/eventDate', () => {
      const base = {
        title: 'Engineer',
        organization: 'Stripe',
        description: 'Description of reasonable length for test purposes here 12345.',
      };

      const enriched = {
        ...base,
        skills: ['typescript'],
        deadline: new Date(),
      };

      expect(calculateCompletenessScore(enriched)).toBe(calculateCompletenessScore(base) + 5);
    });

    it('safely returns 0 for null, undefined, or empty object without throwing', () => {
      expect(calculateCompletenessScore(null)).toBe(0);
      expect(calculateCompletenessScore(undefined)).toBe(0);
      expect(calculateCompletenessScore({})).toBe(0);
    });
  });

  describe('2. Relevance Score (calculateRelevanceScore)', () => {
    it('scores high relevance (>= 80) for student/internship tech roles in India/Remote', () => {
      const highRel = {
        title: 'Frontend Intern',
        description: 'Looking for a student who knows React',
        type: 'internship',
        skills: ['javascript', 'react'],
        location: { country: 'India' },
      };

      const score = calculateRelevanceScore(highRel);
      expect(score).toBeGreaterThanOrEqual(80);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('scores low relevance (<= 40) for non-student, non-tech, onsite abroad roles', () => {
      const lowRel = {
        title: 'Marketing Manager',
        description: 'Help sell products to retail stores across the country',
        type: 'full_time',
        location: { country: 'USA' },
        workMode: 'onsite',
      };

      const score = calculateRelevanceScore(lowRel);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(40);
    });

    it('matches audience by student opportunity types (+40) or keyword search (+30)', () => {
      const explicitType = {
        title: 'Analyst',
        type: 'hackathon',
      };
      const textMatch = {
        title: 'Summer Fresher Analyst',
        type: 'job',
      };

      expect(calculateRelevanceScore(explicitType)).toBe(40);
      expect(calculateRelevanceScore(textMatch)).toBe(30);
    });

    it('matches CSE domain keywords via skills, tags, or text content', () => {
      const bySkill = { skills: ['python'] };
      const byTag = { tags: ['machine learning'] };
      const byDesc = { description: 'Looking for backend engineer' };

      expect(calculateRelevanceScore(bySkill)).toBe(30);
      expect(calculateRelevanceScore(byTag)).toBe(30);
      expect(calculateRelevanceScore(byDesc)).toBe(30);
    });

    it('matches geography by India location, remote mode, or text fallback', () => {
      const byIndia = { location: { country: 'India' } };
      const byRemote = { workMode: 'remote' };
      const byText = { description: 'Open to candidates across India' };

      expect(calculateRelevanceScore(byIndia)).toBe(30);
      expect(calculateRelevanceScore(byRemote)).toBe(30);
      expect(calculateRelevanceScore(byText)).toBe(15);
    });

    it('safely returns 0 for null, undefined, or empty object without throwing', () => {
      expect(calculateRelevanceScore(null)).toBe(0);
      expect(calculateRelevanceScore(undefined)).toBe(0);
      expect(calculateRelevanceScore({})).toBe(0);
    });
  });

  describe('3. Overall Quality Score (calculateQualityScore)', () => {
    it('combines 40% completeness and 60% relevance and applies penalty for missing URL', () => {
      const highComp = {
        title: 'Software Engineer Intern',
        organization: 'Google',
        description: 'A very long description that meets the length requirements easily by being over fifty characters.',
        applicationUrl: 'https://google.com',
        type: 'internship',
        workMode: 'remote',
        skills: ['react'],
      };

      const highRelNoUrl = {
        title: 'Frontend Intern',
        description: 'Looking for a student who knows React',
        type: 'internship',
        skills: ['javascript', 'react'],
        location: { country: 'India' },
      };

      const q1 = calculateQualityScore(highComp);
      const q2 = calculateQualityScore(highRelNoUrl);

      expect(q1).toBeGreaterThan(q2);
      expect(q1).toBeGreaterThanOrEqual(0);
      expect(q1).toBeLessThanOrEqual(100);
      expect(q2).toBeGreaterThanOrEqual(0);
      expect(q2).toBeLessThanOrEqual(100);
    });

    it('applies critical -30 penalty when both applicationUrl and registrationUrl are missing', () => {
      const oppWithUrl = {
        title: 'Backend Intern',
        organization: 'Amazon',
        description: 'A sufficiently long description with more than 50 characters for this role.',
        type: 'internship',
        workMode: 'remote',
        applicationUrl: 'https://amazon.jobs/1',
      };

      const oppWithoutUrl = {
        ...oppWithUrl,
        applicationUrl: undefined,
        registrationUrl: undefined,
      };

      const scoreWith = calculateQualityScore(oppWithUrl);
      const scoreWithout = calculateQualityScore(oppWithoutUrl);

      // Penalty is -30 from base quality, plus minor completeness difference
      expect(scoreWith - scoreWithout).toBeGreaterThanOrEqual(30);
    });

    it('treats registrationUrl as actionable URL to avoid penalty', () => {
      const oppWithRegUrl = {
        title: 'Hackathon 2026',
        organization: 'Devpost',
        description: 'A sufficiently long description with more than 50 characters for this event.',
        type: 'hackathon',
        workMode: 'remote',
        registrationUrl: 'https://devpost.com/register',
      };

      const oppWithoutAny = {
        ...oppWithRegUrl,
        registrationUrl: undefined,
      };

      expect(calculateQualityScore(oppWithRegUrl)).toBeGreaterThan(calculateQualityScore(oppWithoutAny));
    });

    it('strictly clamps final quality score within [0, 100]', () => {
      const zeroOpp = {};
      expect(calculateQualityScore(zeroOpp)).toBe(0);

      const maxOpp = {
        title: 'Senior Software Engineer Intern',
        organization: 'Google Inc',
        description: 'A very comprehensive description that clearly exceeds fifty characters in total length.',
        applicationUrl: 'https://google.com',
        type: 'internship',
        workMode: 'remote',
        skills: ['react', 'python', 'ai'],
        tags: ['software'],
        deadline: new Date(),
        location: { country: 'India' },
      };
      const maxScore = calculateQualityScore(maxOpp);
      expect(maxScore).toBeLessThanOrEqual(100);
      expect(maxScore).toBeGreaterThanOrEqual(95);
    });

    it('safely returns 0 for null or undefined opportunity', () => {
      expect(calculateQualityScore(null)).toBe(0);
      expect(calculateQualityScore(undefined)).toBe(0);
    });

    it('is completely deterministic across repeated evaluations', () => {
      const opp = {
        title: 'Deterministic Test Intern',
        organization: 'Acme',
        description: 'Description with sufficient length to pass minimum scoring thresholds.',
        applicationUrl: 'https://acme.org/apply',
        type: 'internship',
        workMode: 'remote',
        skills: ['node'],
      };

      const run1 = calculateQualityScore(opp);
      const run2 = calculateQualityScore(opp);
      const run3 = calculateQualityScore(opp);

      expect(run1).toBe(run2);
      expect(run2).toBe(run3);
    });
  });
});
