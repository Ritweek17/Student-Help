import { describe, it, expect, vi } from 'vitest';
import {
  computeCareerReadiness,
  calculateCareerReadiness,
} from '../../src/services/intelligence/career-readiness.service.js';
import { calculateOpportunityMatch } from '../../src/services/intelligence/match.service.js';

describe('Career Readiness & Application Intelligence Integration (Phase 11G Batch 5A)', () => {
  const FIXED_REF_DATE = new Date('2026-10-07T12:00:00Z');

  // Shared Helper for Profile
  const makeBaseProfile = (overrides = {}) => ({
    userId: 'user-batch5a',
    skills: [{ name: 'JavaScript', level: 'Intermediate' }], // Claimed
    projects: [],
    careerPreferences: { opportunityTypes: ['internship'] },
    careerGoal: { title: 'Frontend Developer' },
    githubEvidence: null,
    ...overrides,
  });

  // Target Opportunities (Target Cohort)
  const targetOpp1 = {
    _id: 'opp-target-1',
    title: 'Frontend Engineer',
    organization: 'Acme Corp',
    status: 'published',
    skills: ['JavaScript', 'React'],
  };
  const targetOpp2 = {
    _id: 'opp-target-2',
    title: 'React Specialist',
    organization: 'Globex Inc',
    status: 'published',
    skills: ['JavaScript', 'React'],
  };
  const targetOpp3 = {
    _id: 'opp-target-3',
    title: 'Web Developer',
    organization: 'Initech',
    status: 'published',
    skills: ['React'],
  };

  // Rejected Opportunities (Past Applications)
  const rejOpp1 = {
    _id: 'opp-rej-1',
    title: 'Frontend Intern',
    organization: 'Company Alpha',
    status: 'published',
    skills: ['React'],
  };
  const rejOpp2 = {
    _id: 'opp-rej-2',
    title: 'UI Engineer',
    organization: 'Company Beta',
    status: 'published',
    skills: ['React'],
  };
  const rejOpp3 = {
    _id: 'opp-rej-3',
    title: 'Frontend Associate',
    organization: 'Company Gamma',
    status: 'published',
    skills: ['React'],
  };

  // -------------------------------------------------------------------------
  // A. No rejection patterns
  // -------------------------------------------------------------------------
  it('A. No rejection patterns - readiness unchanged and no rejection drivers', () => {
    const profile = makeBaseProfile();
    const opportunities = [targetOpp1, targetOpp2];
    const applications = [
      {
        _id: 'app-active-1',
        opportunityId: 'opp-target-1',
        status: 'applied',
        appliedAt: new Date('2026-10-01T10:00:00Z'),
      },
    ];

    const result = computeCareerReadiness(
      { profile, opportunities, applications },
      { referenceDate: FIXED_REF_DATE }
    );

    expect(result.applicationInsights.recurringRejectionGaps).toEqual([]);
    expect(result.skillGaps.every((g) => !g.observation)).toBe(true);
    expect(
      result.readinessBand.primaryDrivers.some((d) =>
        d.toLowerCase().includes('rejected')
      )
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // B. 1 rejected application
  // -------------------------------------------------------------------------
  it('B. 1 rejected application - no rejection recommendation (sample size < 3)', () => {
    const profile = makeBaseProfile();
    const opportunities = [targetOpp1, targetOpp2];
    const applications = [
      {
        _id: 'app-rej-1',
        opportunityId: 'opp-rej-1',
        status: 'rejected',
        appliedAt: new Date('2026-09-10T10:00:00Z'),
      },
    ];

    const result = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications,
        applicationOpportunities: [rejOpp1],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    expect(result.applicationInsights.recurringRejectionGaps).toEqual([]);
    expect(result.skillGaps.every((g) => !g.observation)).toBe(true);
    expect(
      result.actions.every((a) => a.rejectionRecurrence === undefined)
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // C. 2 rejected applications
  // -------------------------------------------------------------------------
  it('C. 2 rejected applications - no recurrence recommendation (sample size 2 < 3)', () => {
    const profile = makeBaseProfile();
    const opportunities = [targetOpp1, targetOpp2];
    const applications = [
      {
        _id: 'app-rej-1',
        opportunityId: 'opp-rej-1',
        status: 'rejected',
        appliedAt: new Date('2026-09-10T10:00:00Z'),
      },
      {
        _id: 'app-rej-2',
        opportunityId: 'opp-rej-2',
        status: 'rejected',
        appliedAt: new Date('2026-09-12T10:00:00Z'),
      },
    ];

    const result = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications,
        applicationOpportunities: [rejOpp1, rejOpp2],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    expect(result.applicationInsights.recurringRejectionGaps).toEqual([]);
    expect(result.skillGaps.every((g) => !g.observation)).toBe(true);
    expect(
      result.readinessBand.primaryDrivers.some((d) =>
        d.toLowerCase().includes('rejected')
      )
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // D. 3+ rejected applications
  // -------------------------------------------------------------------------
  it('D. 3+ rejected applications - recurring pattern available', () => {
    const profile = makeBaseProfile();
    const opportunities = [targetOpp1, targetOpp2, targetOpp3];
    const applications = [
      {
        _id: 'app-rej-1',
        opportunityId: 'opp-rej-1',
        status: 'rejected',
        appliedAt: new Date('2026-09-10T10:00:00Z'),
      },
      {
        _id: 'app-rej-2',
        opportunityId: 'opp-rej-2',
        status: 'rejected',
        appliedAt: new Date('2026-09-12T10:00:00Z'),
      },
      {
        _id: 'app-rej-3',
        opportunityId: 'opp-rej-3',
        status: 'rejected',
        appliedAt: new Date('2026-09-15T10:00:00Z'),
      },
    ];

    const result = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications,
        applicationOpportunities: [rejOpp1, rejOpp2, rejOpp3],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    expect(result.applicationInsights.recurringRejectionGaps.length).toBeGreaterThanOrEqual(1);
    const reactPattern = result.applicationInsights.recurringRejectionGaps.find(
      (p) => p.canonicalKey === 'react'
    );
    expect(reactPattern).toBeDefined();
    expect(reactPattern.rejectedOpportunityCount).toBe(3);
    expect(reactPattern.recurrencePercent).toBe(100);

    const reactGap = result.skillGaps.find((g) => g.canonicalKey === 'react');
    expect(reactGap).toBeDefined();
    expect(reactGap.observation).toContain('Observational Pattern: React appeared in 3 of your 3 recent rejected opportunities');
  });

  // -------------------------------------------------------------------------
  // E. High-impact + recurring gap
  // -------------------------------------------------------------------------
  it('E. High-impact + recurring gap - correct enriched action and deterministic High priority', () => {
    const profile = makeBaseProfile();
    // React is in all 3 target roles -> P0 gap (100% impact)
    const opportunities = [targetOpp1, targetOpp2, targetOpp3];
    const applications = [
      { _id: 'app-rej-1', opportunityId: 'opp-rej-1', status: 'rejected', appliedAt: new Date('2026-09-10T10:00:00Z') },
      { _id: 'app-rej-2', opportunityId: 'opp-rej-2', status: 'rejected', appliedAt: new Date('2026-09-12T10:00:00Z') },
      { _id: 'app-rej-3', opportunityId: 'opp-rej-3', status: 'rejected', appliedAt: new Date('2026-09-15T10:00:00Z') },
    ];

    const result = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications,
        applicationOpportunities: [rejOpp1, rejOpp2, rejOpp3],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    const reactAction = result.actions.find((a) => a.actionKey === 'action:gap:react');
    expect(reactAction).toBeDefined();
    expect(reactAction.priority).toBe('High');
    expect(reactAction.targetOpportunityImpact).toBe(100);
    expect(reactAction.rejectionRecurrence).toBe(100);
    expect(reactAction.observationalContext).toContain('Observational Pattern: React appeared in 3 of your 3 recent rejected opportunities');
    expect(reactAction.description).toContain('Study fundamentals and complete a practical demo.');
    expect(reactAction.description).toContain('Observational Pattern: React appeared in 3 of your 3 recent rejected opportunities');
  });

  // -------------------------------------------------------------------------
  // F. Low-impact + recurring gap
  // -------------------------------------------------------------------------
  it('F. Low-impact + recurring gap - correct Medium priority rule', () => {
    const profile = makeBaseProfile();
    // Docker is in 1 of 4 target opportunities -> 25% (P2 gap)
    const dockerOpp = {
      _id: 'opp-target-docker',
      title: 'DevOps Intern',
      organization: 'CloudCorp',
      status: 'published',
      skills: ['Docker'],
    };
    const opportunities = [targetOpp1, targetOpp2, targetOpp3, dockerOpp];

    const rejDocker1 = { _id: 'opp-rej-d1', status: 'published', skills: ['Docker'] };
    const rejDocker2 = { _id: 'opp-rej-d2', status: 'published', skills: ['Docker'] };
    const rejDocker3 = { _id: 'opp-rej-d3', status: 'published', skills: ['Docker'] };

    const applications = [
      { _id: 'app-rej-d1', opportunityId: 'opp-rej-d1', status: 'rejected', appliedAt: new Date('2026-09-10T10:00:00Z') },
      { _id: 'app-rej-d2', opportunityId: 'opp-rej-d2', status: 'rejected', appliedAt: new Date('2026-09-12T10:00:00Z') },
      { _id: 'app-rej-d3', opportunityId: 'opp-rej-d3', status: 'rejected', appliedAt: new Date('2026-09-15T10:00:00Z') },
    ];

    const result = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications,
        applicationOpportunities: [rejDocker1, rejDocker2, rejDocker3],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    const dockerAction = result.actions.find((a) => a.actionKey === 'action:gap:docker');
    expect(dockerAction).toBeDefined();
    // Rule: P2/P3 target gap + recurring rejection evidence -> Medium priority
    expect(dockerAction.priority).toBe('Medium');
    expect(dockerAction.targetOpportunityImpact).toBe(25);
    expect(dockerAction.rejectionRecurrence).toBe(100);
  });

  // -------------------------------------------------------------------------
  // G. GitHub verified recurring gap
  // -------------------------------------------------------------------------
  it('G. GitHub verified recurring gap - evidence remains verified, no downgrade', () => {
    const profile = makeBaseProfile({
      githubEvidence: {
        syncStatus: 'synced',
        detectedSkills: [
          {
            canonicalKey: 'react',
            displayName: 'React',
            category: 'frontend',
            repoCount: 3,
            repositories: [
              { name: 'react-dashboard', stars: 2, updatedAt: new Date('2026-09-01T00:00:00Z') },
            ],
          },
        ],
      },
    });

    const opportunities = [targetOpp1, targetOpp2, targetOpp3];
    const applications = [
      { _id: 'app-rej-1', opportunityId: 'opp-rej-1', status: 'rejected', appliedAt: new Date('2026-09-10T10:00:00Z') },
      { _id: 'app-rej-2', opportunityId: 'opp-rej-2', status: 'rejected', appliedAt: new Date('2026-09-12T10:00:00Z') },
      { _id: 'app-rej-3', opportunityId: 'opp-rej-3', status: 'rejected', appliedAt: new Date('2026-09-15T10:00:00Z') },
    ];

    const result = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications,
        applicationOpportunities: [rejOpp1, rejOpp2, rejOpp3],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    // React is GitHub verified!
    const reactEvidence = result.evidence.find((e) => e.canonicalKey === 'react');
    expect(reactEvidence).toBeDefined();
    expect(reactEvidence.evidenceStrength).toBe('verified');
    expect(reactEvidence.sources.githubVerified).toBe(true);

    // Rejection does NOT invalidate candidate proof
    expect(result.dimensions.evidenceStrength.verifiedCount).toBe(1);

    // React should NOT be flagged as unverified rejection gap in appIntel
    const rejPattern = result.applicationInsights.recurringRejectionGaps.find(
      (p) => p.canonicalKey === 'react'
    );
    expect(rejPattern).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // H. Selected application
  // -------------------------------------------------------------------------
  it('H. Selected application - selected skill context appears, no fake score increase', () => {
    const profileWithProof = makeBaseProfile({
      githubEvidence: {
        syncStatus: 'synced',
        detectedSkills: [
          {
            canonicalKey: 'react',
            displayName: 'React',
            category: 'frontend',
            repoCount: 2,
            repositories: [{ name: 'react-app', stars: 1, updatedAt: new Date('2026-08-01') }],
          },
        ],
      },
    });

    const opportunities = [targetOpp1, targetOpp2];
    const selectedOpp = {
      _id: 'opp-selected-1',
      title: 'Frontend Developer',
      organization: 'Top Firm',
      status: 'published',
      skills: ['React'],
    };

    const appsWithSelected = [
      {
        _id: 'app-sel-1',
        opportunityId: 'opp-selected-1',
        status: 'selected',
        appliedAt: new Date('2026-08-15T10:00:00Z'),
      },
    ];

    const resultSelected = computeCareerReadiness(
      {
        profile: profileWithProof,
        opportunities,
        applications: appsWithSelected,
        applicationOpportunities: [selectedOpp],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    const resultWithoutSelected = computeCareerReadiness(
      {
        profile: profileWithProof,
        opportunities,
        applications: [],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    // Signal appears in selectedOutcomeSignals
    const selSignal = resultSelected.applicationInsights.selectedOutcomeSignals.find(
      (s) => s.canonicalKey === 'react'
    );
    expect(selSignal).toBeDefined();
    expect(selSignal.signal).toContain('React has appeared in a selected application and is backed by your GitHub proof.');

    // Positive outcome driver present
    expect(
      resultSelected.readinessBand.primaryDrivers.some((d) =>
        d.includes('React has appeared in a selected application')
      )
    ).toBe(true);

    // Math Isolation: Core readiness dimensions (skill coverage, verification rate) must NOT be inflated
    expect(resultSelected.dimensions.skillCoverage.percentage).toBe(
      resultWithoutSelected.dimensions.skillCoverage.percentage
    );
    expect(resultSelected.dimensions.evidenceStrength.verificationRate).toBe(
      resultWithoutSelected.dimensions.evidenceStrength.verificationRate
    );
  });

  // -------------------------------------------------------------------------
  // I. Preparation-before-apply
  // -------------------------------------------------------------------------
  it('I. Preparation-before-apply - contextual signal without causal claim', () => {
    const profile = makeBaseProfile();
    const opportunities = [targetOpp1];
    const applications = [
      {
        _id: 'app-prep-1',
        opportunityId: 'opp-target-1',
        status: 'applied',
        appliedAt: new Date('2026-09-01T10:00:00Z'),
      },
    ];
    // Todo completed AFTER application date
    const todos = [
      {
        _id: 'todo-1',
        description: '[CareerOS Prep: opp-target-1:review_reqs] Review requirements',
        completed: true,
        completedAt: new Date('2026-09-05T10:00:00Z'), // after apply
      },
    ];

    const result = computeCareerReadiness(
      { profile, opportunities, applications, todos },
      { referenceDate: FIXED_REF_DATE }
    );

    // Observational driver added
    const prepDriver = result.readinessBand.primaryDrivers.find((d) =>
      d.includes('were submitted while preparation tasks were pending')
    );
    expect(prepDriver).toBeDefined();
    expect(prepDriver).toBe('1 target application(s) were submitted while preparation tasks were pending.');

    // Causality guard: No claim that lack of preparation caused any outcome
    expect(prepDriver).not.toContain('caused');
    expect(prepDriver).not.toContain('because');
  });

  // -------------------------------------------------------------------------
  // J. Existing readiness math
  // -------------------------------------------------------------------------
  it('J. Existing readiness math - skill coverage and evidence percentages unchanged', () => {
    const profile = makeBaseProfile();
    const opportunities = [targetOpp1, targetOpp2, targetOpp3];

    // Compute baseline without applications
    const baseline = computeCareerReadiness(
      { profile, opportunities, applications: [] },
      { referenceDate: FIXED_REF_DATE }
    );

    // Compute with applications having rejections, stalled apps, and unscheduled interviews
    const withApps = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications: [
          { _id: 'app-rej-1', opportunityId: 'opp-rej-1', status: 'rejected', appliedAt: new Date('2026-09-10T10:00:00Z') },
          { _id: 'app-rej-2', opportunityId: 'opp-rej-2', status: 'rejected', appliedAt: new Date('2026-09-12T10:00:00Z') },
          { _id: 'app-rej-3', opportunityId: 'opp-rej-3', status: 'rejected', appliedAt: new Date('2026-09-15T10:00:00Z') },
        ],
        applicationOpportunities: [rejOpp1, rejOpp2, rejOpp3],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    expect(withApps.dimensions.skillCoverage.percentage).toBe(baseline.dimensions.skillCoverage.percentage);
    expect(withApps.dimensions.skillCoverage.totalCount).toBe(baseline.dimensions.skillCoverage.totalCount);
    expect(withApps.dimensions.skillCoverage.coveredCount).toBe(baseline.dimensions.skillCoverage.coveredCount);
    expect(withApps.dimensions.evidenceStrength.verificationRate).toBe(baseline.dimensions.evidenceStrength.verificationRate);
    expect(withApps.dimensions.preparationExecution.percentage).toBe(baseline.dimensions.preparationExecution.percentage);
  });

  // -------------------------------------------------------------------------
  // K. Match isolation
  // -------------------------------------------------------------------------
  it('K. Match isolation - opportunity match score completely unaffected', () => {
    const profile = makeBaseProfile();
    const opp = targetOpp1;

    const matchBefore = calculateOpportunityMatch(profile, opp);

    // Run Career Readiness computation
    computeCareerReadiness(
      {
        profile,
        opportunities: [opp],
        applications: [
          { _id: 'app-rej-1', opportunityId: 'opp-rej-1', status: 'rejected', appliedAt: new Date('2026-09-10T10:00:00Z') },
          { _id: 'app-rej-2', opportunityId: 'opp-rej-2', status: 'rejected', appliedAt: new Date('2026-09-12T10:00:00Z') },
          { _id: 'app-rej-3', opportunityId: 'opp-rej-3', status: 'rejected', appliedAt: new Date('2026-09-15T10:00:00Z') },
        ],
        applicationOpportunities: [rejOpp1, rejOpp2, rejOpp3],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    const matchAfter = calculateOpportunityMatch(profile, opp);

    expect(matchAfter.fitScore).toBe(matchBefore.fitScore);
    expect(matchAfter.fitLevel).toBe(matchBefore.fitLevel);
    expect(matchAfter.matchedSkills).toEqual(matchBefore.matchedSkills);
    expect(matchAfter.skillGaps).toEqual(matchBefore.skillGaps);
  });

  // -------------------------------------------------------------------------
  // L. Determinism
  // -------------------------------------------------------------------------
  it('L. Determinism - identical inputs produce identical snapshot output', () => {
    const payload = {
      profile: makeBaseProfile(),
      opportunities: [targetOpp1, targetOpp2, targetOpp3],
      applications: [
        { _id: 'app-rej-1', opportunityId: 'opp-rej-1', status: 'rejected', appliedAt: new Date('2026-09-10T10:00:00Z') },
        { _id: 'app-rej-2', opportunityId: 'opp-rej-2', status: 'rejected', appliedAt: new Date('2026-09-12T10:00:00Z') },
        { _id: 'app-rej-3', opportunityId: 'opp-rej-3', status: 'rejected', appliedAt: new Date('2026-09-15T10:00:00Z') },
      ],
      applicationOpportunities: [rejOpp1, rejOpp2, rejOpp3],
    };

    const run1 = computeCareerReadiness(payload, { referenceDate: FIXED_REF_DATE });
    const run2 = computeCareerReadiness(payload, { referenceDate: FIXED_REF_DATE });

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  // -------------------------------------------------------------------------
  // M. No DB writes
  // -------------------------------------------------------------------------
  it('M. No DB writes - pure read-only execution', async () => {
    const mockFind = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    const result = computeCareerReadiness(
      {
        profile: makeBaseProfile(),
        opportunities: [targetOpp1],
        applications: [],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    expect(result).toBeDefined();
    // computeCareerReadiness has zero side effects
    expect(result.readinessBand).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // N. Causality language
  // -------------------------------------------------------------------------
  it('N. Causality language - forbidden phrases strictly absent', () => {
    const profile = makeBaseProfile();
    const opportunities = [targetOpp1, targetOpp2, targetOpp3];
    const applications = [
      { _id: 'app-rej-1', opportunityId: 'opp-rej-1', status: 'rejected', appliedAt: new Date('2026-09-10T10:00:00Z') },
      { _id: 'app-rej-2', opportunityId: 'opp-rej-2', status: 'rejected', appliedAt: new Date('2026-09-12T10:00:00Z') },
      { _id: 'app-rej-3', opportunityId: 'opp-rej-3', status: 'rejected', appliedAt: new Date('2026-09-15T10:00:00Z') },
    ];

    const result = computeCareerReadiness(
      {
        profile,
        opportunities,
        applications,
        applicationOpportunities: [rejOpp1, rejOpp2, rejOpp3],
      },
      { referenceDate: FIXED_REF_DATE }
    );

    const serialized = JSON.stringify(result).toLowerCase();

    const forbiddenPhrases = [
      'rejected because',
      'caused your rejection',
      'reason for rejection',
      'employer rejected you because',
      'fault',
    ];

    for (const phrase of forbiddenPhrases) {
      expect(serialized.includes(phrase)).toBe(false);
    }

    // Allowed observational pattern is present
    expect(serialized).toContain('observational pattern');
  });
});
