import { describe, it, expect } from 'vitest';
import {
  calculateOpportunityMatch,
  getCandidateSkillProfile,
  selectBestRepository,
  getFitLevel,
} from '../../src/services/intelligence/match.service.js';

describe('Match Service — GitHub Proof of Work Integration (Phase 11E Batch 4)', () => {
  const sampleOpportunity = {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    title: 'Senior Frontend Engineer',
    organization: 'FinTech Global',
    type: 'full-time',
    workMode: 'remote',
    location: { city: 'Bengaluru', country: 'India' },
    description: 'Looking for an experienced engineer in React, TypeScript, and Docker.',
    skills: ['react', 'typescript', 'docker'],
  };

  describe('1. Deterministic Repository Selection (selectBestRepository)', () => {
    it('prioritizes non-fork repositories over forks regardless of update date', () => {
      const repos = [
        { name: 'forked-react-app', url: 'https://github.com/u/forked', isFork: true, updatedAt: '2026-10-01T00:00:00Z' },
        { name: 'original-react-app', url: 'https://github.com/u/original', isFork: false, updatedAt: '2025-01-01T00:00:00Z' },
      ];

      const best = selectBestRepository(repos);
      expect(best.name).toBe('original-react-app');
      expect(best.isFork).toBe(false);
    });

    it('prioritizes most recently updated repository among non-forks', () => {
      const repos = [
        { name: 'older-app', url: 'https://github.com/u/older', isFork: false, updatedAt: '2025-06-01T00:00:00Z' },
        { name: 'newer-app', url: 'https://github.com/u/newer', isFork: false, updatedAt: '2026-08-15T00:00:00Z' },
      ];

      const best = selectBestRepository(repos);
      expect(best.name).toBe('newer-app');
    });

    it('tie-breaks alphabetically by repository name when dates and fork statuses are identical', () => {
      const repos = [
        { name: 'zeta-project', url: 'https://github.com/u/zeta', isFork: false, updatedAt: '2026-01-01T00:00:00Z' },
        { name: 'alpha-project', url: 'https://github.com/u/alpha', isFork: false, updatedAt: '2026-01-01T00:00:00Z' },
      ];

      const best = selectBestRepository(repos);
      expect(best.name).toBe('alpha-project');
    });

    it('handles empty or non-array inputs safely', () => {
      expect(selectBestRepository([])).toBeNull();
      expect(selectBestRepository(null)).toBeNull();
      expect(selectBestRepository(undefined)).toBeNull();
    });
  });

  describe('2. Evidence Case A: Claimed Only (No Project, No GitHub)', () => {
    it('remains matched as claimed skill without demonstrated credit', () => {
      const profile = {
        skills: [{ name: 'react', level: 'advanced' }],
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [],
        },
      };

      const result = calculateOpportunityMatch(profile, { skills: ['react'] });
      const reactMatch = result.matchedSkills.find((s) => s.canonicalKey === 'react');

      expect(reactMatch.isClaimed).toBe(true);
      expect(reactMatch.isDemonstrated).toBe(false);
      expect(reactMatch.hasGitHubEvidence).toBe(false);
      expect(result.signals.demonstratedEvidence.score).toBe(0);
      expect(result.evidence.some((e) => e.type === 'claimed')).toBe(true);
      expect(result.evidence.some((e) => e.type === 'github_verified')).toBe(false);
    });
  });

  describe('3. Evidence Case B: Claimed & Project Evidenced (Unchanged Baseline)', () => {
    it('awards demonstrated credit via portfolio project and preserves existing behavior', () => {
      const profile = {
        skills: [{ name: 'react', level: 'intermediate' }],
        projects: [{ title: 'Dashboard', technologies: ['React'] }],
      };

      const result = calculateOpportunityMatch(profile, { skills: ['react'] });
      const reactMatch = result.matchedSkills.find((s) => s.canonicalKey === 'react');

      expect(reactMatch.isClaimed).toBe(true);
      expect(reactMatch.isDemonstrated).toBe(true);
      expect(reactMatch.hasGitHubEvidence).toBe(false);
      expect(result.signals.demonstratedEvidence.score).toBe(5);
      expect(result.signals.demonstratedEvidence.projectEvidenceCount).toBe(1);
      expect(result.signals.demonstratedEvidence.githubEvidenceCount).toBe(0);
      expect(result.evidence.some((e) => e.type === 'demonstrated_and_claimed')).toBe(true);
    });
  });

  describe('4. Evidence Case C: Claimed & GitHub Verified', () => {
    it('satisfies demonstrated criterion via public GitHub proof with 5 points credit', () => {
      const profile = {
        skills: [{ name: 'react', level: 'advanced' }],
        projects: [],
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
                  name: 'my-react-portfolio',
                  url: 'https://github.com/alice/my-react-portfolio',
                  isFork: false,
                  primaryLanguage: 'JavaScript',
                  updatedAt: '2026-09-01T00:00:00Z',
                },
              ],
            },
          ],
        },
      };

      const result = calculateOpportunityMatch(profile, { skills: ['react'] });
      const reactMatch = result.matchedSkills.find((s) => s.canonicalKey === 'react');

      expect(reactMatch.isClaimed).toBe(true);
      expect(reactMatch.isDemonstrated).toBe(true);
      expect(reactMatch.hasGitHubEvidence).toBe(true);
      expect(reactMatch.githubEvidence.topRepository.name).toBe('my-react-portfolio');

      // Awards 5 demonstrated points
      expect(result.signals.demonstratedEvidence.score).toBe(5);
      expect(result.signals.demonstratedEvidence.githubEvidenceCount).toBe(1);
      expect(result.signals.demonstratedEvidence.projectEvidenceCount).toBe(0);

      // Exposes github_verified evidence
      const ghEvidence = result.evidence.find((e) => e.type === 'github_verified');
      expect(ghEvidence).toBeDefined();
      expect(ghEvidence.skill).toBe('React');
      expect(ghEvidence.repository.name).toBe('my-react-portfolio');
      expect(ghEvidence.description).toContain('my-react-portfolio');

      // Explanation reflects GitHub verification
      expect(result.explanations.positive.some((txt) => txt.includes('GitHub'))).toBe(true);
    });
  });

  describe('5. Evidence Case D: Project Evidenced & GitHub Verified (Duplicate Credit Prevention)', () => {
    it('awards exactly ONE demonstrated credit (+5 pts) and exposes BOTH evidence sources', () => {
      const profile = {
        skills: [{ name: 'react', level: 'expert' }],
        projects: [
          {
            title: 'Storefront',
            technologies: ['React'],
          },
        ],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'react',
              displayName: 'React',
              category: 'frontend',
              repoCount: 2,
              repositories: [
                {
                  name: 'react-design-system',
                  url: 'https://github.com/alice/react-design-system',
                  isFork: false,
                  primaryLanguage: 'TypeScript',
                  updatedAt: '2026-09-10T00:00:00Z',
                },
              ],
            },
          ],
        },
      };

      const result = calculateOpportunityMatch(profile, { skills: ['react'] });
      const reactMatch = result.matchedSkills.find((s) => s.canonicalKey === 'react');

      expect(reactMatch.isClaimed).toBe(true);
      expect(reactMatch.isDemonstrated).toBe(true);
      expect(reactMatch.hasGitHubEvidence).toBe(true);
      expect(reactMatch.projects).toContain('Storefront');

      // STRICT CHECK: exactly 5 demonstrated points, NOT 10!
      expect(result.signals.demonstratedEvidence.score).toBe(5);
      expect(result.signals.demonstratedEvidence.demonstratedCount).toBe(1);
      expect(result.signals.demonstratedEvidence.projectEvidenceCount).toBe(1);
      expect(result.signals.demonstratedEvidence.githubEvidenceCount).toBe(1);

      // Exposes BOTH evidence representations in evidenceList
      const hasProjectEv = result.evidence.some((e) => e.type === 'demonstrated_and_claimed');
      const hasGitHubEv = result.evidence.some((e) => e.type === 'github_verified');
      expect(hasProjectEv).toBe(true);
      expect(hasGitHubEv).toBe(true);

      // Positive explanations mention both portfolio projects and GitHub
      expect(result.explanations.positive.some((txt) => txt.includes('portfolio projects'))).toBe(true);
      expect(result.explanations.positive.some((txt) => txt.includes('GitHub'))).toBe(true);
    });
  });

  describe('6. Evidence Case E: GitHub Verified Only (Not in profile.skills, Not in projects)', () => {
    it('matches skill requirement with demonstrated credit but 0 claimed proficiency bonus', () => {
      const profile = {
        skills: [], // Not claimed
        projects: [], // No projects
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'docker',
              displayName: 'Docker',
              category: 'devops',
              repoCount: 1,
              repositories: [
                {
                  name: 'docker-infra',
                  url: 'https://github.com/alice/docker-infra',
                  isFork: false,
                  primaryLanguage: 'Dockerfile',
                  updatedAt: '2026-08-01T00:00:00Z',
                },
              ],
            },
          ],
        },
      };

      const result = calculateOpportunityMatch(profile, { skills: ['docker'] });
      const dockerMatch = result.matchedSkills.find((s) => s.canonicalKey === 'docker');

      expect(dockerMatch).toBeDefined();
      expect(dockerMatch.isClaimed).toBe(false);
      expect(dockerMatch.isDemonstrated).toBe(true);
      expect(dockerMatch.hasGitHubEvidence).toBe(true);

      // Receives base coverage and demonstrated evidence
      expect(result.signals.demonstratedEvidence.score).toBe(5);
      // Proficiency bonus is 0 because not claimed
      expect(result.signals.skillAlignment.score).toBe(40); // 1/1 * 40 coverage + 0 bonus
      expect(result.skillGaps).toHaveLength(0);

      // Evidence list has github_verified
      const ghEv = result.evidence.find((e) => e.canonicalKey === 'docker');
      expect(ghEv.type).toBe('github_verified');
    });

    it('does not bypass career preferences or location rules', () => {
      const profileWithDocker = {
        skills: [],
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'docker',
              displayName: 'Docker',
              repositories: [{ name: 'docker-repo', isFork: false, updatedAt: '2026-01-01' }],
            },
          ],
        },
        careerPreferences: {
          opportunityTypes: ['internship'],
          preferredWorkModes: ['remote'],
        },
        personal: { location: { city: 'Pune' } },
      };

      // Opportunity is full-time onsite in London (mismatching preferences)
      const opp = {
        type: 'full-time',
        workMode: 'onsite',
        location: { city: 'London', country: 'UK' },
        skills: ['docker'],
      };

      const result = calculateOpportunityMatch(profileWithDocker, opp);
      // Preferences correctly fail despite GitHub proof
      expect(result.signals.preferences.typeMatch).toBe(false);
      expect(result.signals.preferences.workModeMatch).toBe(false);
      expect(result.signals.preferences.locationMatch).toBe(false);
      expect(result.signals.preferences.score).toBe(0);
    });
  });

  describe('7. Multiple Repositories for Same Skill', () => {
    it('deterministically selects top repository and annotates count in evidence', () => {
      const profile = {
        skills: [{ name: 'react', level: 'intermediate' }],
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'react',
              displayName: 'React',
              category: 'frontend',
              repoCount: 3,
              repositories: [
                { name: 'react-starter', url: 'https://github.com/u/starter', isFork: false, updatedAt: '2024-01-01' },
                { name: 'react-flagship', url: 'https://github.com/u/flagship', isFork: false, updatedAt: '2026-09-01' },
                { name: 'react-fork', url: 'https://github.com/u/fork', isFork: true, updatedAt: '2026-10-01' },
              ],
            },
          ],
        },
      };

      const result = calculateOpportunityMatch(profile, { skills: ['react'] });
      const ghEvidence = result.evidence.find((e) => e.type === 'github_verified');

      expect(ghEvidence.repository.name).toBe('react-flagship');
      expect(ghEvidence.repoCount).toBe(3);
      expect(ghEvidence.description).toContain('(+2 others)');
    });
  });

  describe('8. One Repository Proving Multiple Skills', () => {
    it('verifies multiple skills from the same repository independently without collision', () => {
      const sharedRepo = {
        name: 'fullstack-monorepo',
        url: 'https://github.com/u/fullstack-monorepo',
        isFork: false,
        primaryLanguage: 'TypeScript',
        updatedAt: '2026-09-15T00:00:00Z',
      };

      const profile = {
        skills: [{ name: 'react' }, { name: 'node.js' }],
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'react',
              displayName: 'React',
              repoCount: 1,
              repositories: [sharedRepo],
            },
            {
              canonicalKey: 'node.js',
              displayName: 'Node.js',
              repoCount: 1,
              repositories: [sharedRepo],
            },
          ],
        },
      };

      const result = calculateOpportunityMatch(profile, { skills: ['react', 'node.js'] });

      expect(result.matchedSkills).toHaveLength(2);
      expect(result.signals.demonstratedEvidence.score).toBe(10); // 2 * 5 pts
      expect(result.signals.demonstratedEvidence.demonstratedCount).toBe(2);

      const ghEvidenceList = result.evidence.filter((e) => e.type === 'github_verified');
      expect(ghEvidenceList).toHaveLength(2);
      expect(ghEvidenceList.map((e) => e.skill)).toContain('React');
      expect(ghEvidenceList.map((e) => e.skill)).toContain('Node.js');
      expect(ghEvidenceList.every((e) => e.repository.name === 'fullstack-monorepo')).toBe(true);
    });
  });

  describe('9. Duplicate Aliases and Normalization', () => {
    it('resolves aliases cleanly and merges repositories without duplicate skills', () => {
      const profile = {
        skills: [],
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'react',
              displayName: 'React',
              repoCount: 1,
              repositories: [{ name: 'r1', url: 'https://github.com/u/r1', isFork: false, updatedAt: '2026-01-01' }],
            },
            {
              canonicalKey: 'reactjs', // alias of react
              displayName: 'React.js',
              repoCount: 1,
              repositories: [{ name: 'r2', url: 'https://github.com/u/r2', isFork: false, updatedAt: '2026-06-01' }],
            },
          ],
        },
      };

      const candidateProfile = getCandidateSkillProfile(profile);
      expect(candidateProfile.has('react')).toBe(true);
      expect(candidateProfile.has('reactjs')).toBe(false);

      const reactCandidate = candidateProfile.get('react');
      expect(reactCandidate.githubEvidence.repositories).toHaveLength(2);

      const match = calculateOpportunityMatch(profile, { skills: ['react'] });
      expect(match.matchedSkills).toHaveLength(1);
      expect(match.signals.demonstratedEvidence.score).toBe(5);
    });
  });

  describe('10. Fork-Only Evidence', () => {
    it('accepts fork repository as valid demonstrated evidence when no non-fork exists', () => {
      const profile = {
        skills: [{ name: 'go' }],
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'go',
              displayName: 'Go',
              repoCount: 1,
              repositories: [
                { name: 'go-microservice', url: 'https://github.com/u/go', isFork: true, updatedAt: '2026-07-01' },
              ],
            },
          ],
        },
      };

      const result = calculateOpportunityMatch(profile, { skills: ['go'] });
      const goMatch = result.matchedSkills.find((s) => s.canonicalKey === 'go');

      expect(goMatch.isDemonstrated).toBe(true);
      expect(goMatch.hasGitHubEvidence).toBe(true);
      expect(goMatch.githubEvidence.topRepository.isFork).toBe(true);
      expect(result.signals.demonstratedEvidence.score).toBe(5);
    });
  });

  describe('11. Disconnected and Missing GitHub Evidence', () => {
    it('produces identical score when githubEvidence is not_connected vs absent', () => {
      const baseProfile = {
        skills: [{ name: 'react', level: 'intermediate' }],
        projects: [{ title: 'P1', technologies: ['React'] }],
      };

      const disconnectedProfile = {
        ...baseProfile,
        githubEvidence: {
          syncStatus: 'not_connected',
          username: null,
          detectedSkills: [{ canonicalKey: 'docker', displayName: 'Docker', repositories: [{ name: 'd1' }] }],
        },
      };

      const opp = { skills: ['react', 'docker'] };

      const resBase = calculateOpportunityMatch(baseProfile, opp);
      const resDisconnected = calculateOpportunityMatch(disconnectedProfile, opp);

      expect(resDisconnected.score).toBe(resBase.score);
      expect(resDisconnected.matchedSkills.length).toBe(resBase.matchedSkills.length);
      expect(resDisconnected.skillGaps.map((g) => g.canonicalKey)).toContain('docker');
    });

    it('preserves score when githubEvidence is null or undefined', () => {
      const profileNull = { skills: [{ name: 'react' }], githubEvidence: null };
      const opp = { skills: ['react'] };

      const res = calculateOpportunityMatch(profileNull, opp);
      expect(res.score).toBeGreaterThan(0);
      expect(res.matchedSkills[0].hasGitHubEvidence).toBe(false);
    });
  });

  describe('12. Score Boundedness and Max Caps (0–100)', () => {
    it('strictly caps demonstrated evidence at max 20 points even with 10 verified skills', () => {
      const manySkills = [
        'react', 'node.js', 'typescript', 'docker', 'mongodb',
        'postgresql', 'redis', 'python', 'aws', 'graphql',
      ];

      const profile = {
        skills: manySkills.map((s) => ({ name: s, level: 'expert' })),
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: manySkills.map((s) => ({
            canonicalKey: s,
            displayName: s,
            repoCount: 1,
            repositories: [{ name: `${s}-repo`, isFork: false, updatedAt: '2026-09-01' }],
          })),
        },
      };

      const opp = { skills: manySkills, workMode: 'remote' };
      const result = calculateOpportunityMatch(profile, opp);

      expect(result.signals.demonstratedEvidence.demonstratedCount).toBe(10);
      // Strictly capped at 20!
      expect(result.signals.demonstratedEvidence.score).toBe(20);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.score)).toBe(true);
    });
  });
});
