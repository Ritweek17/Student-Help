import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  calculateApplicationIntelligence,
  computeApplicationIntelligence,
  filterAndBoundApplications,
  detectStalledApplications,
  evaluateApplicationHealth,
  calculateFunnelMetrics,
  calculateTimeMetrics,
  calculateRecentActivity,
  analyzeRejectionGaps,
  analyzePreparationFeedback,
  analyzeInterviewInsights,
  deriveFollowUpActions,
  analyzeRoleSkillPatterns,
  summarizeOutcomes,
  normalizeApplicationStatus,
  calculateApplicationCounts,
  ANALYSIS_WINDOW_DAYS,
  MAX_APPLICATIONS,
  STALLED_APPLICATION_DAYS,
  RECENT_ACTIVITY_DAYS,
  MIN_SAMPLE_SIZE_PERCENTAGE,
  MIN_SAMPLE_SIZE_REJECTION,
} from '../../src/services/intelligence/application-intelligence.service.js';
import { calculateOpportunityMatch } from '../../src/services/intelligence/match.service.js';
import { Application } from '../../src/models/Application.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { SavedOpportunity } from '../../src/models/SavedOpportunity.js';
import { Todo } from '../../src/models/Todo.js';
import { CalendarEvent } from '../../src/models/CalendarEvent.js';
import { Profile } from '../../src/models/Profile.js';

