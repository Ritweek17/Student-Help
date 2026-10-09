import { describe, it, expect } from 'vitest';
import {
  extractGitHubSkillEvidence,
  buildGitHubEvidence,
} from '../../src/services/intelligence/github-evidence.service.js';

describe('GitHub Evidence Normalization Suite (Phase 11E — Deterministic & Offline)', () => {
  const fixedDate = new Date('2026-10-06T12:00:00.000Z');

  // -------------------------------------------------------------
  // 1. Language Normalization & Canonical Mapping
  // -------------------------------------------------------------
  describe('Language Normalization', () => {
    it('normalizes primary repository languages to canonical skills', () => {
      const repos = [
        {
          name: 'ts-backend',
          language: 'TypeScript',
          fork: false,
          pushed_at: '2026-09-01T00:00:00Z',
        },
        {
          name: 'py-crawler',
          language: 'Python',
          fork: false,
          pushed_at: '2026-08-15T00:00:00Z',
        },
      ];

      const result = extractGitHubSkillEvidence(
        { login: 'student-dev', public_repos: 2 },
        repos,
        { syncedAt: fixedDate }
      );

      expect(result.username).toBe('student-dev');
      expect(result.publicRepoCount).toBe(2);
      expect(result.syncedAt).toEqual(fixedDate);
      expect(result.topLanguages).toEqual(['Python', 'TypeScript']); // Alphabetical tie-break

      expect(result.detectedSkills).toHaveLength(2);

      const skillKeys = result.detectedSkills.map((s) => s.canonicalKey);
      expect(skillKeys).toContain('typescript');
      expect(skillKeys).toContain('python');

      const tsSkill = result.detectedSkills.find((s) => s.canonicalKey === 'typescript');
      expect(tsSkill).toMatchObject({
        canonicalKey: 'typescript',
        displayName: 'TypeScript',
        category: 'languages',
        repoCount: 1,
      });
      expect(tsSkill.repositories[0].name).toBe('ts-backend');
    });
  });

  // -------------------------------------------------------------
  // 2. Topic Normalization & Noise Filtering
  // -------------------------------------------------------------
  describe('Topic Normalization & Unsupported Topic Filtering', () => {
    it('normalizes recognized technical topics and resolves aliases', () => {
      const repos = [
        {
          name: 'fullstack-app',
          language: 'JavaScript',
          fork: false,
          topics: ['react', 'docker', 'k8s', 'nodejs', 'mongodb'],
        },
      ];

      const result = extractGitHubSkillEvidence(
        { login: 'student-dev' },
        repos,
        { syncedAt: fixedDate }
      );

      const detectedKeys = result.detectedSkills.map((s) => s.canonicalKey);

      expect(detectedKeys).toContain('javascript');
      expect(detectedKeys).toContain('react');
      expect(detectedKeys).toContain('docker');
      expect(detectedKeys).toContain('kubernetes'); // k8s alias
      expect(detectedKeys).toContain('node.js'); // nodejs alias
      expect(detectedKeys).toContain('mongodb');
    });

    it('safely ignores non-technical, social, or unsupported topics', () => {
      const repos = [
        {
          name: 'portfolio-site',
          language: 'HTML',
          fork: false,
          topics: [
            'portfolio',
            'interview-prep',
            'hacktoberfest',
            'resume',
            'awesome-list',
            'random-custom-tag-12345',
          ],
        },
      ];

      const result = extractGitHubSkillEvidence(
        { login: 'student-dev' },
        repos,
        { syncedAt: fixedDate }
      );

      const detectedKeys = result.detectedSkills.map((s) => s.canonicalKey);

      expect(detectedKeys).not.toContain('portfolio');
      expect(detectedKeys).not.toContain('interview-prep');
      expect(detectedKeys).not.toContain('hacktoberfest');
      expect(detectedKeys).not.toContain('resume');
      expect(detectedKeys).not.toContain('awesome-list');
    });
  });

  // -------------------------------------------------------------
  // 3. Deduplication & Skill Merging
  // -------------------------------------------------------------
  describe('Deduplication & Skill Merging', () => {
    it('merges identical canonical skills discovered from both language and topic', () => {
      const repos = [
        {
          name: 'react-dashboard',
          language: 'JavaScript',
          fork: false,
          topics: ['javascript', 'js', 'react'], // both 'javascript' and 'js' resolve to 'javascript'
        },
      ];

      const result = extractGitHubSkillEvidence({ user: { login: 'dev' }, repositories: repos });

      const jsSkill = result.detectedSkills.find((s) => s.canonicalKey === 'javascript');
      expect(jsSkill).toBeDefined();
      expect(jsSkill.repoCount).toBe(1); // not duplicated!
      expect(jsSkill.repositories).toHaveLength(1);
      expect(jsSkill.repositories[0].name).toBe('react-dashboard');
    });

    it('combines evidence across multiple repositories for the same skill', () => {
      const repos = [
        {
          name: 'service-auth',
          language: 'Go',
          fork: false,
          pushed_at: '2026-09-10T00:00:00Z',
        },
        {
          name: 'service-orders',
          language: 'Go',
          fork: false,
          pushed_at: '2026-09-20T00:00:00Z',
        },
        {
          name: 'service-frontend',
          language: 'TypeScript',
          fork: false,
          pushed_at: '2026-09-15T00:00:00Z',
        },
      ];

      const result = extractGitHubSkillEvidence({ login: 'gopher' }, repos);

      // Go should have repoCount 2, TypeScript should have repoCount 1
      expect(result.detectedSkills[0].canonicalKey).toBe('go');
      expect(result.detectedSkills[0].repoCount).toBe(2);
      expect(result.detectedSkills[0].repositories).toHaveLength(2);

      // Verify repos within Go are sorted by pushed_at descending
      expect(result.detectedSkills[0].repositories[0].name).toBe('service-orders');
      expect(result.detectedSkills[0].repositories[1].name).toBe('service-auth');
    });
  });

  // -------------------------------------------------------------
  // 4. Fork Filtering Behavior
  // -------------------------------------------------------------
  describe('Fork Filtering', () => {
    it('ignores forks by default for primary skill evidence', () => {
      const repos = [
        {
          name: 'own-rust-lib',
          language: 'Rust',
          fork: false,
        },
        {
          name: 'forked-huge-cpp-engine',
          language: 'C++',
          fork: true,
          topics: ['c++', 'directx'],
        },
      ];

      const result = extractGitHubSkillEvidence({ login: 'rustacean' }, repos);

      const skillKeys = result.detectedSkills.map((s) => s.canonicalKey);
      expect(skillKeys).toContain('rust');
      expect(skillKeys).not.toContain('c++'); // Fork ignored
      expect(skillKeys).not.toContain('directx');
    });

    it('includes forks when includeForks option is explicitly set to true', () => {
      const repos = [
        {
          name: 'forked-cpp-project',
          language: 'C++',
          fork: true,
        },
      ];

      const result = extractGitHubSkillEvidence(
        { login: 'user' },
        repos,
        { includeForks: true }
      );

      const skillKeys = result.detectedSkills.map((s) => s.canonicalKey);
      expect(skillKeys).toContain('c++');
      expect(result.detectedSkills[0].repositories[0].isFork).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 5. Deterministic Ordering & Tie-Breaking
  // -------------------------------------------------------------
  describe('Deterministic Ordering', () => {
    it('orders skills by repoCount descending, then canonicalKey alphabetically', () => {
      const repos = [
        { name: 'repo-1', language: 'Python', fork: false },
        { name: 'repo-2', language: 'Python', fork: false },
        { name: 'repo-3', language: 'Java', fork: false },
        { name: 'repo-4', language: 'C++', fork: false },
      ];

      const result = extractGitHubSkillEvidence({ login: 'coder' }, repos);

      // Python has repoCount 2 -> 1st
      // C++ and Java have repoCount 1 -> 'c++' before 'java' alphabetically
      expect(result.detectedSkills[0].canonicalKey).toBe('python');
      expect(result.detectedSkills[0].repoCount).toBe(2);

      expect(result.detectedSkills[1].canonicalKey).toBe('c++');
      expect(result.detectedSkills[1].repoCount).toBe(1);

      expect(result.detectedSkills[2].canonicalKey).toBe('java');
      expect(result.detectedSkills[2].repoCount).toBe(1);
    });

    it('computes topLanguages sorted by frequency descending, then alphabetically', () => {
      const repos = [
        { name: 'r1', language: 'Python', fork: false },
        { name: 'r2', language: 'Python', fork: false },
        { name: 'r3', language: 'TypeScript', fork: false },
        { name: 'r4', language: 'TypeScript', fork: false },
        { name: 'r5', language: 'Go', fork: false },
      ];

      const result = extractGitHubSkillEvidence({ login: 'coder' }, repos);

      // Python and TypeScript both have 2, Go has 1
      // 'Python' before 'TypeScript' alphabetically
      expect(result.topLanguages).toEqual(['Python', 'TypeScript', 'Go']);
    });
  });

  // -------------------------------------------------------------
  // 6. Resilience & Edge Cases
  // -------------------------------------------------------------
  describe('Resilience & Edge Cases', () => {
    it('handles null, undefined, or empty repository arrays safely', () => {
      const result1 = extractGitHubSkillEvidence(null, null);
      expect(result1.username).toBe('');
      expect(result1.publicRepoCount).toBe(0);
      expect(result1.topLanguages).toEqual([]);
      expect(result1.detectedSkills).toEqual([]);

      const result2 = buildGitHubEvidence({ user: null, repositories: [] });
      expect(result2.detectedSkills).toEqual([]);
    });

    it('safely skips malformed repository records without throwing', () => {
      const repos = [
        null,
        undefined,
        'not-an-object',
        123,
        {}, // missing name
        { name: 'valid-repo', language: 'Ruby', fork: false },
        { name: 12345 }, // invalid name type
      ];

      const result = extractGitHubSkillEvidence({ login: 'rubyist' }, repos);
      expect(result.detectedSkills).toHaveLength(1);
      expect(result.detectedSkills[0].canonicalKey).toBe('ruby');
    });

    it('handles repositories with no detectable technical skills', () => {
      const repos = [
        {
          name: 'notes-and-docs',
          language: null,
          topics: ['documentation', 'markdown', 'notes'],
          fork: false,
        },
      ];

      const result = extractGitHubSkillEvidence({ login: 'writer' }, repos);
      expect(result.detectedSkills).toEqual([]);
      expect(result.topLanguages).toEqual([]);
    });

    it('supports composite object signature { user, repositories } and alias', () => {
      const composite = {
        user: { login: 'octocat', public_repos: 5 },
        repositories: [{ name: 'octo-app', language: 'JavaScript', fork: false }],
      };

      const result = buildGitHubEvidence(composite, { syncedAt: fixedDate });
      expect(result.username).toBe('octocat');
      expect(result.publicRepoCount).toBe(5);
      expect(result.detectedSkills[0].canonicalKey).toBe('javascript');
    });
  });
});
