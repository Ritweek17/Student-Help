import { describe, it, expect } from 'vitest';
import {
  calculateOpportunityMatch,
  extractSkillsFromText,
  getOpportunityRequirements,
  getCandidateSkillProfile,
  evaluatePreferenceAlignment,
  getFitLevel,
  FIT_BANDS,
} from '../../src/services/intelligence/match.service.js';

describe('Match Service — Intelligence Engine', () => {
  const sampleOpportunity = {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    title: 'Full Stack Software Engineer Intern',
    organization: 'Acme Corp',
    type: 'internship',
    workMode: 'remote',
    location: { city: 'Bengaluru', country: 'India' },
    description: 'Looking for a passionate intern skilled in React, Node.js, and MongoDB.',
    shortDescription: 'Internship role with modern stack.',
    skills: ['react', 'node.js', 'mongodb', 'docker'],
  };

  const sampleProfile = {
    userId: '65f1a2b3c4d5e6f7a8b9c0d2',
    skills: [
      { name: 'react', level: 'advanced' },
      { name: 'nodejs', level: 'intermediate' },
    ],
    projects: [
      {
        title: 'Career Dashboard',
        description: 'React and Node web application',
        technologies: ['ReactJS', 'Node.js', 'MongoDB'],
      },
    ],
    careerPreferences: {
      opportunityTypes: ['internship'],
      preferredWorkModes: ['remote'],
      preferredLocations: ['Bengaluru'],
    },
  };

  describe('1. Determinism and Idempotency', () => {
    it('returns the exact same score and match payload for identical inputs', () => {
      const run1 = calculateOpportunityMatch(sampleProfile, sampleOpportunity);
      const run2 = calculateOpportunityMatch(sampleProfile, sampleOpportunity);

      expect(run1).toEqual(run2);
      expect(run1.score).toBe(run2.score);
      expect(run1.fitLevel).toBe(run2.fitLevel);
    });
  });

  describe('2. Empty and Incomplete Profiles', () => {
    it('handles empty profile gracefully with zero skills and full requirements as gaps', () => {
      const emptyProfile = { skills: [], projects: [] };
      const result = calculateOpportunityMatch(emptyProfile, sampleOpportunity);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.matchedSkills).toHaveLength(0);
      expect(result.skillGaps.length).toBeGreaterThan(0);
      expect(result.signals.skillAlignment.matchedCount).toBe(0);
    });

    it('handles null profile without throwing', () => {
      const result = calculateOpportunityMatch(null, sampleOpportunity);
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.matchedSkills).toHaveLength(0);
    });
  });

  describe('3. Missing Opportunity Skills (Neutral Behavior)', () => {
    it('awards neutral skill baseline and creates no false gaps if opportunity has no skills', () => {
      const oppNoSkills = {
        title: 'General Fellowship',
        type: 'fellowship',
        workMode: 'remote',
        skills: [],
        description: 'Open to all students across all engineering branches.',
      };

      const result = calculateOpportunityMatch(sampleProfile, oppNoSkills);
      expect(result.skillGaps).toHaveLength(0);
      expect(result.matchedSkills).toHaveLength(0);
      expect(result.signals.skillAlignment.totalRequired).toBe(0);
      expect(result.signals.skillAlignment.score).toBe(35); // Neutral baseline
    });
  });

  describe('4. Canonical Alias Matching', () => {
    it('matches aliases across profile, projects, and opportunity (e.g. ReactJS, node.js, mongo)', () => {
      const opp = {
        title: 'Backend Dev',
        type: 'internship',
        workMode: 'remote',
        skills: ['react', 'node', 'mongodb'],
      };

      const profile = {
        skills: [{ name: 'React.js', level: 'expert' }],
        projects: [
          {
            title: 'API Server',
            technologies: ['NodeJS', 'Mongo DB'],
          },
        ],
      };

      const result = calculateOpportunityMatch(profile, opp);
      const matchedKeys = result.matchedSkills.map((s) => s.canonicalKey);

      expect(matchedKeys).toContain('react');
      expect(matchedKeys).toContain('node.js');
      expect(matchedKeys).toContain('mongodb');
      expect(result.skillGaps).toHaveLength(0);
    });
  });

  describe('5. Claimed vs Demonstrated Evidence', () => {
    it('distinguishes claimed skills, demonstrated skills, and both', () => {
      const profile = {
        skills: [
          { name: 'react', level: 'advanced' },
          { name: 'python', level: 'beginner' },
        ],
        projects: [
          {
            title: 'E-commerce App',
            technologies: ['react', 'postgresql'],
          },
        ],
      };

      const opp = {
        type: 'internship',
        workMode: 'remote',
        skills: ['react', 'python', 'postgresql'],
      };

      const result = calculateOpportunityMatch(profile, opp);
      const reactMatch = result.matchedSkills.find((s) => s.canonicalKey === 'react');
      const pyMatch = result.matchedSkills.find((s) => s.canonicalKey === 'python');
      const pgMatch = result.matchedSkills.find((s) => s.canonicalKey === 'postgresql');

      // React is both claimed and demonstrated
      expect(reactMatch.isClaimed).toBe(true);
      expect(reactMatch.isDemonstrated).toBe(true);
      expect(reactMatch.projects).toContain('E-commerce App');

      // Python is claimed only
      expect(pyMatch.isClaimed).toBe(true);
      expect(pyMatch.isDemonstrated).toBe(false);

      // PostgreSQL is demonstrated in project only
      expect(pgMatch.isClaimed).toBe(false);
      expect(pgMatch.isDemonstrated).toBe(true);
      expect(pgMatch.projects).toContain('E-commerce App');
    });
  });

  describe('6. Skill Gaps Detection', () => {
    it('correctly reports missing skills as skill gaps', () => {
      const opp = {
        skills: ['react', 'docker', 'kubernetes', 'aws'],
      };
      const profile = {
        skills: [{ name: 'react', level: 'intermediate' }],
        projects: [],
      };

      const result = calculateOpportunityMatch(profile, opp);
      expect(result.matchedSkills.map((s) => s.canonicalKey)).toEqual(['react']);
      const gapKeys = result.skillGaps.map((g) => g.canonicalKey);
      expect(gapKeys).toContain('docker');
      expect(gapKeys).toContain('kubernetes');
      expect(gapKeys).toContain('aws');
      expect(gapKeys).not.toContain('react');
    });
  });

  describe('7. Deterministic Description Extraction & False-Positive Safeguards', () => {
    it('extracts canonical skills from description text when explicit skills are sparse', () => {
      const text = 'We build cloud backends using TypeScript, FastAPI, and Redis.';
      const extracted = extractSkillsFromText(text);
      const keys = extracted.map((e) => e.canonicalKey);

      expect(keys).toContain('typescript');
      expect(keys).toContain('fastapi');
      expect(keys).toContain('redis');
    });

    it('safely distinguishes C++ and C# from plain C without false positives', () => {
      const cppText = 'Requirements: Strong knowledge of C++ and algorithms.';
      const extractedCpp = extractSkillsFromText(cppText);
      const cppKeys = extractedCpp.map((e) => e.canonicalKey);
      expect(cppKeys).toContain('c++');
      expect(cppKeys).not.toContain('c');

      const csharpText = 'Requirements: Experience with C# and .NET.';
      const extractedCsharp = extractSkillsFromText(csharpText);
      const csharpKeys = extractedCsharp.map((e) => e.canonicalKey);
      expect(csharpKeys).toContain('c#');
      expect(csharpKeys).not.toContain('c');
    });

    it('distinguishes React from React Native in description text', () => {
      const text = 'We develop using React Native for iOS and Android.';
      const extracted = extractSkillsFromText(text);
      const keys = extracted.map((e) => e.canonicalKey);

      expect(keys).toContain('react native');
      expect(keys).not.toContain('react');
    });

    it('does not match common English word "go" unless Golang is mentioned', () => {
      const ordinaryText = 'You will go to workshops and collaborate with mentors.';
      const extracted = extractSkillsFromText(ordinaryText);
      expect(extracted.map((e) => e.canonicalKey)).not.toContain('go');

      const golangText = 'Experience in Golang backend microservices.';
      const extractedGo = extractSkillsFromText(golangText);
      expect(extractedGo.map((e) => e.canonicalKey)).toContain('go');
    });
  });

  describe('8. Career Preferences Alignment', () => {
    it('awards positive points when opportunity type matches user preference', () => {
      const profile = {
        careerPreferences: {
          opportunityTypes: ['hackathon'],
        },
      };
      const matchHackathon = calculateOpportunityMatch(profile, { type: 'hackathon', workMode: 'remote' });
      const matchInternship = calculateOpportunityMatch(profile, { type: 'internship', workMode: 'remote' });

      expect(matchHackathon.signals.preferences.typeMatch).toBe(true);
      expect(matchInternship.signals.preferences.typeMatch).toBe(false);
      expect(matchHackathon.score).toBeGreaterThan(matchInternship.score);
    });

    it('treats unconfigured preferences as neutral without penalizing', () => {
      const profileNoPrefs = { careerPreferences: {} };
      const opp = { type: 'internship', workMode: 'remote' };

      const res = calculateOpportunityMatch(profileNoPrefs, opp);
      expect(res.signals.preferences.typeScore).toBe(10); // Neutral baseline
      expect(res.signals.preferences.typeMatch).toBeNull();
    });

    it('evaluates work mode alignment correctly', () => {
      const remoteOpp = { type: 'internship', workMode: 'remote' };
      const onsiteOpp = { type: 'internship', workMode: 'onsite', location: { city: 'Tokyo' } };

      const profilePrefersRemote = {
        careerPreferences: { preferredWorkModes: ['remote'] },
        personal: { location: { city: 'Delhi' } },
      };

      const resRemote = calculateOpportunityMatch(profilePrefersRemote, remoteOpp);
      const resOnsite = calculateOpportunityMatch(profilePrefersRemote, onsiteOpp);

      expect(resRemote.signals.preferences.workModeMatch).toBe(true);
      expect(resOnsite.signals.preferences.workModeMatch).toBe(false);
    });
  });

  describe('9. Score Boundedness and Fit Bands', () => {
    it('always bounds score within 0 to 100', () => {
      const perfectProfile = {
        skills: [
          { name: 'react', level: 'expert' },
          { name: 'node.js', level: 'expert' },
          { name: 'mongodb', level: 'expert' },
          { name: 'docker', level: 'expert' },
        ],
        projects: [
          { title: 'P1', technologies: ['react', 'node.js', 'mongodb', 'docker'] },
        ],
        careerPreferences: {
          opportunityTypes: ['internship'],
          preferredWorkModes: ['remote'],
        },
      };

      const result = calculateOpportunityMatch(perfectProfile, sampleOpportunity);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.fitLevel).toBe('Excellent Fit');
    });

    it('resolves fit bands predictably across boundaries', () => {
      expect(getFitLevel(100)).toBe('Excellent Fit');
      expect(getFitLevel(85)).toBe('Excellent Fit');
      expect(getFitLevel(84)).toBe('Strong Fit');
      expect(getFitLevel(70)).toBe('Strong Fit');
      expect(getFitLevel(69)).toBe('Good Fit');
      expect(getFitLevel(50)).toBe('Good Fit');
      expect(getFitLevel(49)).toBe('Partial Fit');
      expect(getFitLevel(30)).toBe('Partial Fit');
      expect(getFitLevel(29)).toBe('Low Fit');
      expect(getFitLevel(0)).toBe('Low Fit');
    });
  });

  describe('10. Explanations Consistency', () => {
    it('produces structured, truthful explanations corresponding to actual signals', () => {
      const result = calculateOpportunityMatch(sampleProfile, sampleOpportunity);

      expect(result.explanations).toBeDefined();
      expect(Array.isArray(result.explanations.positive)).toBe(true);
      expect(Array.isArray(result.explanations.gaps)).toBe(true);

      // Positive should note matched skills
      expect(result.explanations.positive.some((txt) => txt.includes('Matched'))).toBe(true);
      // Gaps should note missing docker
      expect(result.explanations.gaps.some((txt) => txt.includes('Docker'))).toBe(true);
    });
  });

  describe('11. No Duplicate Skills or Gaps', () => {
    it('ensures matchedSkills and skillGaps have zero duplicate canonical keys', () => {
      const oppWithDupes = {
        type: 'internship',
        workMode: 'remote',
        skills: ['react', 'ReactJS', 'react.js', 'node', 'nodejs'],
      };

      const result = calculateOpportunityMatch(sampleProfile, oppWithDupes);
      const matchedKeys = result.matchedSkills.map((s) => s.canonicalKey);
      const gapKeys = result.skillGaps.map((g) => g.canonicalKey);

      expect(new Set(matchedKeys).size).toBe(matchedKeys.length);
      expect(new Set(gapKeys).size).toBe(gapKeys.length);
    });
  });
});