describe('Phase 11G — Application Intelligence Service (Core Deterministic Engine)', () => {
  const FIXED_REF_DATE = new Date('2026-10-07T12:00:00.000Z');

  // =========================================================================
  // A. APPLICATION LIFECYCLE NORMALIZATION & BASIC COUNTS
  // =========================================================================
  describe('A. Application Lifecycle & Basic Counts', () => {
    it('correctly maps all valid Application schema statuses into conceptual groups', () => {
      expect(normalizeApplicationStatus('applied')).toBe('active');
      expect(normalizeApplicationStatus('waiting')).toBe('active');
      expect(normalizeApplicationStatus('interview')).toBe('interview');
      expect(normalizeApplicationStatus('selected')).toBe('selected');
      expect(normalizeApplicationStatus('rejected')).toBe('rejected');
      expect(normalizeApplicationStatus('withdrawn')).toBe('withdrawn');
      expect(normalizeApplicationStatus('unknown_status')).toBe('unknown');
    });

    it('accurately computes deterministic counts across all categories', () => {
      const apps = [
        { _id: 'app-1', status: 'applied', appliedAt: '2026-10-01T00:00:00Z' },
        { _id: 'app-2', status: 'waiting', appliedAt: '2026-09-25T00:00:00Z' },
        { _id: 'app-3', status: 'interview', appliedAt: '2026-09-20T00:00:00Z' },
        { _id: 'app-4', status: 'selected', appliedAt: '2026-09-10T00:00:00Z' },
        { _id: 'app-5', status: 'rejected', appliedAt: '2026-08-15T00:00:00Z' },
        { _id: 'app-6', status: 'withdrawn', appliedAt: '2026-08-01T00:00:00Z' },
      ];

      const counts = calculateApplicationCounts(apps, 1, FIXED_REF_DATE);
      expect(counts.totalTracked).toBe(6);
      expect(counts.activeApplications).toBe(3); // applied, waiting, interview
      expect(counts.interviewCount).toBe(1);
      expect(counts.selectedCount).toBe(1);
      expect(counts.rejectedCount).toBe(1);
      expect(counts.withdrawnCount).toBe(1);
      expect(counts.stalledApplications).toBe(1);
      // recent: applied within past 30 days of 2026-10-07 -> apps 1, 2, 3, 4
      expect(counts.recentApplications).toBe(4);
    });
  });

  // =========================================================================
  // B. STALLED APPLICATION DETECTION
  // =========================================================================
  describe('B. Stalled Application Detection', () => {
    it('does not flag active application that is exactly 14 days old (threshold is > 14 days)', () => {
      // exactly 14 days before 2026-10-07T12:00:00.000Z -> 2026-09-23T12:00:00.000Z
      const exact14Date = new Date(FIXED_REF_DATE.getTime() - 14 * 24 * 60 * 60 * 1000);
      const apps = [
        {
          _id: 'app-exact',
          opportunityId: 'opp-1',
          status: 'applied',
          appliedAt: exact14Date,
        },
      ];
      const oppMap = new Map([
        ['opp-1', { _id: 'opp-1', title: 'SWE', organization: 'Acme Corp' }],
      ]);

      const stalled = detectStalledApplications(apps, oppMap, FIXED_REF_DATE);
      expect(stalled.length).toBe(0);
    });

    it('flags applied application older than 14 days with clear reason and ageDays', () => {
      // 15 days before reference date
      const oldDate = new Date(FIXED_REF_DATE.getTime() - 15 * 24 * 60 * 60 * 1000);
      const apps = [
        {
          _id: 'app-stalled-1',
          opportunityId: 'opp-1',
          status: 'applied',
          appliedAt: oldDate,
        },
      ];
      const oppMap = new Map([
        ['opp-1', { _id: 'opp-1', title: 'Frontend Engineer', organization: 'Beta Co' }],
      ]);

      const stalled = detectStalledApplications(apps, oppMap, FIXED_REF_DATE);
      expect(stalled.length).toBe(1);
      expect(stalled[0].applicationId).toBe('app-stalled-1');
      expect(stalled[0].organization).toBe('Beta Co');
      expect(stalled[0].title).toBe('Frontend Engineer');
      expect(stalled[0].ageDays).toBe(15);
      expect(stalled[0].reason).toContain('No response received for more than 14 days after applying');
    });

    it('detects waiting application stalled by updatedAt over 14 days', () => {
      const oldUpdate = new Date(FIXED_REF_DATE.getTime() - 20 * 24 * 60 * 60 * 1000);
      const apps = [
        {
          _id: 'app-wait',
          opportunityId: 'opp-1',
          status: 'waiting',
          appliedAt: new Date(FIXED_REF_DATE.getTime() - 30 * 24 * 60 * 60 * 1000),
          updatedAt: oldUpdate,
        },
      ];
      const oppMap = new Map([
        ['opp-1', { _id: 'opp-1', title: 'Backend Dev', organization: 'Gamma Inc' }],
      ]);

      const stalled = detectStalledApplications(apps, oppMap, FIXED_REF_DATE);
      expect(stalled.length).toBe(1);
      expect(stalled[0].reason).toContain('Waiting for response for more than 14 days since last update');
      expect(stalled[0].ageDays).toBe(20);
    });

    it('flags active application whose opportunity deadline has passed without duplicating records', () => {
      // 5 days old application, but opportunity deadline was 2 days ago
      const appDate = new Date(FIXED_REF_DATE.getTime() - 5 * 24 * 60 * 60 * 1000);
      const deadlinePast = new Date(FIXED_REF_DATE.getTime() - 2 * 24 * 60 * 60 * 1000);

      const apps = [
        {
          _id: 'app-deadline',
          opportunityId: 'opp-1',
          status: 'applied',
          appliedAt: appDate,
        },
      ];
      const oppMap = new Map([
        [
          'opp-1',
          {
            _id: 'opp-1',
            title: 'Intern',
            organization: 'Delta Corp',
            deadline: deadlinePast,
          },
        ],
      ]);

      const stalled = detectStalledApplications(apps, oppMap, FIXED_REF_DATE);
      expect(stalled.length).toBe(1);
      expect(stalled[0].reason).toContain('Opportunity deadline has passed');
      expect(stalled[0].ageDays).toBe(5);
    });

    it('does not flag terminal applications (selected, rejected, withdrawn) as stalled', () => {
      const veryOldDate = new Date(FIXED_REF_DATE.getTime() - 60 * 24 * 60 * 60 * 1000);
      const apps = [
        { _id: 'app-sel', opportunityId: 'opp-1', status: 'selected', appliedAt: veryOldDate },
        { _id: 'app-rej', opportunityId: 'opp-2', status: 'rejected', appliedAt: veryOldDate },
        { _id: 'app-wd', opportunityId: 'opp-3', status: 'withdrawn', appliedAt: veryOldDate },
      ];
      const oppMap = new Map();

      const stalled = detectStalledApplications(apps, oppMap, FIXED_REF_DATE);
      expect(stalled.length).toBe(0);
    });
  });

  // =========================================================================
  // C. APPLICATION HEALTH EVALUATION
  // =========================================================================
  describe('C. Application Health Evaluation (Categorical)', () => {
    it('returns Dormant when there are zero active applications', () => {
      const health = evaluateApplicationHealth({
        totalTracked: 0,
        activeCount: 0,
        stalledApplications: [],
        interviewInsights: [],
      });
      expect(health.state).toBe('Dormant');
      expect(health.summary).toContain('No active applications');
    });

    it('returns Stalled when all active applications are stalled', () => {
      const health = evaluateApplicationHealth({
        totalTracked: 2,
        activeCount: 2,
        stalledApplications: [{ applicationId: '1' }, { applicationId: '2' }],
        interviewInsights: [],
      });
      expect(health.state).toBe('Stalled');
      expect(health.summary).toContain('All active applications are currently stalled');
      expect(health.drivers[0]).toContain('2 active application(s) have had no update');
    });

    it('returns Needs Attention when some active applications are stalled', () => {
      const health = evaluateApplicationHealth({
        totalTracked: 4,
        activeCount: 3,
        stalledApplications: [{ applicationId: '1' }],
        interviewInsights: [],
      });
      expect(health.state).toBe('Needs Attention');
      expect(health.drivers[0]).toContain('1 of 3 active application(s)');
    });

    it('returns Needs Attention when active interview has no calendar event scheduled', () => {
      const health = evaluateApplicationHealth({
        totalTracked: 2,
        activeCount: 2,
        stalledApplications: [],
        interviewInsights: [{ interviewScheduled: false }],
      });
      expect(health.state).toBe('Needs Attention');
      expect(health.drivers[0]).toContain('do not have a confirmed calendar schedule');
    });

    it('returns Active Momentum when active applications >= 3 and zero stalled', () => {
      const health = evaluateApplicationHealth({
        totalTracked: 5,
        activeCount: 3,
        stalledApplications: [],
        interviewInsights: [{ interviewScheduled: true }],
      });
      expect(health.state).toBe('Active Momentum');
      expect(health.summary).toContain('Strong active application pipeline');
    });

    it('returns Healthy when active applications is 1-2 and zero stalled', () => {
      const health = evaluateApplicationHealth({
        totalTracked: 2,
        activeCount: 2,
        stalledApplications: [],
        interviewInsights: [{ interviewScheduled: true }],
      });
      expect(health.state).toBe('Healthy');
      expect(health.summary).toContain('progressing within expected timelines');
    });
  });

  // =========================================================================
  // D. FUNNEL METRICS & SAMPLE SIZE PROTECTIONS
  // =========================================================================
  describe('D. Funnel Metrics & Sample-Size Guardrails', () => {
    it('suppresses conversion percentages when sample size < 5', () => {
      const apps = [
        { opportunityId: 'opp-1', status: 'interview' },
        { opportunityId: 'opp-2', status: 'applied' },
        { opportunityId: 'opp-3', status: 'selected' },
      ];
      const saved = [{ opportunityId: 'opp-1' }, { opportunityId: 'opp-2' }];
      const counts = calculateApplicationCounts(apps, 0, FIXED_REF_DATE);

      const funnel = calculateFunnelMetrics({
        applications: apps,
        savedOpportunities: saved,
        counts,
      });

      // Sample sizes are < 5, so percentages must be null with insufficient_sample
      expect(funnel.savedToApplied.percentage).toBeNull();
      expect(funnel.savedToApplied.status).toBe('insufficient_sample');
      expect(funnel.savedToApplied.denominator).toBe(2);
      expect(funnel.savedToApplied.numerator).toBe(2);

      expect(funnel.appliedToInterview.percentage).toBeNull();
      expect(funnel.appliedToInterview.status).toBe('insufficient_sample');
      expect(funnel.appliedToInterview.denominator).toBe(3);

      expect(funnel.overallSelected.percentage).toBeNull();
      expect(funnel.overallSelected.status).toBe('insufficient_sample');
    });

    it('calculates deterministic percentages when sample size >= 5', () => {
      const apps = [
        { opportunityId: 'opp-1', status: 'interview' },
        { opportunityId: 'opp-2', status: 'interview' },
        { opportunityId: 'opp-3', status: 'selected' },
        { opportunityId: 'opp-4', status: 'rejected' },
        { opportunityId: 'opp-5', status: 'applied' },
        { opportunityId: 'opp-6', status: 'applied' },
      ];
      const saved = [
        { opportunityId: 'opp-1' },
        { opportunityId: 'opp-2' },
        { opportunityId: 'opp-3' },
        { opportunityId: 'opp-4' },
        { opportunityId: 'opp-5' },
      ];
      const counts = calculateApplicationCounts(apps, 0, FIXED_REF_DATE);

      const funnel = calculateFunnelMetrics({
        applications: apps,
        savedOpportunities: saved,
        counts,
      });

      // Saved to Applied: 5 saved, all 5 applied -> 100%
      expect(funnel.savedToApplied.status).toBe('available');
      expect(funnel.savedToApplied.denominator).toBe(5);
      expect(funnel.savedToApplied.numerator).toBe(5);
      expect(funnel.savedToApplied.percentage).toBe(100);

      // Applied to Interview: 6 applied, 3 reached interview/selected -> 50%
      expect(funnel.appliedToInterview.status).toBe('available');
      expect(funnel.appliedToInterview.denominator).toBe(6);
      expect(funnel.appliedToInterview.numerator).toBe(3);
      expect(funnel.appliedToInterview.percentage).toBe(50);

      // Overall Selected: 6 total, 1 selected -> 17%
      expect(funnel.overallSelected.status).toBe('available');
      expect(funnel.overallSelected.denominator).toBe(6);
      expect(funnel.overallSelected.numerator).toBe(1);
      expect(funnel.overallSelected.percentage).toBe(17);
    });

    it('safely handles zero denominators without division by zero', () => {
      const funnel = calculateFunnelMetrics({
        applications: [],
        savedOpportunities: [],
        counts: {
          totalTracked: 0,
          interviewCount: 0,
          selectedCount: 0,
          rejectedCount: 0,
        },
      });

      expect(funnel.savedToApplied.percentage).toBeNull();
      expect(funnel.savedToApplied.denominator).toBe(0);
      expect(funnel.appliedToInterview.percentage).toBeNull();
      expect(funnel.interviewToSelected.percentage).toBeNull();
      expect(funnel.overallSelected.percentage).toBeNull();
    });
  });

  // =========================================================================
  // E. TIME METRICS & RECENT VELOCITY
  // =========================================================================
  describe('E. Time Metrics & Velocity', () => {
    it('calculates time-to-apply when >= 5 matched saved records exist', () => {
      const baseTime = new Date('2026-09-01T00:00:00Z').getTime();
      const saved = [];
      const apps = [];

      for (let i = 1; i <= 5; i++) {
        const savedDate = new Date(baseTime + i * 24 * 60 * 60 * 1000);
        // applied 2 days after save
        const appliedDate = new Date(savedDate.getTime() + 2 * 24 * 60 * 60 * 1000);
        saved.push({ opportunityId: `opp-${i}`, createdAt: savedDate });
        apps.push({ _id: `app-${i}`, opportunityId: `opp-${i}`, appliedAt: appliedDate, status: 'applied' });
      }

      const { timeToApply } = calculateTimeMetrics(apps, saved, new Map(), FIXED_REF_DATE);
      expect(timeToApply.status).toBe('available');
      expect(timeToApply.sampleSize).toBe(5);
      expect(timeToApply.averageDays).toBe(2);
      expect(timeToApply.medianDays).toBe(2);
    });

    it('returns insufficient_sample for time-to-apply when fewer than 5 records exist', () => {
      const saved = [{ opportunityId: 'opp-1', createdAt: new Date('2026-09-01T00:00:00Z') }];
      const apps = [
        { _id: 'app-1', opportunityId: 'opp-1', appliedAt: new Date('2026-09-05T00:00:00Z'), status: 'applied' },
      ];

      const { timeToApply } = calculateTimeMetrics(apps, saved, new Map(), FIXED_REF_DATE);
      expect(timeToApply.status).toBe('insufficient_sample');
      expect(timeToApply.percentage).toBeUndefined();
      expect(timeToApply.averageDays).toBeNull();
    });

    it('classifies recent velocity deterministically', () => {
      const d1 = new Date(FIXED_REF_DATE.getTime() - 5 * 24 * 60 * 60 * 1000);
      const d2 = new Date(FIXED_REF_DATE.getTime() - 10 * 24 * 60 * 60 * 1000);
      const d3 = new Date(FIXED_REF_DATE.getTime() - 15 * 24 * 60 * 60 * 1000);
      const dOld = new Date(FIXED_REF_DATE.getTime() - 40 * 24 * 60 * 60 * 1000);

      expect(calculateRecentActivity([], FIXED_REF_DATE).velocity).toBe('none');

      const lowApps = [{ appliedAt: d1 }];
      expect(calculateRecentActivity(lowApps, FIXED_REF_DATE).velocity).toBe('low');

      const activeApps = [{ appliedAt: d1 }, { appliedAt: d2 }, { appliedAt: d3 }, { appliedAt: dOld }];
      const activeResult = calculateRecentActivity(activeApps, FIXED_REF_DATE);
      expect(activeResult.recentCount).toBe(3);
      expect(activeResult.velocity).toBe('active');
    });
  });

  // =========================================================================
  // F. REJECTION GAP ANALYSIS & CAUSALITY SAFEGUARD
  // =========================================================================
  describe('F. Rejection Gap Analysis & Causality Guardrail', () => {
    it('returns insufficient_sample when fewer than 3 rejected opportunities are analyzed', () => {
      const rejectedApps = [
        { opportunityId: 'opp-1', status: 'rejected' },
        { opportunityId: 'opp-2', status: 'rejected' },
      ];
      const oppMap = new Map([
        ['opp-1', { _id: 'opp-1', skills: ['typescript'] }],
        ['opp-2', { _id: 'opp-2', skills: ['react'] }],
      ]);
      const profile = { skills: [] };

      const result = analyzeRejectionGaps(rejectedApps, oppMap, profile);
      expect(result.status).toBe('insufficient_sample');
      expect(result.totalRejectedOpportunitiesAnalyzed).toBe(2);
      expect(result.patterns).toEqual([]);
      expect(result.message).toContain('at least 3 rejected applications');
    });

    it('detects recurring missing skills across >= 3 rejected opportunities', () => {
      const rejectedApps = [
        { opportunityId: 'opp-1', status: 'rejected' },
        { opportunityId: 'opp-2', status: 'rejected' },
        { opportunityId: 'opp-3', status: 'rejected' },
        { opportunityId: 'opp-4', status: 'rejected' },
      ];

      // TypeScript required in 3 out of 4; Python in 2 out of 4; Docker in 4 out of 4
      const oppMap = new Map([
        ['opp-1', { _id: 'opp-1', skills: ['typescript', 'docker'] }],
        ['opp-2', { _id: 'opp-2', skills: ['typescript', 'python', 'docker'] }],
        ['opp-3', { _id: 'opp-3', skills: ['typescript', 'python', 'docker'] }],
        ['opp-4', { _id: 'opp-4', skills: ['docker', 'go'] }],
      ]);

      // Profile has verified Docker via GitHub, but unverified TypeScript and Python
      const profile = {
        skills: [{ name: 'python', level: 'intermediate' }], // claimed only
        githubEvidence: {
          syncStatus: 'synced',
          detectedSkills: [{ canonicalKey: 'docker', repoCount: 2 }],
        },
      };

      const result = analyzeRejectionGaps(rejectedApps, oppMap, profile);
      expect(result.status).toBe('available');
      expect(result.totalRejectedOpportunitiesAnalyzed).toBe(4);

      // Docker should NOT be a gap because candidate has GitHub proof
      const dockerGap = result.patterns.find((p) => p.canonicalKey === 'docker');
      expect(dockerGap).toBeUndefined();

      // TypeScript appeared in 3 of 4 rejected opps (75%)
      const tsGap = result.patterns.find((p) => p.canonicalKey === 'typescript');
      expect(tsGap).toBeDefined();
      expect(tsGap.rejectedOpportunityCount).toBe(3);
      expect(tsGap.recurrencePercent).toBe(75);
      expect(tsGap.candidateEvidence).toBe('unverified');
      expect(tsGap.affectedOpportunityIds).toEqual(['opp-1', 'opp-2', 'opp-3']);

      // Python appeared in 2 of 4 (50%) and was claimed_only
      const pyGap = result.patterns.find((p) => p.canonicalKey === 'python');
      expect(pyGap).toBeDefined();
      expect(pyGap.rejectedOpportunityCount).toBe(2);
      expect(pyGap.recurrencePercent).toBe(50);
      expect(pyGap.candidateEvidence).toBe('claimed_only');

      // Sorting: TypeScript (75%) before Python (50%)
      expect(result.patterns[0].canonicalKey).toBe('typescript');
    });

    it('STRICT CAUSALITY GUARDRAIL: output contains observational phrasing and forbids causal claims', () => {
      const rejectedApps = [
        { opportunityId: 'opp-1', status: 'rejected' },
        { opportunityId: 'opp-2', status: 'rejected' },
        { opportunityId: 'opp-3', status: 'rejected' },
      ];
      const oppMap = new Map([
        ['opp-1', { _id: 'opp-1', skills: ['typescript'] }],
        ['opp-2', { _id: 'opp-2', skills: ['typescript'] }],
        ['opp-3', { _id: 'opp-3', skills: ['typescript'] }],
      ]);
      const profile = { skills: [] };

      const result = analyzeRejectionGaps(rejectedApps, oppMap, profile);
      const pattern = result.patterns[0];

      // Must start with Observational Pattern
      expect(pattern.observation).toContain('Observational Pattern:');
      expect(pattern.observation).toContain('TypeScript appeared in 3 of your 3 recent rejected opportunities');

      // FORBIDDEN CAUSAL PHRASES
      const forbiddenPhrases = [
        'because of',
        'rejected due to',
        'caused your rejection',
        'reason you were rejected',
        'you were rejected because',
        'fault',
      ];
      for (const phrase of forbiddenPhrases) {
        expect(pattern.observation.toLowerCase()).not.toContain(phrase);
      }
    });
  });

  // =========================================================================
  // G. PREPARATION FEEDBACK
  // =========================================================================
  describe('G. Preparation Feedback', () => {
    it('marks prep_completed_before_apply when all tasks finished prior to apply date', () => {
      const appDate = new Date('2026-10-01T12:00:00Z');
      const apps = [{ _id: 'app-prep', opportunityId: 'opp-1', appliedAt: appDate }];
      const todos = [
        {
          opportunityId: 'opp-1',
          description: 'Review architecture [CareerOS Prep: opp-1:task1]',
          completed: true,
          completedAt: new Date('2026-09-28T00:00:00Z'),
        },
        {
          opportunityId: 'opp-1',
          description: 'Practice demo [CareerOS Prep: opp-1:task2]',
          completed: true,
          completedAt: new Date('2026-09-30T00:00:00Z'),
        },
      ];
      const oppMap = new Map([['opp-1', { _id: 'opp-1', title: 'SWE', organization: 'Stripe' }]]);

      const feedback = analyzePreparationFeedback(apps, todos, oppMap, FIXED_REF_DATE);
      expect(feedback.length).toBe(1);
      expect(feedback[0].prepStatus).toBe('prep_completed_before_apply');
      expect(feedback[0].totalPrepTasks).toBe(2);
      expect(feedback[0].completedPrepTasks).toBe(2);
      expect(feedback[0].summary).toContain('completed prior to submitting');
    });

    it('marks prep_pending_at_apply when tasks were incomplete at apply date', () => {
      const appDate = new Date('2026-10-01T12:00:00Z');
      const apps = [{ _id: 'app-pending', opportunityId: 'opp-1', appliedAt: appDate }];
      const todos = [
        {
          description: 'Learn Docker [CareerOS Prep: opp-1:task1]',
          completed: false,
        },
      ];
      const oppMap = new Map([['opp-1', { _id: 'opp-1', title: 'SWE', organization: 'Stripe' }]]);

      const feedback = analyzePreparationFeedback(apps, todos, oppMap, FIXED_REF_DATE);
      expect(feedback[0].prepStatus).toBe('prep_pending_at_apply');
      expect(feedback[0].summary).toContain('tasks were still pending');
    });

    it('marks no_prep_record when no CareerOS prep todos exist for opportunity', () => {
      const apps = [{ _id: 'app-noprep', opportunityId: 'opp-1', appliedAt: new Date() }];
      const todos = [{ description: 'General personal todo' }];
      const feedback = analyzePreparationFeedback(apps, todos, new Map(), FIXED_REF_DATE);
      expect(feedback[0].prepStatus).toBe('no_prep_record');
    });
  });

  // =========================================================================
  // H. FOLLOW-UP ACTION CANDIDATES (IN-MEMORY DERIVATION)
  // =========================================================================
  describe('H. Follow-Up Action Candidates', () => {
    it('generates follow-up action for stalled active application', () => {
      const stalled = [
        {
          applicationId: 'app-1',
          opportunityId: 'opp-1',
          organization: 'Meta',
          status: 'applied',
          ageDays: 22,
          reason: 'No response received for more than 14 days after applying.',
        },
      ];
      const apps = [{ _id: 'app-1', status: 'applied' }];

      const actions = deriveFollowUpActions(stalled, apps);
      expect(actions.length).toBe(1);
      expect(actions[0].actionKey).toBe('followup:app-1');
      expect(actions[0].type).toBe('application_followup');
      expect(actions[0].title).toBe('Follow up on application with Meta');
      expect(actions[0].priority).toBe('High'); // ageDays >= 21
    });

    it('does not generate follow-up actions for terminal applications', () => {
      const stalled = [
        {
          applicationId: 'app-term',
          opportunityId: 'opp-1',
          organization: 'Apple',
          status: 'rejected',
          ageDays: 25,
        },
      ];
      const apps = [{ _id: 'app-term', status: 'rejected' }];

      const actions = deriveFollowUpActions(stalled, apps);
      expect(actions.length).toBe(0);
    });
  });

  // =========================================================================
  // I. INTERVIEW INSIGHTS & CALENDAR INTEGRATION
  // =========================================================================
  describe('I. Interview Insights', () => {
    it('identifies unscheduled interview when no matching calendar event exists', () => {
      const apps = [{ _id: 'app-int', opportunityId: 'opp-int', status: 'interview' }];
      const oppMap = new Map([
        ['opp-int', { _id: 'opp-int', title: 'Senior Dev', organization: 'Netflix' }],
      ]);

      const insights = analyzeInterviewInsights(apps, [], oppMap);
      expect(insights.length).toBe(1);
      expect(insights[0].interviewScheduled).toBe(false);
      expect(insights[0].interviewEventId).toBeNull();
      expect(insights[0].preparationSignal).toContain('without scheduled calendar event');
    });

    it('correlates interview with scheduled CalendarEvent', () => {
      const apps = [{ _id: 'app-int-2', opportunityId: 'opp-int-2', status: 'interview' }];
      const oppMap = new Map([
        ['opp-int-2', { _id: 'opp-int-2', title: 'Senior Dev', organization: 'Google' }],
      ]);
      const events = [
        {
          _id: 'cal-event-1',
          applicationId: 'app-int-2',
          type: 'interview',
          status: 'scheduled',
          startAt: new Date('2026-10-15T10:00:00Z'),
        },
      ];

      const insights = analyzeInterviewInsights(apps, events, oppMap);
      expect(insights.length).toBe(1);
      expect(insights[0].interviewScheduled).toBe(true);
      expect(insights[0].interviewEventId).toBe('cal-event-1');
      expect(insights[0].preparationSignal).toContain('review opportunity preparation plan');
    });
  });

  // =========================================================================
  // J. ROLE & SKILL PATTERNS
  // =========================================================================
  describe('J. Role & Skill Patterns', () => {
    it('groups applications by type and workMode with outcome breakdowns', () => {
      const apps = [
        { _id: '1', opportunityId: 'opp-1', status: 'selected' },
        { _id: '2', opportunityId: 'opp-2', status: 'interview' },
        { _id: '3', opportunityId: 'opp-3', status: 'rejected' },
      ];
      const oppMap = new Map([
        ['opp-1', { _id: 'opp-1', type: 'internship', workMode: 'remote', skills: [] }],
        ['opp-2', { _id: 'opp-2', type: 'internship', workMode: 'remote', skills: [] }],
        ['opp-3', { _id: 'opp-3', type: 'internship', workMode: 'onsite', skills: ['c++'] }],
      ]);

      const patterns = analyzeRoleSkillPatterns(apps, oppMap, { skills: [] });
      const internshipGroup = patterns.find((p) => p.groupKey === 'type:internship');
      expect(internshipGroup).toBeDefined();
      expect(internshipGroup.applications).toBe(3);
      expect(internshipGroup.selected).toBe(1);
      expect(internshipGroup.interviews).toBe(1);
      expect(internshipGroup.rejected).toBe(1);
    });
  });

  // =========================================================================
  // K. PERFORMANCE BOUNDS & DATA WINDOWING
  // =========================================================================
  describe('K. Performance Bounds & Data Windowing', () => {
    it('caps applications to MAX_APPLICATIONS (50) and drops records older than 180 days', () => {
      const apps = [];
      // 100 applications generated
      for (let i = 0; i < 100; i++) {
        // days ago: i * 3
        // For i >= 61, i * 3 > 180 days
        const appliedAt = new Date(FIXED_REF_DATE.getTime() - i * 3 * 24 * 60 * 60 * 1000);
        apps.push({
          _id: `app-${i}`,
          opportunityId: `opp-${i}`,
          status: 'applied',
          appliedAt,
        });
      }

      const bounded = filterAndBoundApplications(apps, FIXED_REF_DATE);
      expect(bounded.length).toBe(MAX_APPLICATIONS); // 50 maximum cap

      // Verify earliest date is within 180 days
      const cutoff = FIXED_REF_DATE.getTime() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      for (const app of bounded) {
        expect(new Date(app.appliedAt).getTime()).toBeGreaterThanOrEqual(cutoff);
      }
    });
  });

  // =========================================================================
  // L. READ-ONLY GUARANTEE & DB QUERIES SCOPED BY USER
  // =========================================================================
  describe('L. Read-Only Guarantee & User Ownership', () => {
    it('never calls write/mutation operations on MongoDB models', async () => {
      const saveSpy = vi.spyOn(Application.prototype, 'save').mockImplementation(() => {});
      const createSpy = vi.spyOn(Application, 'create').mockImplementation(() => {});
      const updateSpy = vi.spyOn(Application, 'updateOne').mockImplementation(() => {});
      const deleteSpy = vi.spyOn(Application, 'deleteOne').mockImplementation(() => {});

      await calculateApplicationIntelligence('user-test-1', {
        applications: [{ _id: '1', opportunityId: 'opp-1', status: 'applied', appliedAt: FIXED_REF_DATE }],
        opportunities: [{ _id: 'opp-1', title: 'Dev', organization: 'Amazon' }],
        savedOpportunities: [],
        todos: [],
        calendarEvents: [],
        profile: { skills: [] },
        referenceDate: FIXED_REF_DATE,
      });

      expect(saveSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
      createSpy.mockRestore();
      updateSpy.mockRestore();
      deleteSpy.mockRestore();
    });
  });

  // =========================================================================
  // M. MATCH ENGINE ISOLATION
  // =========================================================================
  describe('M. Match Engine Isolation', () => {
    it('running application intelligence does not mutate opportunity match scoring', async () => {
      const profile = {
        skills: [{ name: 'javascript', level: 'intermediate' }],
        projects: [],
      };
      const opportunity = {
        _id: 'opp-iso',
        title: 'JavaScript Developer',
        skills: ['javascript'],
      };

      const baselineMatch = calculateOpportunityMatch(profile, opportunity);

      // Execute application intelligence with a rejection for this opportunity
      await calculateApplicationIntelligence('user-iso', {
        applications: [{ _id: 'app-iso', opportunityId: 'opp-iso', status: 'rejected', appliedAt: FIXED_REF_DATE }],
        opportunities: [opportunity],
        profile,
        referenceDate: FIXED_REF_DATE,
      });

      // Calculate match again; score must be identical
      const postMatch = calculateOpportunityMatch(profile, opportunity);
      expect(postMatch.score).toBe(baselineMatch.score);
      expect(postMatch.fitLevel).toBe(baselineMatch.fitLevel);
    });
  });

  // =========================================================================
  // N. END-TO-END DETERMINISTIC CALCULATION SHAPE
  // =========================================================================
  describe('N. Complete Output Shape Verification', () => {
    it('produces expected top-level schema without leaking private notes or tokens', () => {
      const result = computeApplicationIntelligence(
        {
          applications: [
            {
              _id: 'app-full',
              opportunityId: 'opp-full',
              status: 'applied',
              appliedAt: new Date(FIXED_REF_DATE.getTime() - 2 * 24 * 60 * 60 * 1000),
              notes: 'SECRET PRIVATE STUDENT NOTE',
            },
          ],
          opportunities: [
            {
              _id: 'opp-full',
              title: 'Full Stack Engineer',
              organization: 'Vercel',
            },
          ],
        },
        { referenceDate: FIXED_REF_DATE }
      );

      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('counts');
      expect(result).toHaveProperty('funnel');
      expect(result).toHaveProperty('health');
      expect(result).toHaveProperty('stalledApplications');
      expect(result).toHaveProperty('recentActivity');
      expect(result).toHaveProperty('timeMetrics');
      expect(result).toHaveProperty('outcomes');
      expect(result).toHaveProperty('rejectionPatterns');
      expect(result).toHaveProperty('rolePatterns');
      expect(result).toHaveProperty('preparationFeedback');
      expect(result).toHaveProperty('interviewInsights');
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('sourceApplications');

      // Notes must not be leaked into sourceApplications
      expect(result.sourceApplications[0]).not.toHaveProperty('notes');
      expect(JSON.stringify(result)).not.toContain('SECRET PRIVATE STUDENT NOTE');
    });
  });
});
