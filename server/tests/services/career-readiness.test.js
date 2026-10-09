import { describe, it, expect } from 'vitest';
import {
  calculateCareerReadiness,
  computeCareerReadiness,
  buildTargetCohortIds,
  aggregateTargetSkills,
  evaluateSkillCoverage,
  evaluateEvidenceStrength,
  evaluatePreparationExecution,
  evaluateLearningVelocity,
  evaluateApplicationPipeline,
  determineReadinessBand,
  deriveReadinessActions,
  getGapPriority,
  MAX_TARGET_OPPORTUNITIES,
} from '../../src/services/intelligence/career-readiness.service.js';

describe('CareerOS Career Profile Intelligence Service (Phase 11F — Batch 2)', () => {
  const FIXED_REF_DATE = new Date('2026-10-07T12:00:00Z');

  // =========================================================================
  // A. EMPTY / COLD START
  // =========================================================================
  describe('A. Empty & Cold-Start Scenarios', () => {
    it('returns Early Stage with personalized guidance when student has zero saved/applied opportunities', async () => {
      const result = await calculateCareerReadiness('user-empty-1', {
        profile: {
          skills: [],
          projects: [],
          careerPreferences: { opportunityTypes: ['internship'] },
          careerGoal: { title: 'Full Stack Engineer' },
        },
        savedOpportunities: [],
        applications: [],
        fallbackOpportunities: [],
        referenceDate: FIXED_REF_DATE,
      });

      expect(result.readinessBand.band).toBe('Early Stage');
      expect(result.targetProfile.totalOpportunities).toBe(0);
      expect(result.targetProfile.targetRoles).toContain('Full Stack Engineer');
      expect(result.targetProfile.guidance).toBe('Save 3 target opportunities to personalize your career readiness.');
      expect(result.dimensions.skillCoverage.totalCount).toBe(0);
      expect(result.dimensions.skillCoverage.percentage).toBe(0);
      expect(result.dimensions.evidenceStrength.verificationRate).toBe(0);
      expect(result.dimensions.preparationExecution.status).toBe('no_tasks');
      expect(result.dimensions.learningVelocity.status).toBe('none');
      expect(result.dimensions.applicationPipeline.status).toBe('dormant');
      expect(result.actions.length).toBeGreaterThanOrEqual(1);
    });

    it('handles student with no career intent, no preferences, and no opportunities', () => {
      const result = computeCareerReadiness({
        profile: {
          skills: [],
          projects: [],
          careerPreferences: {},
          careerGoal: {},
        },
        opportunities: [],
      }, { referenceDate: FIXED_REF_DATE, isColdStart: true });

      expect(result.readinessBand.band).toBe('Early Stage');
      expect(result.targetProfile.targetRoles.length).toBe(0);
      expect(result.targetProfile.guidance).toContain('Save 3 target opportunities');
      expect(result.skillGaps).toEqual([]);
      expect(result.evidence).toEqual([]);
    });
  });

  // =========================================================================
  // B. TARGET OPPORTUNITY COHORT
  // =========================================================================
  describe('B. Target Opportunity Cohort Construction', () => {
    it('combines saved opportunities and active applications while deduplicating identical opportunity IDs', () => {
      const saved = [
        { opportunityId: 'opp-1' },
        { opportunityId: 'opp-2' },
        { opportunityId: 'opp-3' },
      ];
      const apps = [
        { opportunityId: 'opp-2', status: 'applied' }, // Duplicate with saved
        { opportunityId: 'opp-4', status: 'interview' },
        { opportunityId: 'opp-5', status: 'withdrawn' }, // Should be ignored
      ];

      const cohort = buildTargetCohortIds({
        savedOpportunities: saved,
        applications: apps,
      });

      expect(cohort.cohortOpportunityIds).toEqual(['opp-1', 'opp-2', 'opp-3', 'opp-4']);
      expect(cohort.sources.savedCount).toBe(3);
      expect(cohort.sources.appliedCount).toBe(1); // opp-4 added, opp-2 was deduped
      expect(cohort.sources.totalCount).toBe(4);
    });

    it('strictly caps cohort at MAX_TARGET_OPPORTUNITIES (15)', () => {
      const manySaved = Array.from({ length: 25 }, (_, i) => ({ opportunityId: `opp-${i + 1}` }));
      const cohort = buildTargetCohortIds({
        savedOpportunities: manySaved,
      });

      expect(cohort.cohortOpportunityIds.length).toBe(MAX_TARGET_OPPORTUNITIES);
      expect(cohort.cohortOpportunityIds.length).toBe(15);
      expect(cohort.cohortOpportunityIds[0]).toBe('opp-1');
      expect(cohort.cohortOpportunityIds[14]).toBe('opp-15');
    });

    it('falls back to published opportunities only when saved/applied is under capacity', () => {
      const saved = [{ opportunityId: 'opp-saved-1' }];
      const fallback = [
        { _id: 'opp-fall-1' },
        { _id: 'opp-fall-2' },
      ];

      const cohort = buildTargetCohortIds({
        savedOpportunities: saved,
        fallbackOpportunities: fallback,
        maxOpportunities: 5,
      });

      expect(cohort.cohortOpportunityIds).toEqual(['opp-saved-1', 'opp-fall-1', 'opp-fall-2']);
      expect(cohort.sources.savedCount).toBe(1);
      expect(cohort.sources.fallbackCount).toBe(2);
    });
  });

  // =========================================================================
  // C. SKILL AGGREGATION & IMPACT PRIORITIZATION
  // =========================================================================
  describe('C. Target Skill Aggregation & Impact Scoring', () => {
    const oppA = {
      _id: 'opp-a',
      title: 'Frontend Role',
      skills: ['react', 'TypeScript', 'CSS'],
    };
    const oppB = {
      _id: 'opp-b',
      title: 'Full Stack Role',
      skills: ['react.js', 'ts', 'node.js'], // Aliases for react & typescript
    };
    const oppC = {
      _id: 'opp-c',
      title: 'Web Dev Role',
      skills: ['React', 'JavaScript', 'HTML'],
    };
    const oppD = {
      _id: 'opp-d',
      title: 'Senior Frontend',
      skills: ['React', 'TypeScript', 'Docker'],
    };

    it('aggregates repeated skills across opportunities, merges aliases, and calculates impact percentage', () => {
      const aggregated = aggregateTargetSkills([oppA, oppB, oppC, oppD]);

      // React appears in all 4 (oppA, oppB, oppC, oppD) -> 100%
      const reactSkill = aggregated.find((s) => s.canonicalKey === 'react');
      expect(reactSkill).toBeDefined();
      expect(reactSkill.requiredByOpportunityCount).toBe(4);
      expect(reactSkill.totalOpportunities).toBe(4);
      expect(reactSkill.impactPercent).toBe(100);
      expect(reactSkill.priority).toBe('P0');
      expect(reactSkill.affectedOpportunityIds).toEqual(['opp-a', 'opp-b', 'opp-c', 'opp-d']);

      // TypeScript appears in 3/4 (oppA, oppB via 'ts', oppD) -> 75%
      const tsSkill = aggregated.find((s) => s.canonicalKey === 'typescript');
      expect(tsSkill).toBeDefined();
      expect(tsSkill.requiredByOpportunityCount).toBe(3);
      expect(tsSkill.impactPercent).toBe(75);
      expect(tsSkill.priority).toBe('P0');

      // Docker appears in 1/4 -> 25% -> P2
      const dockerSkill = aggregated.find((s) => s.canonicalKey === 'docker');
      expect(dockerSkill).toBeDefined();
      expect(dockerSkill.requiredByOpportunityCount).toBe(1);
      expect(dockerSkill.impactPercent).toBe(25);
      expect(dockerSkill.priority).toBe('P2');
    });

    it('sorts aggregated skills by impact descending, count descending, and canonicalKey alphabetically', () => {
      const aggregated = aggregateTargetSkills([oppA, oppB, oppC, oppD]);

      for (let i = 0; i < aggregated.length - 1; i++) {
        const cur = aggregated[i];
        const next = aggregated[i + 1];
        if (cur.impactPercent === next.impactPercent) {
          if (cur.requiredByOpportunityCount === next.requiredByOpportunityCount) {
            expect(cur.canonicalKey.localeCompare(next.canonicalKey)).toBeLessThanOrEqual(0);
          } else {
            expect(cur.requiredByOpportunityCount).toBeGreaterThanOrEqual(next.requiredByOpportunityCount);
          }
        } else {
          expect(cur.impactPercent).toBeGreaterThanOrEqual(next.impactPercent);
        }
      }
    });

    it('correctly maps impact boundaries to P0, P1, P2, P3', () => {
      expect(getGapPriority(100)).toBe('P0');
      expect(getGapPriority(75)).toBe('P0');
      expect(getGapPriority(74)).toBe('P1');
      expect(getGapPriority(50)).toBe('P1');
      expect(getGapPriority(49)).toBe('P2');
      expect(getGapPriority(25)).toBe('P2');
      expect(getGapPriority(24)).toBe('P3');
      expect(getGapPriority(0)).toBe('P3');
    });
  });

  // =========================================================================
  // D. SKILL COVERAGE DIMENSION
  // =========================================================================
  describe('D. Skill Coverage Dimension', () => {
    it('evaluates covered vs uncovered skills across claimed, project, and GitHub evidence', () => {
      const targetSkills = [
        { canonicalKey: 'react', displayName: 'React' },
        { canonicalKey: 'typescript', displayName: 'TypeScript' },
        { canonicalKey: 'docker', displayName: 'Docker' },
        { canonicalKey: 'aws', displayName: 'AWS' },
      ];

      // Candidate has React (claimed), TypeScript (project), Docker (github)
      const candidateMap = new Map([
        ['react', { canonicalKey: 'react', isClaimed: true }],
        ['typescript', { canonicalKey: 'typescript', projects: [{ title: 'App' }] }],
        ['docker', { canonicalKey: 'docker', githubEvidence: { repositories: [{ name: 'infra' }] } }],
      ]);

      const coverage = evaluateSkillCoverage(targetSkills, candidateMap);

      expect(coverage.totalCount).toBe(4);
      expect(coverage.coveredCount).toBe(3);
      expect(coverage.percentage).toBe(75);
      expect(coverage.status).toBe('good');
      expect(coverage.coveredSkills.map((s) => s.canonicalKey)).toEqual(['react', 'typescript', 'docker']);
      expect(coverage.uncoveredSkills.map((s) => s.canonicalKey)).toEqual(['aws']);
    });
  });

  // =========================================================================
  // E. EVIDENCE HIERARCHY & STRENGTH
  // =========================================================================
  describe('E. Evidence Strength Dimension', () => {
    it('classifies skills into highest verified tier without double counting', () => {
      const coveredSkills = [
        { canonicalKey: 'react', displayName: 'React', category: 'frontend' },
        { canonicalKey: 'node.js', displayName: 'Node.js', category: 'backend' },
        { canonicalKey: 'python', displayName: 'Python', category: 'languages' },
        { canonicalKey: 'sql', displayName: 'SQL', category: 'database' },
      ];

      const candidateMap = new Map([
        // React has both Project and GitHub -> should resolve to verified
        [
          'react',
          {
            canonicalKey: 'react',
            isClaimed: true,
            projects: [{ title: 'Store' }],
            githubEvidence: {
              repositories: [{ name: 'react-store', url: 'https://github.com/a/react-store', isFork: false }],
            },
          },
        ],
        // Node has Project evidence only -> demonstrated
        [
          'node.js',
          {
            canonicalKey: 'node.js',
            isClaimed: true,
            projects: [{ title: 'API Gateway', description: 'Express backend' }],
            githubEvidence: null,
          },
        ],
        // Python is in learning progress only -> practicing
        [
          'python',
          {
            canonicalKey: 'python',
            isClaimed: true,
            projects: [],
            githubEvidence: null,
          },
        ],
        // SQL is claimed on profile only -> claimed
        [
          'sql',
          {
            canonicalKey: 'sql',
            isClaimed: true,
            proficiency: 'intermediate',
            projects: [],
            githubEvidence: null,
          },
        ],
      ]);

      const learningProgress = [
        {
          trackId: 'track-py',
          itemId: 'item-py',
          status: 'Learning',
        },
      ];
      const tracks = [{ _id: 'track-py', title: 'Python Fundamentals', category: 'languages' }];
      const items = [{ _id: 'item-py', title: 'Python Basics' }];

      const strength = evaluateEvidenceStrength(coveredSkills, candidateMap, learningProgress, tracks, items);

      expect(strength.verifiedCount).toBe(1);
      expect(strength.demonstratedCount).toBe(1);
      expect(strength.practicingCount).toBe(1);
      expect(strength.claimedCount).toBe(1);
      // verificationRate = (1 verified + 1 demonstrated) / 4 = 50%
      expect(strength.verificationRate).toBe(50);
      expect(strength.status).toBe('moderate');

      const reactBreakdown = strength.breakdown.find((b) => b.canonicalKey === 'react');
      expect(reactBreakdown.evidenceStrength).toBe('verified');
      expect(reactBreakdown.topProof.type).toBe('github');
      expect(reactBreakdown.topProof.name).toBe('react-store');

      const nodeBreakdown = strength.breakdown.find((b) => b.canonicalKey === 'node.js');
      expect(nodeBreakdown.evidenceStrength).toBe('demonstrated');
      expect(nodeBreakdown.topProof.type).toBe('project');

      const pyBreakdown = strength.breakdown.find((b) => b.canonicalKey === 'python');
      expect(pyBreakdown.evidenceStrength).toBe('practicing');

      const sqlBreakdown = strength.breakdown.find((b) => b.canonicalKey === 'sql');
      expect(sqlBreakdown.evidenceStrength).toBe('claimed');
    });
  });

  // =========================================================================
  // F. PREPARATION EXECUTION DIMENSION
  // =========================================================================
  describe('F. Preparation Execution Dimension', () => {
    it('inspects only CareerOS Prep todos matching target cohort opportunities', () => {
      const cohortOppIds = ['opp-target-1', 'opp-target-2'];
      const todos = [
        // Belongs to cohort target-1, completed
        {
          title: 'Review React code',
          description: 'Demo preparation for Fintech [CareerOS Prep: opp-target-1:gap:react]',
          completed: true,
        },
        // Belongs to cohort target-1, pending
        {
          title: 'Study TypeScript',
          description: 'Learn TS [CareerOS Prep: opp-target-1:gap:typescript]',
          completed: false,
        },
        // Belongs to cohort target-2, completed
        {
          title: 'Refresh repo',
          description: 'Update docs [CareerOS Prep: opp-target-2:github:refresh:node]',
          completed: true,
        },
        // Belongs to unrelated opportunity -> ignored
        {
          title: 'Unrelated Opp Prep',
          description: 'Prep for unselected job [CareerOS Prep: opp-other-99:gap:go]',
          completed: false,
        },
        // Generic unrelated personal Todo -> ignored
        {
          title: 'Buy groceries',
          description: 'Personal task',
          completed: true,
        },
      ];

      const prep = evaluatePreparationExecution(todos, cohortOppIds);

      expect(prep.total).toBe(3);
      expect(prep.completed).toBe(2);
      expect(prep.pending).toBe(1);
      expect(prep.percentage).toBe(67);
      expect(prep.status).toBe('on_track');
    });

    it('handles zero preparation tasks gracefully', () => {
      const prep = evaluatePreparationExecution([], ['opp-1']);
      expect(prep.status).toBe('no_tasks');
      expect(prep.total).toBe(0);
      expect(prep.completed).toBe(0);
      expect(prep.percentage).toBe(0);
    });
  });

  // =========================================================================
  // G. LEARNING VELOCITY DIMENSION
  // =========================================================================
  describe('G. Learning Velocity Dimension', () => {
    it('evaluates whether curriculum progress aligns with identified skill gaps', () => {
      const uncoveredGaps = [
        { canonicalKey: 'docker', displayName: 'Docker' },
        { canonicalKey: 'kubernetes', displayName: 'Kubernetes' },
      ];

      const tracks = [
        { _id: 'tr-docker', title: 'Containerization with Docker', category: 'devops' },
        { _id: 'tr-history', title: 'History of Computing', category: 'general' },
      ];
      const items = [
        { _id: 'it-docker-1', title: 'Docker Containers 101' },
        { _id: 'it-hist-1', title: '1970s Mainframes' },
      ];

      const learningProgress = [
        // Relevant progress updated 5 days ago
        {
          trackId: 'tr-docker',
          itemId: 'it-docker-1',
          status: 'Learning',
          updatedAt: new Date('2026-10-02T12:00:00Z'),
        },
        // Irrelevant progress
        {
          trackId: 'tr-history',
          itemId: 'it-hist-1',
          status: 'Completed',
          updatedAt: new Date('2026-10-05T12:00:00Z'),
        },
      ];

      const velocity = evaluateLearningVelocity(
        uncoveredGaps,
        learningProgress,
        tracks,
        items,
        FIXED_REF_DATE
      );

      expect(velocity.status).toBe('active');
      expect(velocity.relevantActiveItems).toBe(1);
      expect(velocity.relevantCompletedItems).toBe(0);
      expect(velocity.recentProgress).toBe(true);
      expect(velocity.alignedGapsCount).toBe(1);
    });

    it('identifies unaligned learning when student is learning things unrelated to target gaps', () => {
      const uncoveredGaps = [{ canonicalKey: 'kubernetes', displayName: 'Kubernetes' }];
      const tracks = [{ _id: 'tr-ui', title: 'Figma UI Design', category: 'design' }];
      const items = [{ _id: 'it-ui', title: 'Color Theory' }];
      const progress = [{ trackId: 'tr-ui', itemId: 'it-ui', status: 'Completed', updatedAt: FIXED_REF_DATE }];

      const velocity = evaluateLearningVelocity(uncoveredGaps, progress, tracks, items, FIXED_REF_DATE);
      expect(velocity.status).toBe('unaligned');
      expect(velocity.alignedGapsCount).toBe(0);
    });
  });

  // =========================================================================
  // H. APPLICATION PIPELINE DIMENSION
  // =========================================================================
  describe('H. Application Pipeline Dimension', () => {
    it('tracks active applications, interview stages, and stalled submissions', () => {
      const applications = [
        // Interview stage (super active)
        {
          opportunityId: 'opp-1',
          status: 'interview',
          appliedAt: new Date('2026-09-25T00:00:00Z'),
        },
        // Recent submission (< 14 days ago)
        {
          opportunityId: 'opp-2',
          status: 'applied',
          appliedAt: new Date('2026-10-01T00:00:00Z'),
        },
        // Stalled application (> 14 days ago, no status update, older than 30 days)
        {
          opportunityId: 'opp-3',
          status: 'applied',
          appliedAt: new Date('2026-08-20T00:00:00Z'),
        },
        // Rejected application (not active)
        {
          opportunityId: 'opp-4',
          status: 'rejected',
          appliedAt: new Date('2026-09-01T00:00:00Z'),
        },
      ];

      const pipeline = evaluateApplicationPipeline(applications, FIXED_REF_DATE);

      expect(pipeline.totalTracked).toBe(4);
      expect(pipeline.activeApplications).toBe(3); // interview, applied, applied
      expect(pipeline.interviewCount).toBe(1);
      expect(pipeline.stalledApplications).toBe(1);
      expect(pipeline.recentApplications).toBe(2);
      expect(pipeline.status).toBe('active_interviews');
    });

    it('reports dormant status when student has zero applications', () => {
      const pipeline = evaluateApplicationPipeline([], FIXED_REF_DATE);
      expect(pipeline.status).toBe('dormant');
      expect(pipeline.activeApplications).toBe(0);
    });
  });

  // =========================================================================
  // I. READINESS BANDS
  // =========================================================================
  describe('I. Readiness Bands & Thresholds', () => {
    it('evaluates to Target Ready when skill coverage is >= 75% and verification rate >= 50%', () => {
      const dimensions = {
        skillCoverage: { percentage: 80, coveredCount: 8, totalCount: 10 },
        evidenceStrength: { verificationRate: 60, verifiedCount: 3, demonstratedCount: 2 },
        preparationExecution: { percentage: 80, status: 'on_track' },
        learningVelocity: { relevantActiveItems: 0 },
        applicationPipeline: { activeApplications: 2 },
      };

      const band = determineReadinessBand(dimensions);
      expect(band.band).toBe('Target Ready');
      expect(band.summary).toContain('strong skill coverage and verified project evidence');
      expect(band.primaryDrivers.length).toBeGreaterThanOrEqual(2);
    });

    it('evaluates to Advancing when coverage is >= 50% with developing proof or prep underway', () => {
      const dimensions = {
        skillCoverage: { percentage: 55, coveredCount: 5, totalCount: 9 },
        evidenceStrength: { verificationRate: 40, verifiedCount: 2, demonstratedCount: 0 },
        preparationExecution: { percentage: 50, status: 'in_progress' },
        learningVelocity: { relevantActiveItems: 1 },
        applicationPipeline: { activeApplications: 0 },
      };

      const band = determineReadinessBand(dimensions);
      expect(band.band).toBe('Advancing');
      expect(band.summary).toContain('Solid foundation for target roles');
    });

    it('evaluates to Developing when coverage is moderate (< 50%) but targets are clear', () => {
      const dimensions = {
        skillCoverage: { percentage: 33, coveredCount: 3, totalCount: 9, uncoveredSkills: [{ canonicalKey: 'ts' }] },
        evidenceStrength: { verificationRate: 0 },
        preparationExecution: { percentage: 0, status: 'no_tasks' },
        learningVelocity: { relevantActiveItems: 0 },
        applicationPipeline: { activeApplications: 0 },
      };

      const band = determineReadinessBand(dimensions);
      expect(band.band).toBe('Developing');
      expect(band.summary).toContain('Key skill requirements identified');
    });

    it('evaluates to Early Stage when coverage is low (< 25%)', () => {
      const dimensions = {
        skillCoverage: { percentage: 10, coveredCount: 1, totalCount: 10 },
        evidenceStrength: { verificationRate: 0 },
        preparationExecution: { percentage: 0 },
        learningVelocity: { relevantActiveItems: 0 },
        applicationPipeline: { activeApplications: 0 },
      };

      const band = determineReadinessBand(dimensions);
      expect(band.band).toBe('Early Stage');
      expect(band.summary).toContain('Define your career targets');
    });
  });

  // =========================================================================
  // J. READINESS ACTION GENERATION
  // =========================================================================
  describe('J. Action Generation & Idempotency', () => {
    it('generates high-impact gap actions and evidence-strengthening actions with deterministic keys', () => {
      const skillCoverage = {
        percentage: 60,
        uncoveredSkills: [
          { canonicalKey: 'typescript', displayName: 'TypeScript', priority: 'P0', impactPercent: 80, requiredByOpportunityCount: 4 },
        ],
      };
      const evidenceStrength = {
        breakdown: [
          { canonicalKey: 'react', displayName: 'React', evidenceStrength: 'claimed' },
        ],
      };
      const preparationExecution = { pending: 2 };
      const applicationPipeline = { stalledApplications: 1, activeApplications: 1 };
      const githubEvidence = {
        detectedSkills: [
          {
            canonicalKey: 'python',
            displayName: 'Python',
            repositories: [{ name: 'old-django-app', updatedAt: '2025-01-01T00:00:00Z' }], // > 180 days old
          },
        ],
      };

      const actions = deriveReadinessActions({
        skillCoverage,
        evidenceStrength,
        preparationExecution,
        applicationPipeline,
        githubEvidence,
        referenceDate: FIXED_REF_DATE,
      });

      expect(actions.length).toBeLessThanOrEqual(5);

      // Gap action (High priority P0)
      const gapAction = actions.find((a) => a.actionKey === 'action:gap:typescript');
      expect(gapAction).toBeDefined();
      expect(gapAction.priority).toBe('High');
      expect(gapAction.title).toContain('Learn TypeScript (P0 Priority)');

      // Evidence action
      const evAction = actions.find((a) => a.actionKey === 'action:evidence:react');
      expect(evAction).toBeDefined();
      expect(evAction.title).toContain('Add project proof for React');

      // Stale repo action
      const repoAction = actions.find((a) => a.actionKey === 'action:github_refresh:python');
      expect(repoAction).toBeDefined();
      expect(repoAction.title).toContain('Refresh old-django-app repository');

      // Prep task execution action
      const prepAction = actions.find((a) => a.actionKey === 'action:prep_execution');
      expect(prepAction).toBeDefined();
      expect(prepAction.title).toContain('Complete pending preparation tasks (2 pending)');

      // Follow-up action
      const followAction = actions.find((a) => a.actionKey === 'action:application_followup');
      expect(followAction).toBeDefined();
    });

    it('does not duplicate actions and sorts high priority actions first', () => {
      const actions = deriveReadinessActions({
        skillCoverage: {
          percentage: 70,
          uncoveredSkills: [{ canonicalKey: 'docker', displayName: 'Docker', priority: 'P1', impactPercent: 60, requiredByOpportunityCount: 3 }],
        },
        evidenceStrength: { breakdown: [] },
        preparationExecution: { pending: 0 },
        applicationPipeline: { stalledApplications: 0, activeApplications: 0 },
        githubEvidence: null,
        referenceDate: FIXED_REF_DATE,
      });

      // Submit application action triggered because coverage >= 60% and active apps == 0
      const submitAction = actions.find((a) => a.actionKey === 'action:submit_application');
      expect(submitAction).toBeDefined();
      expect(submitAction.priority).toBe('High');
      // High priority must come before Medium
      expect(actions[0].priority).toBe('High');
    });
  });

  // =========================================================================
  // K. INTEGRATION & BOUNDARIES
  // =========================================================================
  describe('K. Complete Deterministic Snapshot & Architectural Boundaries', () => {
    it('produces an end-to-end multi-dimensional snapshot without single 0-100 score', async () => {
      const mockProfile = {
        userId: 'student-full-1',
        skills: [{ name: 'react', level: 'intermediate' }, { name: 'javascript', level: 'advanced' }],
        projects: [
          {
            title: 'E-Commerce App',
            technologies: ['react', 'node.js'],
          },
        ],
        githubEvidence: {
          syncStatus: 'synced',
          username: 'studentdev',
          detectedSkills: [
            {
              canonicalKey: 'react',
              displayName: 'React',
              repoCount: 1,
              repositories: [{ name: 'ecommerce-frontend', url: 'https://github.com/student/ecom' }],
            },
          ],
        },
        careerGoal: { title: 'Junior Web Developer' },
      };

      const mockOpportunities = [
        {
          _id: 'opp-1',
          title: 'Web Developer Internship',
          organization: 'TechLabs',
          type: 'internship',
          skills: ['React', 'TypeScript', 'Node.js'],
        },
        {
          _id: 'opp-2',
          title: 'Frontend Apprentice',
          organization: 'DevStudio',
          type: 'internship',
          skills: ['React', 'JavaScript', 'TypeScript', 'Tailwind CSS'],
        },
      ];

      const mockSaved = [{ opportunityId: 'opp-1' }, { opportunityId: 'opp-2' }];
      const mockApps = [{ opportunityId: 'opp-1', status: 'applied', appliedAt: FIXED_REF_DATE }];

      const snapshot = await calculateCareerReadiness('student-full-1', {
        profile: mockProfile,
        opportunities: mockOpportunities,
        savedOpportunities: mockSaved,
        applications: mockApps,
        todos: [],
        learningProgress: [],
        tracks: [],
        items: [],
        referenceDate: FIXED_REF_DATE,
      });

      // 1. Structure check
      expect(snapshot).toHaveProperty('readinessBand');
      expect(snapshot).toHaveProperty('targetProfile');
      expect(snapshot).toHaveProperty('dimensions');
      expect(snapshot).toHaveProperty('skillGaps');
      expect(snapshot).toHaveProperty('evidence');
      expect(snapshot).toHaveProperty('actions');
      expect(snapshot).toHaveProperty('sourceOpportunities');
      expect(snapshot).toHaveProperty('generatedAt');

      // 2. STRICT CHECK: No single overall 0-100 score
      expect(snapshot).not.toHaveProperty('score');
      expect(snapshot).not.toHaveProperty('overallScore');
      expect(snapshot).not.toHaveProperty('percentageScore');

      // 3. Dimensional integrity
      expect(snapshot.dimensions.skillCoverage.totalCount).toBeGreaterThan(0);
      expect(snapshot.dimensions.evidenceStrength.verifiedCount).toBeGreaterThanOrEqual(1); // React verified
      expect(snapshot.dimensions.applicationPipeline.activeApplications).toBe(1);

      // 4. Traceable source opportunities
      expect(snapshot.sourceOpportunities.length).toBe(2);
      expect(snapshot.sourceOpportunities[0].organization).toBe('TechLabs');
    });
  });
});
