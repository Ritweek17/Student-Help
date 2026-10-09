import { describe, it, expect } from 'vitest';
import {
  buildPreparationPlan,
  STALE_REPO_DAYS_THRESHOLD,
} from '../../src/services/intelligence/preparation-plan.service.js';

describe('Preparation Plan Service — GitHub Proof Actions (Phase 11E Batch 4)', () => {
  const baseOpportunity = {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    title: 'Full Stack Engineer Intern',
    organization: 'FinTech Hub',
    type: 'internship',
    workMode: 'remote',
    deadline: new Date('2026-10-20T12:00:00Z'),
    skills: ['react', 'node.js', 'docker'],
  };

  const sampleProfileWithGitHub = {
    userId: '65f1a2b3c4d5e6f7a8b9c0d2',
    skills: [
      { name: 'react', level: 'advanced' },
      { name: 'node.js', level: 'intermediate' },
    ],
    projects: [
      {
        title: 'FinTech Dashboard',
        technologies: ['React'],
      },
    ],
    githubEvidence: {
      syncStatus: 'synced',
      detectedSkills: [
        {
          canonicalKey: 'react',
          displayName: 'React',
          repoCount: 1,
          repositories: [
            {
              name: 'react-trading-ui',
              url: 'https://github.com/alice/react-trading-ui',
              isFork: false,
              primaryLanguage: 'TypeScript',
              updatedAt: '2026-09-15T00:00:00Z', // Recent (within 180 days of 2026-10-01)
            },
          ],
        },
        {
          canonicalKey: 'node.js',
          displayName: 'Node.js',
          repoCount: 1,
          repositories: [
            {
              name: 'legacy-api-server',
              url: 'https://github.com/alice/legacy-api-server',
              isFork: false,
              primaryLanguage: 'JavaScript',
              updatedAt: '2025-01-01T00:00:00Z', // Stale (> 180 days before 2026-10-01)
            },
          ],
        },
      ],
    },
  };

  const referenceDate = new Date('2026-10-01T12:00:00Z');

  describe('1. GitHub Repository Showcase Task Generation', () => {
    it('generates deterministic repository showcase task for matched skill with GitHub proof', () => {
      const plan = buildPreparationPlan(sampleProfileWithGitHub, baseOpportunity, {
        referenceDate,
      });

      const showcaseTasks = plan.tasks.filter((t) => t.type === 'github_showcase');
      expect(showcaseTasks.length).toBeGreaterThanOrEqual(1);

      const reactShowcase = showcaseTasks.find((t) => t.skillKey === 'react');
      expect(reactShowcase).toBeDefined();
      expect(reactShowcase.taskKey).toBe('github:showcase:react:react-trading-ui');
      expect(reactShowcase.title).toContain('react-trading-ui');
      expect(reactShowcase.title).toContain('React demo');
      expect(reactShowcase.description).toContain('FinTech Hub');
      expect(reactShowcase.category).toBe('Project');
      expect(reactShowcase.priority).toBe('Medium');
      expect(reactShowcase.repository.name).toBe('react-trading-ui');
    });
  });

  describe('2. Stale Repository Recommendation (github:refresh)', () => {
    it('generates refresh task when repository updatedAt exceeds staleness threshold (180 days)', () => {
      const plan = buildPreparationPlan(sampleProfileWithGitHub, baseOpportunity, {
        referenceDate,
      });

      const refreshTasks = plan.tasks.filter((t) => t.type === 'github_refresh');
      expect(refreshTasks.length).toBe(1);

      const nodeRefresh = refreshTasks[0];
      expect(nodeRefresh.skillKey === 'node.js' || nodeRefresh.skillKey === 'nodejs').toBe(true);
      expect(nodeRefresh.taskKey).toMatch(/^github:refresh:(node\.js|nodejs)$/);
      expect(nodeRefresh.title).toContain('legacy-api-server');
      expect(nodeRefresh.description).toContain('dependencies');
      expect(nodeRefresh.priority).toBe('Low');
      expect(nodeRefresh.category).toBe('Project');
    });

    it('does not generate refresh task for recently updated repositories', () => {
      const plan = buildPreparationPlan(sampleProfileWithGitHub, baseOpportunity, {
        referenceDate,
      });

      // react-trading-ui is recent (Sept 2026 vs Oct 2026 ref), so no refresh task for react
      const reactRefresh = plan.tasks.find((t) => t.taskKey === 'github:refresh:react');
      expect(reactRefresh).toBeUndefined();
    });
  });

  describe('3. Backward Compatibility: Profile Without GitHub Evidence', () => {
    it('generates standard plan without any github_showcase or github_refresh tasks', () => {
      const profileNoGitHub = {
        skills: [{ name: 'react', level: 'intermediate' }],
        projects: [{ title: 'P1', technologies: ['React'] }],
      };

      const plan = buildPreparationPlan(profileNoGitHub, baseOpportunity, {
        referenceDate,
      });

      expect(plan.tasks.some((t) => t.type.startsWith('github_'))).toBe(false);
      expect(plan.tasks.map((t) => t.taskKey)).toContain('project:review');
      expect(plan.tasks.map((t) => t.taskKey)).toContain('application:prepare');
    });

    it('disconnected GitHub evidence produces the exact same plan as absence of GitHub', () => {
      const profileNoGitHub = {
        skills: [{ name: 'react', level: 'intermediate' }],
        projects: [{ title: 'P1', technologies: ['React'] }],
      };

      const profileDisconnected = {
        ...profileNoGitHub,
        githubEvidence: {
          syncStatus: 'not_connected',
          detectedSkills: [{ canonicalKey: 'react', repositories: [{ name: 'r1' }] }],
        },
      };

      const planA = buildPreparationPlan(profileNoGitHub, baseOpportunity, { referenceDate });
      const planB = buildPreparationPlan(profileDisconnected, baseOpportunity, { referenceDate });

      expect(planA.tasks.map((t) => t.taskKey)).toEqual(planB.tasks.map((t) => t.taskKey));
      expect(planB.tasks.some((t) => t.type.startsWith('github_'))).toBe(false);
    });
  });

  describe('4. Multiple Repositories Deterministic Selection', () => {
    it('picks the single top repository for showcase when multiple exist', () => {
      const profileMultiRepo = {
        skills: [{ name: 'docker' }],
        projects: [],
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [
            {
              canonicalKey: 'docker',
              displayName: 'Docker',
              repoCount: 3,
              repositories: [
                { name: 'docker-fork', isFork: true, updatedAt: '2026-09-30' },
                { name: 'docker-compose-prod', isFork: false, updatedAt: '2026-09-20' },
                { name: 'docker-old-setup', isFork: false, updatedAt: '2025-01-01' },
              ],
            },
          ],
        },
      };

      const opp = {
        title: 'DevOps Intern',
        organization: 'CloudCorp',
        skills: ['docker'],
      };

      const plan = buildPreparationPlan(profileMultiRepo, opp, { referenceDate });
      const dockerShowcase = plan.tasks.find((t) => t.taskKey.startsWith('github:showcase:docker'));

      expect(dockerShowcase).toBeDefined();
      expect(dockerShowcase.taskKey).toBe('github:showcase:docker:docker-compose-prod');
      expect(dockerShowcase.repository.name).toBe('docker-compose-prod');
    });
  });

  describe('5. Task Deduplication and Idempotency', () => {
    it('detects existing GitHub showcase and refresh todos and preserves completion status', () => {
      const existingTodos = [
        {
          _id: '65f1a2b3c4d5e6f7a8b9c999',
          title: 'Prepare React demo',
          description: `Highlight architecture. [CareerOS Prep: ${baseOpportunity._id}:github:showcase:react:react-trading-ui]`,
          completed: true,
        },
      ];

      const plan = buildPreparationPlan(sampleProfileWithGitHub, baseOpportunity, {
        existingTodos,
        referenceDate,
      });

      const reactShowcase = plan.tasks.find(
        (t) => t.taskKey === 'github:showcase:react:react-trading-ui'
      );
      expect(reactShowcase.isExistingTodo).toBe(true);
      expect(String(reactShowcase.existingTodoId)).toBe('65f1a2b3c4d5e6f7a8b9c999');
      expect(reactShowcase.isCompleted).toBe(true);
    });
  });

  describe('6. Real Skill Gaps Still Produce Learning Actions', () => {
    it('generates standard skill gap learning task for missing skills (Docker) alongside GitHub tasks', () => {
      const plan = buildPreparationPlan(sampleProfileWithGitHub, baseOpportunity, {
        referenceDate,
      });

      const dockerGap = plan.tasks.find((t) => t.taskKey === 'gap:docker');
      expect(dockerGap).toBeDefined();
      expect(dockerGap.type).toBe('skill_gap');
      expect(dockerGap.category).toBe('Learning');
    });
  });
});
