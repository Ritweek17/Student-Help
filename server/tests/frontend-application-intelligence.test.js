import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';

import { ApplicationHealthCard } from '../../src/components/intelligence/ApplicationHealthCard.jsx';
import { ApplicationFunnelCard } from '../../src/components/intelligence/ApplicationFunnelCard.jsx';
import { StalledApplicationsCard } from '../../src/components/intelligence/StalledApplicationsCard.jsx';
import { OutcomeInsightsCard } from '../../src/components/intelligence/OutcomeInsightsCard.jsx';
import { RejectionPatternCard } from '../../src/components/intelligence/RejectionPatternCard.jsx';
import {
  getApplicationOverview,
  getApplicationOutcomes,
  IntelligenceApiError,
} from '../../src/services/intelligenceApi.js';

describe('CareerOS Frontend Application Intelligence Suite (Phase 11G Batch 4)', () => {
  // Helper to render with MemoryRouter and strip React SSR comment delimiters
  const renderWithRouter = (ui) => {
    const raw = renderToString(React.createElement(MemoryRouter, null, ui));
    return raw.replace(/<!--.*?-->/g, '');
  };

  // =========================================================================
  // 1. APPLICATION HEALTH CARD COMPONENT TESTS
  // =========================================================================
  describe('1. ApplicationHealthCard Component States & Metrics', () => {
    const createMockOverview = (state, overrides = {}) => ({
      health: {
        state,
        label: state,
        summary: `Pipeline is currently in ${state} condition based on application momentum.`,
        drivers: [
          `Primary driver for ${state} pipeline state`,
          'Consistent follow-up activity observed',
        ],
        activeCount: 4,
        stalledCount: state === 'Stalled' ? 2 : 0,
        ...overrides.health,
      },
      funnel: {
        totalTracked: 6,
        status: 'sufficient_sample',
      },
      stalledApplications: state === 'Stalled' ? [
        {
          applicationId: 'app-1',
          title: 'Frontend Engineer',
          organization: 'Stripe',
          ageDays: 18,
          reason: 'No status update for 18 days',
          action: {
            actionKey: 'followup:app-1',
            type: 'application_followup',
            title: 'Follow up with Stripe',
          },
        },
      ] : [],
      actions: [
        {
          actionKey: 'followup:app-1',
          type: 'application_followup',
          title: 'Follow Up with Recruiter',
          description: 'It has been 18 days since your last status update.',
          priority: 'High',
          applicationId: 'app-1',
        },
      ],
      recentActivity: {
        recentCount: 3,
        velocity: 'steady',
      },
      ...overrides,
    });

    it('renders "Healthy" state correctly with drivers and active metrics', () => {
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: createMockOverview('Healthy'),
          loading: false,
        })
      );

      expect(html).toContain('Pipeline Health');
      expect(html).toContain('Healthy');
      expect(html).toContain('Pipeline is currently in Healthy condition');
      expect(html).toContain('Pipeline Drivers');
      expect(html).toContain('Primary driver for Healthy pipeline state');
      expect(html).toContain('Active Roles');
      expect(html).toContain('4');
      expect(html).not.toContain('NaN');
    });

    it('renders "Active Momentum" state correctly', () => {
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: createMockOverview('Active Momentum'),
          loading: false,
        })
      );

      expect(html).toContain('Active Momentum');
      expect(html).toContain('Pipeline is currently in Active Momentum condition');
    });

    it('renders "Needs Attention" state correctly', () => {
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: createMockOverview('Needs Attention'),
          loading: false,
        })
      );

      expect(html).toContain('Needs Attention');
      expect(html).toContain('Pipeline is currently in Needs Attention condition');
    });

    it('renders "Stalled" state correctly with stalled count and follow-up CTA', () => {
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: createMockOverview('Stalled'),
          loading: false,
        })
      );

      expect(html).toContain('Stalled');
      expect(html).toContain('Pipeline is currently in Stalled condition');
      expect(html).toContain('Stalled (&gt;14d)');
      expect(html).toContain('2');
      expect(html).toContain('Follow Up with Recruiter');
    });

    it('renders "Dormant" state correctly', () => {
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: createMockOverview('Dormant', {
            health: {
              activeCount: 0,
              stalledCount: 0,
              summary: 'Track your first application to unlock pipeline intelligence.',
            },
          }),
          loading: false,
        })
      );

      expect(html).toContain('Dormant');
      expect(html).toContain('Track your first application to unlock pipeline intelligence.');
    });

    it('renders compact mode (Dashboard view) properly', () => {
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: createMockOverview('Active Momentum'),
          loading: false,
          compact: true,
        })
      );

      expect(html).toContain('Pipeline Health');
      expect(html).toContain('Active Momentum');
      expect(html).toContain('href="/applications"');
      expect(html).toContain('Open Tracker');
      // Compact mode should not render full drivers list to stay concise on dashboard
      expect(html).not.toContain('Pipeline Drivers');
    });

    it('renders loading skeleton when loading is true', () => {
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: null,
          loading: true,
        })
      );

      expect(html).toContain('animate-pulse');
      expect(html).not.toContain('Pipeline Health');
    });

    it('renders sanitized error state with Retry button', () => {
      const onRetry = vi.fn();
      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: null,
          loading: false,
          error: 'Application intelligence is temporarily unavailable.',
          onRetry,
        })
      );

      expect(html).toContain('Application Intelligence Unavailable');
      expect(html).toContain('Application intelligence is temporarily unavailable.');
      expect(html).toContain('Retry');
    });
  });

  // =========================================================================
  // 2. APPLICATION FUNNEL CARD & SAMPLE-SIZE CONTRACT TESTS
  // =========================================================================
  describe('2. ApplicationFunnelCard Sample-Size Protection & Strict Pass-Through', () => {
    it('renders all 4 stages with exact backend percentages when sample is sufficient (>=5)', () => {
      const mockFunnelSufficient = {
        totalTracked: 8,
        status: 'sufficient_sample',
        savedToApplied: {
          numerator: 6,
          denominator: 10,
          percentage: 60,
          status: 'available',
        },
        appliedToInterview: {
          numerator: 3,
          denominator: 6,
          percentage: 50,
          status: 'available',
        },
        interviewToSelected: {
          numerator: 1,
          denominator: 3,
          percentage: 33,
          status: 'available',
        },
        overallSelected: {
          numerator: 1,
          denominator: 6,
          percentage: 17,
          status: 'available',
        },
      };

      const html = renderWithRouter(
        React.createElement(ApplicationFunnelCard, {
          funnel: mockFunnelSufficient,
          loading: false,
        })
      );

      expect(html).toContain('Conversion Funnel');
      expect(html).toContain('Pipeline Conversion Metrics');
      expect(html).toContain('Saved → Applied');
      expect(html).toContain('60%');
      expect(html).toContain('Applied → Interview');
      expect(html).toContain('50%');
      expect(html).toContain('Interview → Selection');
      expect(html).toContain('33%');
      expect(html).toContain('Overall Selection');
      expect(html).toContain('17%');
      expect(html).toContain('Sample Threshold: 5+ Apps');
      expect(html).not.toContain('Conversion percentages unlock after tracking 5 applications in this stage.');
    });

    it('strictly suppresses percentage and displays counts when sample is insufficient (<5)', () => {
      const mockFunnelInsufficient = {
        totalTracked: 3,
        status: 'insufficient_sample',
        savedToApplied: {
          numerator: 2,
          denominator: 4,
          percentage: null,
          status: 'insufficient_sample',
        },
        appliedToInterview: {
          numerator: 1,
          denominator: 3,
          percentage: null,
          status: 'insufficient_sample',
        },
        interviewToSelected: {
          numerator: 0,
          denominator: 1,
          percentage: null,
          status: 'insufficient_sample',
        },
        overallSelected: {
          numerator: 0,
          denominator: 3,
          percentage: null,
          status: 'insufficient_sample',
        },
      };

      const html = renderWithRouter(
        React.createElement(ApplicationFunnelCard, {
          funnel: mockFunnelInsufficient,
          loading: false,
        })
      );

      // Percentage numbers MUST NOT be calculated or displayed
      expect(html).not.toContain('33%');
      expect(html).not.toContain('50%');
      expect(html).not.toContain('0%');

      // Numerator / denominator counts and unlock message MUST be displayed
      expect(html).toContain('1 of 3 tracked');
      expect(html).toContain('2 of 4 tracked');
      expect(html).toContain('Small Sample');
      expect(html).toContain('Conversion percentages unlock after tracking 5 applications in this stage.');
      expect(html).toContain('Sample Threshold: 5+ Apps');
    });

    it('handles zero denominators gracefully without crashing or showing NaN', () => {
      const mockFunnelZero = {
        totalTracked: 0,
        status: 'insufficient_sample',
        savedToApplied: {
          numerator: 0,
          denominator: 0,
          percentage: null,
          status: 'insufficient_sample',
        },
        appliedToInterview: {
          numerator: 0,
          denominator: 0,
          percentage: null,
          status: 'insufficient_sample',
        },
        interviewToSelected: {
          numerator: 0,
          denominator: 0,
          percentage: null,
          status: 'insufficient_sample',
        },
        overallSelected: {
          numerator: 0,
          denominator: 0,
          percentage: null,
          status: 'insufficient_sample',
        },
      };

      const html = renderWithRouter(
        React.createElement(ApplicationFunnelCard, {
          funnel: mockFunnelZero,
          loading: false,
        })
      );

      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
      expect(html).toContain('0 of 0 tracked');
    });
  });

  // =========================================================================
  // 3. STALLED APPLICATIONS CARD TESTS
  // =========================================================================
  describe('3. StalledApplicationsCard Traceability & Follow-Up CTA', () => {
    it('renders stalled applications with organization, role title, age in days, and reason', () => {
      const stalled = [
        {
          applicationId: 'app-stripe-1',
          title: 'Senior Backend Engineer',
          organization: 'Stripe',
          ageDays: 21,
          reason: 'No status change for 21 days since applied',
          appliedAt: '2026-09-15T00:00:00.000Z',
        },
        {
          applicationId: 'app-meta-2',
          title: 'Software Engineer Intern',
          organization: 'Meta',
          ageDays: 16,
          reason: 'Awaiting interview feedback for 16 days',
          appliedAt: '2026-09-20T00:00:00.000Z',
        },
      ];

      const actions = [
        {
          actionKey: 'followup:app-stripe-1',
          type: 'application_followup',
          title: 'Follow Up with Stripe',
          applicationId: 'app-stripe-1',
        },
      ];

      const onFollowUp = vi.fn();

      const html = renderWithRouter(
        React.createElement(StalledApplicationsCard, {
          stalledApplications: stalled,
          actions,
          onFollowUp,
          loading: false,
        })
      );

      expect(html).toContain('Stalled Applications');
      expect(html).toContain('2 Stalled');
      expect(html).toContain('Senior Backend Engineer · Stripe');
      expect(html).toContain('21d Stalled');
      expect(html).toContain('No status change for 21 days since applied');

      expect(html).toContain('Software Engineer Intern · Meta');
      expect(html).toContain('16d Stalled');

      // Follow-up CTA button rendered
      expect(html).toContain('Follow Up');
    });

    it('renders positive clear empty state when no applications are stalled', () => {
      const html = renderWithRouter(
        React.createElement(StalledApplicationsCard, {
          stalledApplications: [],
          loading: false,
        })
      );

      expect(html).toContain('Pipeline Active');
      expect(html).toContain('No stalled applications. All active applications have had updates within the last 14 days.');
      expect(html).not.toContain('Stalled Inactivity');
    });
  });

  // =========================================================================
  // 4. OUTCOME INSIGHTS CARD & ROLE/WORK-MODE PATTERNS TESTS
  // =========================================================================
  describe('4. OutcomeInsightsCard Neutrality & Pattern Distributions', () => {
    const mockOutcomes = {
      totalAnalyzed: 10,
      outcomes: {
        total: 10,
        selected: 2,
        rejected: 4,
        withdrawn: 1,
        active: 2,
        interview: 1,
        selectedSkillsDemonstrated: [
          {
            canonicalKey: 'react',
            displayName: 'React',
            count: 2,
          },
          {
            canonicalKey: 'nodejs',
            displayName: 'Node.js',
            count: 1,
          },
        ],
      },
      preparationOutcomeObservations: [
        {
          applicationId: 'app-1',
          title: 'Frontend Engineer',
          organization: 'Vercel',
          outcome: 'Selected',
          prepStatus: 'prep_completed_before_apply',
          summary: 'Preparation tasks were 100% completed prior to submitting application.',
        },
        {
          applicationId: 'app-2',
          title: 'Backend Engineer',
          organization: 'Datadog',
          outcome: 'Rejected',
          prepStatus: 'prep_pending_at_apply',
          summary: 'Preparation tasks were partially incomplete when application was submitted.',
        },
        {
          applicationId: 'app-3',
          title: 'DevOps Engineer',
          organization: 'AWS',
          outcome: 'Active',
          prepStatus: 'no_prep_record',
          summary: 'No structured preparation plan was linked to this application.',
        },
      ],
      rolePatterns: [
        {
          groupKey: 'role:frontend',
          groupLabel: 'Frontend Engineer',
          dimension: 'role',
          applications: 5,
          interviews: 2,
          selected: 1,
          rejected: 2,
        },
        {
          groupKey: 'workMode:remote',
          groupLabel: 'Remote',
          dimension: 'workMode',
          applications: 6,
          interviews: 3,
          selected: 1,
          rejected: 2,
        },
      ],
    };

    it('renders all outcome counters with neutral non-emotional language', () => {
      const html = renderWithRouter(
        React.createElement(OutcomeInsightsCard, {
          outcomes: mockOutcomes,
          loading: false,
        })
      );

      expect(html).toContain('Application Outcomes &amp; Patterns');
      expect(html).toContain('Selected');
      expect(html).toContain('Rejected');
      expect(html).toContain('Withdrawn');
      expect(html).toContain('Active');
      expect(html).toContain('Interview');

      // Factual values
      expect(html).toContain('2');
      expect(html).toContain('4');
      expect(html).toContain('1');

      // Neutral language check: no emotional words
      expect(html).not.toContain('Failure');
      expect(html).not.toContain('Disappointing');
      expect(html).not.toContain('Defeat');
      expect(html).not.toContain('Victory');
    });

    it('renders demonstrated skills in selected opportunities', () => {
      const html = renderWithRouter(
        React.createElement(OutcomeInsightsCard, {
          outcomes: mockOutcomes,
          loading: false,
        })
      );

      expect(html).toContain('Demonstrated Skills in Selected Roles');
      expect(html).toContain('React (2)');
      expect(html).toContain('Node.js (1)');
    });

    it('renders preparation timing observations with non-causal disclaimer', () => {
      const html = renderWithRouter(
        React.createElement(OutcomeInsightsCard, {
          outcomes: mockOutcomes,
          loading: false,
        })
      );

      expect(html).toContain('Preparation Timing Observations');
      expect(html).toContain('Non-causal correlation');
      expect(html).toContain('Prep Completed Before Apply');
      expect(html).toContain('Prep Pending at Apply');
      expect(html).toContain('No Tracked Prep');
    });

    it('renders role and work-mode pattern distributions in a compact list', () => {
      const html = renderWithRouter(
        React.createElement(OutcomeInsightsCard, {
          outcomes: mockOutcomes,
          loading: false,
        })
      );

      expect(html).toContain('Role &amp; Work-Mode Distribution');
      expect(html).toContain('Frontend Engineer');
      expect(html).toContain('5 apps');
      expect(html).toContain('2 interviews');
      expect(html).toContain('1 selected');

      expect(html).toContain('Remote');
      expect(html).toContain('6 apps');
      expect(html).toContain('3 interviews');
    });
  });

  // =========================================================================
  // 5. REJECTION PATTERN CARD & CAUSALITY SAFEGUARD TESTS
  // =========================================================================
  describe('5. RejectionPatternCard Observational Language & Strict Causality Guardrails', () => {
    const mockRejectionPatterns = {
      status: 'available',
      totalRejectedOpportunitiesAnalyzed: 4,
      patterns: [
        {
          canonicalKey: 'typescript',
          displayName: 'TypeScript',
          recurrencePercent: 75,
          rejectedOpportunityCount: 3,
          totalRejectedOpportunitiesAnalyzed: 4,
          candidateEvidence: 'unverified',
          observation: 'Observational Pattern: TypeScript appeared in 3 of your 4 recent rejected opportunities and is currently unverified on your profile.',
        },
        {
          canonicalKey: 'docker',
          displayName: 'Docker',
          recurrencePercent: 50,
          rejectedOpportunityCount: 2,
          totalRejectedOpportunitiesAnalyzed: 4,
          candidateEvidence: 'claimed_only',
          observation: 'Observational Pattern: Docker appeared in 2 of your 4 recent rejected opportunities and is only self-claimed without proof.',
        },
      ],
    };

    it('renders recurring skill observations with exact non-causal backend text', () => {
      const html = renderWithRouter(
        React.createElement(RejectionPatternCard, {
          rejectionPatterns: mockRejectionPatterns,
          loading: false,
        })
      );

      expect(html).toContain('Recurring Skill Observations');
      expect(html).toContain('Observed patterns, not confirmed employer rejection reasons');
      expect(html).toContain('TypeScript');
      expect(html).toContain('75% Recurrence');
      expect(html).toContain('3 of 4 roles');
      expect(html).toContain('Unverified on Profile');
      expect(html).toContain(
        'Observational Pattern: TypeScript appeared in 3 of your 4 recent rejected opportunities and is currently unverified on your profile.'
      );

      expect(html).toContain('Docker');
      expect(html).toContain('50% Recurrence');
      expect(html).toContain('Claimed Only · Demonstration Needed');
      expect(html).toContain(
        'Observational Pattern: Docker appeared in 2 of your 4 recent rejected opportunities and is only self-claimed without proof.'
      );
    });

    it('STRICT CAUSALITY GUARDRAIL: component output contains zero causal claims', () => {
      const html = renderWithRouter(
        React.createElement(RejectionPatternCard, {
          rejectionPatterns: mockRejectionPatterns,
          loading: false,
        })
      );

      // FORBIDDEN CAUSAL PHRASES
      const forbiddenCausalPhrases = [
        'rejected because of',
        'because of your lack',
        'caused your rejection',
        'the reason you were rejected',
        'failed due to',
        'rejection was caused',
        'guaranteed that',
      ];

      for (const phrase of forbiddenCausalPhrases) {
        expect(html.toLowerCase()).not.toContain(phrase);
      }
    });

    it('renders sample-size explanation when rejected sample size is insufficient (<3)', () => {
      const insufficientRejection = {
        status: 'insufficient_sample',
        totalRejectedOpportunitiesAnalyzed: 1,
        message: 'Rejection pattern analysis requires at least 3 rejected applications to identify recurring gaps.',
        patterns: [],
      };

      const html = renderWithRouter(
        React.createElement(RejectionPatternCard, {
          rejectionPatterns: insufficientRejection,
          loading: false,
        })
      );

      expect(html).toContain('Rejection pattern analysis requires at least 3 rejected applications to identify recurring gaps.');
      expect(html).toContain('Currently analyzed: 1 rejected application');
    });

    it('renders clean message when no recurring skill gaps were observed', () => {
      const emptyPatterns = {
        status: 'available',
        totalRejectedOpportunitiesAnalyzed: 4,
        patterns: [],
      };

      const html = renderWithRouter(
        React.createElement(RejectionPatternCard, {
          rejectionPatterns: emptyPatterns,
          loading: false,
        })
      );

      expect(html).toContain('No recurring skill gaps detected across your 4 analyzed rejections.');
      expect(html).toContain('Your demonstrated skills align well with the target requirements for these roles.');
    });
  });

  // =========================================================================
  // 6. ACTION DEDUPLICATION & ROUTING TESTS
  // =========================================================================
  describe('6. Application Actions Deduplication & Routing', () => {
    it('deduplicates visually identical actions sharing the same actionKey', () => {
      const duplicateActions = [
        {
          actionKey: 'followup:app-123',
          type: 'application_followup',
          title: 'Follow Up with Recruiter',
          description: 'Follow up on your application after 15 days.',
          priority: 'High',
          applicationId: 'app-123',
        },
        {
          actionKey: 'followup:app-123', // DUPLICATE KEY
          type: 'application_followup',
          title: 'Follow Up with Recruiter',
          description: 'Follow up on your application after 15 days.',
          priority: 'High',
          applicationId: 'app-123',
        },
      ];

      const html = renderWithRouter(
        React.createElement(ApplicationHealthCard, {
          overview: {
            health: { state: 'Needs Attention', activeCount: 2, stalledCount: 1 },
            actions: duplicateActions,
          },
          loading: false,
        })
      );

      // Should render the top action candidate cleanly once
      const matches = (html.match(/Follow Up with Recruiter/g) || []).length;
      expect(matches).toBe(1);
    });
  });

  // =========================================================================
  // 7. FRONTEND INTELLIGENCE API CLIENT TESTS (intelligenceApi.js)
  // =========================================================================
  describe('7. Frontend Intelligence API Service (intelligenceApi.js)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('getApplicationOverview calls GET /api/intelligence/applications/overview with Bearer token', async () => {
      const mockPayload = {
        success: true,
        overview: {
          health: { state: 'Healthy' },
          funnel: { totalTracked: 5 },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const res = await getApplicationOverview('mock-jwt-token-abc');

      expect(res.success).toBe(true);
      expect(res.overview.health.state).toBe('Healthy');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/applications/overview'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token-abc',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('getApplicationOutcomes calls GET /api/intelligence/applications/outcomes with Bearer token', async () => {
      const mockPayload = {
        success: true,
        outcomes: {
          outcomes: { selected: 1, rejected: 2 },
          rejectionPatterns: { status: 'available' },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const res = await getApplicationOutcomes('mock-jwt-token-abc');

      expect(res.success).toBe(true);
      expect(res.outcomes.outcomes.selected).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/applications/outcomes'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token-abc',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws 401 UNAUTHORIZED when session token is missing before fetch', async () => {
      await expect(getApplicationOverview(null)).rejects.toThrow('Authentication token is required');
      await expect(getApplicationOverview('')).rejects.toThrow('Authentication token is required');
      await expect(getApplicationOutcomes(null)).rejects.toThrow('Authentication token is required');
      await expect(getApplicationOutcomes('')).rejects.toThrow('Authentication token is required');
    });

    it('handles 401 Unauthorized API response with friendly session expired error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, message: 'Invalid or expired token' }),
      });

      try {
        await getApplicationOverview('expired-token');
        expect.unreachable('Should have thrown IntelligenceApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('Your session has expired. Please sign in again.');
      }
    });

    it('handles 500 Server Error API response with sanitized message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ success: false, message: 'Internal server error' }),
      });

      try {
        await getApplicationOverview('valid-token');
        expect.unreachable('Should have thrown IntelligenceApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(500);
        expect(err.code).toBe('SERVER_ERROR');
      }
    });

    it('handles network failure cleanly without exposing sensitive tokens', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error: connection refused'));

      try {
        await getApplicationOverview('secret-token-xyz');
        expect.unreachable('Should have thrown IntelligenceApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.message).toContain('Unable to connect to the Application Intelligence service');
        expect(err.message).not.toContain('secret-token-xyz');
      }
    });
  });

  // =========================================================================
  // 8. CLIENT-SIDE AUDIT & SECURITY TESTS
  // =========================================================================
  describe('8. Zero Client-Side Intelligence Calculation & Browser Storage Security Audit', () => {
    it('verifies component and service code NEVER reference localStorage or sessionStorage', () => {
      const components = [
        ApplicationHealthCard,
        ApplicationFunnelCard,
        StalledApplicationsCard,
        OutcomeInsightsCard,
        RejectionPatternCard,
        getApplicationOverview,
        getApplicationOutcomes,
      ];

      for (const comp of components) {
        const source = comp.toString();
        expect(source).not.toContain('localStorage');
        expect(source).not.toContain('sessionStorage');
      }
    });

    it('verifies frontend code files do not implement conversion formulas or health state derivations', () => {
      const intelligenceDir = path.resolve(__dirname, '../../src/components/intelligence');
      const files = fs.readdirSync(intelligenceDir).filter((f) => f.endsWith('.jsx'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(intelligenceDir, file), 'utf8');

        // Must not contain client conversion formulas: (numerator / denominator) * 100
        expect(content).not.toMatch(/\/\s*denominator\s*\*\s*100/i);
        expect(content).not.toMatch(/numerator\s*\/\s*denominator/i);

        // Must not contain client-derived health thresholds like > 14 days
        expect(content).not.toContain('ageDays > 14');
        expect(content).not.toContain('ageDays >= 14');

        // Must not contain causal rejection phrasing
        expect(content).not.toContain('rejected because');
        expect(content).not.toContain('caused rejection');
      }
    });
  });
});
