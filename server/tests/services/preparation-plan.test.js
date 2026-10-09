import { describe, it, expect } from 'vitest';
import {
  calculateDeadlineUrgency,
  findMatchingLearningResource,
  buildPreparationPlan,
} from '../../src/services/intelligence/preparation-plan.service.js';

describe('Preparation Plan Service — Deterministic Opportunity-to-Action Engine', () => {
  const sampleOpportunity = {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    title: 'Full Stack Software Engineer Intern',
    organization: 'Acme Corp',
    type: 'internship',
    workMode: 'remote',
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days in future
    skills: ['react', 'node.js', 'typescript', 'docker'],
  };

  const sampleProfile = {
    userId: '65f1a2b3c4d5e6f7a8b9c0d2',
    skills: [
      { name: 'react', level: 'advanced' },
      { name: 'node.js', level: 'intermediate' },
    ],
    projects: [
      {
        title: 'E-commerce App',
        technologies: ['react', 'node.js'],
      },
    ],
  };

  const sampleLearningTracks = [
    {
      _id: '65f1a2b3c4d5e6f7a8b9c101',
      title: 'TypeScript Mastery',
      category: 'Web Development',
      description: 'Master TypeScript from basics to advanced generics.',
      isActive: true,
    },
    {
      _id: '65f1a2b3c4d5e6f7a8b9c102',
      title: 'Docker & Containers for Developers',
      category: 'DevOps',
      description: 'Learn Docker and containerizing backend applications.',
      isActive: true,
    },
  ];

  const sampleLearningItems = [
    {
      _id: '65f1a2b3c4d5e6f7a8b9c201',
      trackId: '65f1a2b3c4d5e6f7a8b9c101',
      title: 'TypeScript Syntax & Type Annotations',
      duration: '45 mins',
      order: 1,
    },
    {
      _id: '65f1a2b3c4d5e6f7a8b9c202',
      trackId: '65f1a2b3c4d5e6f7a8b9c102',
      title: 'Dockerfiles and Multi-stage Builds',
      duration: '60 mins',
      order: 1,
    },
  ];

  const sampleLearningResources = [
    {
      _id: '65f1a2b3c4d5e6f7a8b9c301',
      trackId: '65f1a2b3c4d5e6f7a8b9c101',
      title: 'Official TypeScript Handbook',
      type: 'Documentation',
      url: 'https://www.typescriptlang.org/docs/',
    },
  ];

  describe('1. Deadline Urgency Calculations', () => {
    const baseNow = new Date('2026-10-01T12:00:00Z');

    it('returns flexible/rolling when no deadline provided', () => {
      const res = calculateDeadlineUrgency(null, baseNow);
      expect(res.urgency).toBe('normal');
      expect(res.daysRemaining).toBeNull();
      expect(res.label).toBe('Flexible / Rolling');
    });

    it('identifies expired deadlines', () => {
      const pastDeadline = new Date('2026-09-25T12:00:00Z');
      const res = calculateDeadlineUrgency(pastDeadline, baseNow);
      expect(res.urgency).toBe('expired');
      expect(res.isExpired).toBe(true);
      expect(res.daysRemaining).toBeLessThan(0);
    });

    it('identifies urgent deadlines (<= 7 days)', () => {
      const urgentDeadline = new Date('2026-10-05T12:00:00Z'); // 4 days away
      const res = calculateDeadlineUrgency(urgentDeadline, baseNow);
      expect(res.urgency).toBe('urgent');
      expect(res.daysRemaining).toBe(4);
      expect(res.isExpired).toBe(false);
    });

    it('identifies moderate deadlines (8-14 days)', () => {
      const moderateDeadline = new Date('2026-10-12T12:00:00Z'); // 11 days away
      const res = calculateDeadlineUrgency(moderateDeadline, baseNow);
      expect(res.urgency).toBe('moderate');
      expect(res.daysRemaining).toBe(11);
    });

    it('identifies normal deadlines (> 14 days)', () => {
      const normalDeadline = new Date('2026-10-30T12:00:00Z'); // 29 days away
      const res = calculateDeadlineUrgency(normalDeadline, baseNow);
      expect(res.urgency).toBe('normal');
      expect(res.daysRemaining).toBe(29);
    });
  });

  describe('2. Real Learning Catalog Matching', () => {
    it('matches skill to real learning track, item, and resource when present', () => {
      const skill = { canonicalKey: 'typescript', displayName: 'TypeScript' };
      const matched = findMatchingLearningResource(
        skill,
        sampleLearningTracks,
        sampleLearningItems,
        sampleLearningResources
      );

      expect(matched).not.toBeNull();
      expect(matched.trackTitle).toBe('TypeScript Mastery');
      expect(matched.itemTitle).toBe('TypeScript Syntax & Type Annotations');
      expect(matched.resourceUrl).toBe('https://www.typescriptlang.org/docs/');
    });

    it('returns null when no matching learning track exists in catalog', () => {
      const skill = { canonicalKey: 'solidity', displayName: 'Solidity' };
      const matched = findMatchingLearningResource(
        skill,
        sampleLearningTracks,
        sampleLearningItems,
        sampleLearningResources
      );

      expect(matched).toBeNull();
    });
  });

  describe('3. Deterministic Plan Generation', () => {
    it('produces identical preparation plans for identical inputs', () => {
      const plan1 = buildPreparationPlan(sampleProfile, sampleOpportunity, {
        tracks: sampleLearningTracks,
        items: sampleLearningItems,
        resources: sampleLearningResources,
        referenceDate: new Date('2026-10-01T12:00:00Z'),
      });

      const plan2 = buildPreparationPlan(sampleProfile, sampleOpportunity, {
        tracks: sampleLearningTracks,
        items: sampleLearningItems,
        resources: sampleLearningResources,
        referenceDate: new Date('2026-10-01T12:00:00Z'),
      });

      expect(plan1).toEqual(plan2);
      expect(plan1.tasks.length).toBe(plan2.tasks.length);
      expect(plan1.stats).toEqual(plan2.stats);
    });

    it('generates gap tasks, project review, application prep, and milestone tasks', () => {
      const plan = buildPreparationPlan(sampleProfile, sampleOpportunity, {
        tracks: sampleLearningTracks,
        items: sampleLearningItems,
        resources: sampleLearningResources,
        referenceDate: new Date('2026-10-01T12:00:00Z'),
      });

      const taskKeys = plan.tasks.map((t) => t.taskKey);

      // Gaps: TypeScript and Docker
      expect(taskKeys).toContain('gap:typescript');
      expect(taskKeys).toContain('gap:docker');

      // Candidate has projects demonstrating React/Node: Project review task
      expect(taskKeys).toContain('project:review');

      // Application prep task
      expect(taskKeys).toContain('application:prepare');

      // Future deadline exists: Milestone task
      expect(taskKeys).toContain('milestone:deadline');

      // Linked learning
      const tsTask = plan.tasks.find((t) => t.taskKey === 'gap:typescript');
      expect(tsTask.learningLink).not.toBeNull();
      expect(tsTask.learningLink.trackTitle).toBe('TypeScript Mastery');
    });

    it('handles candidate with 0 skill gaps gracefully', () => {
      const completeProfile = {
        skills: [
          { name: 'react', level: 'expert' },
          { name: 'node.js', level: 'expert' },
          { name: 'typescript', level: 'expert' },
          { name: 'docker', level: 'expert' },
        ],
        projects: [
          { title: 'Project 1', technologies: ['react', 'node.js'] },
        ],
      };

      const plan = buildPreparationPlan(completeProfile, sampleOpportunity, {
        tracks: sampleLearningTracks,
        referenceDate: new Date('2026-10-01T12:00:00Z'),
      });

      expect(plan.stats.gapCount).toBe(0);
      expect(plan.tasks.some((t) => t.type === 'skill_gap')).toBe(false);
      expect(plan.tasks.some((t) => t.type === 'application_prep')).toBe(true);
    });
  });

  describe('4. Existing Todo Cross-Referencing & Completion Status', () => {
    it('detects already existing todos via deterministic prep tag and preserves completion status', () => {
      const existingTodos = [
        {
          _id: '65f1a2b3c4d5e6f7a8b9c401',
          title: 'Study TypeScript',
          description: `Work through curriculum. [CareerOS Prep: ${sampleOpportunity._id}:gap:typescript]`,
          completed: true,
        },
      ];

      const plan = buildPreparationPlan(sampleProfile, sampleOpportunity, {
        tracks: sampleLearningTracks,
        items: sampleLearningItems,
        resources: sampleLearningResources,
        existingTodos,
        referenceDate: new Date('2026-10-01T12:00:00Z'),
      });

      const tsTask = plan.tasks.find((t) => t.taskKey === 'gap:typescript');
      expect(tsTask.isExistingTodo).toBe(true);
      expect(String(tsTask.existingTodoId)).toBe('65f1a2b3c4d5e6f7a8b9c401');
      expect(tsTask.isCompleted).toBe(true);

      const dockerTask = plan.tasks.find((t) => t.taskKey === 'gap:docker');
      expect(dockerTask.isExistingTodo).toBe(false);
      expect(dockerTask.isCompleted).toBe(false);

      expect(plan.stats.createdTasks).toBe(1);
      expect(plan.stats.completedTasks).toBe(1);
    });
  });
});
