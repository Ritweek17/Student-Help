import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CareerReadinessCard } from '../../src/components/intelligence/CareerReadinessCard.jsx';
import { EvidenceMatrix } from '../../src/components/intelligence/EvidenceMatrix.jsx';
import {
  getCareerReadiness,
  IntelligenceApiError,
} from '../../src/services/intelligenceApi.js';

describe('CareerOS Frontend Career Readiness Mission Control Suite (Phase 11F Batch 4)', () => {
  // Helper to render with MemoryRouter and strip React SSR comment delimiters
  const renderWithRouter = (ui) => {
    const raw = renderToString(React.createElement(MemoryRouter, null, ui));
    return raw.replace(/<!--.*?-->/g, '');
  };

  // =========================================================================
  // 1. CAREER READINESS CARD COMPONENT TESTS
  // =========================================================================
  describe('1. CareerReadinessCard Component Bands, Dimensions & States', () => {
    const baseMockReadiness = {
      readinessBand: {
        band: 'Target Ready',
        label: 'Target Ready',
        summary: 'Exceptional alignment across target role requirements with robust verified evidence.',
        primaryDrivers: [
          'Strong verified evidence for required skills',
          'Active engagement in high-impact learning tasks',
        ],
      },
      targetProfile: {
        totalOpportunities: 5,
        targetRoles: ['Full Stack Developer', 'Software Engineer'],
        cohortSources: {
          savedCount: 3,
          appliedCount: 2,
          fallbackCount: 0,
          totalCount: 5,
        },
      },
      dimensions: {
        skillCoverage: {
          percentage: 85,
          coveredCount: 6,
          totalCount: 7,
          missingCount: 1,
        },
        evidenceStrength: {
          verificationRate: 75,
          verifiedCount: 4,
          demonstratedCount: 2,
          practicingCount: 1,
          claimedOnlyCount: 0,
        },
        preparationExecution: {
          percentage: 100,
          completed: 4,
          total: 4,
        },
        learningVelocity: {
          status: 'active',
          relevantActiveItems: 2,
          relevantCompletedItems: 1,
          recentProgress: true,
        },
        applicationPipeline: {
          status: 'active',
          activeApplications: 3,
        },
      },
      skillGaps: [
        {
          canonicalKey: 'typescript',
          displayName: 'TypeScript',
          priority: 'P0',
          impactPercent: 80,
          requiredByOpportunityCount: 4,
        },
        {
          canonicalKey: 'docker',
          displayName: 'Docker',
          priority: 'P1',
          impactPercent: 60,
          requiredByOpportunityCount: 3,
        },
      ],
      actions: [
        {
          actionKey: 'gap:typescript',
          type: 'skill_gap',
          priority: 'High',
          title: 'Learn TypeScript',
          description: 'Study TypeScript to close a critical requirement for 4 target roles.',
        },
        {
          actionKey: 'prep:portfolio',
          type: 'prep_execution',
          priority: 'Medium',
          title: 'Complete preparation tasks',
          description: 'Finish scheduled technical review tasks for your saved roles.',
        },
        {
          actionKey: 'github:refresh',
          type: 'github_refresh',
          priority: 'Medium',
          title: 'Sync GitHub Proof',
          description: 'Refresh repository proof to reflect recent commits.',
        },
      ],
      sourceOpportunities: [
        {
          id: 'opp-1',
          title: 'Senior Frontend Engineer',
          organization: 'FinTech Global',
        },
      ],
    };

    it('renders Target Ready band correctly with primary drivers and badge', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: baseMockReadiness,
          loading: false,
          error: null,
        })
      );

      expect(html).toContain('Career Readiness Mission Control');
      expect(html).toContain('Target Ready');
      expect(html).toContain('Exceptional alignment across target role requirements');
      expect(html).toContain('Strong verified evidence for required skills');
      expect(html).toContain('Active engagement in high-impact learning tasks');
      expect(html).not.toContain('NaN');
    });

    it('renders Advancing band correctly', () => {
      const advancingData = {
        ...baseMockReadiness,
        readinessBand: {
          band: 'Advancing',
          label: 'Advancing',
          summary: 'Solid progress towards target profile readiness.',
          primaryDrivers: ['Strong project demonstrations'],
        },
      };

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: advancingData,
          loading: false,
        })
      );

      expect(html).toContain('Advancing');
      expect(html).toContain('Solid progress towards target profile readiness.');
      expect(html).toContain('Strong project demonstrations');
    });

    it('renders Developing band correctly', () => {
      const developingData = {
        ...baseMockReadiness,
        readinessBand: {
          band: 'Developing',
          label: 'Developing',
          summary: 'Foundational capabilities established with key skill gaps remaining.',
          primaryDrivers: ['Core skills in development'],
        },
      };

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: developingData,
          loading: false,
        })
      );

      expect(html).toContain('Developing');
      expect(html).toContain('Foundational capabilities established with key skill gaps remaining.');
    });

    it('renders Early Stage band correctly', () => {
      const earlyData = {
        ...baseMockReadiness,
        readinessBand: {
          band: 'Early Stage',
          label: 'Early Stage',
          summary: 'Early in profile development and target role alignment.',
          primaryDrivers: ['Initial learning underway'],
        },
      };

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: earlyData,
          loading: false,
        })
      );

      expect(html).toContain('Early Stage');
      expect(html).toContain('Early in profile development and target role alignment.');
    });

    it('renders all Five Dimensions strictly from backend data', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: baseMockReadiness,
          loading: false,
        })
      );

      // Dimension 1: Skill Coverage
      expect(html).toContain('Skill Coverage');
      expect(html).toContain('85%');
      expect(html).toContain('>6</span> / 7 core skills covered');

      // Dimension 2: Evidence Strength
      expect(html).toContain('Evidence Strength');
      expect(html).toContain('75%');
      expect(html).toContain('>4</span> verified · 2 project');

      // Dimension 3: Preparation Tasks
      expect(html).toContain('Preparation Tasks');
      expect(html).toContain('100%');
      expect(html).toContain('>4</span> / 4 tasks done');

      // Dimension 4: Learning Velocity
      expect(html).toContain('Learning Velocity');
      expect(html).toContain('active');
      expect(html).toContain('>2</span> active · 1 finished');

      // Dimension 5: Application Pipeline
      expect(html).toContain('Application Pipeline');
      expect(html).toContain('>3</span> active applications');
    });

    it('renders top skill gaps with priority badges and target frequency impact', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: baseMockReadiness,
          loading: false,
        })
      );

      expect(html).toContain('High-Impact Skill Gaps');
      expect(html).toContain('TypeScript');
      expect(html).toContain('P0 · Critical');
      expect(html).toContain('Required by 4 of 5 target roles (80%)');

      expect(html).toContain('Docker');
      expect(html).toContain('P1 · High');
      expect(html).toContain('Required by 3 of 5 target roles (60%)');
    });

    it('renders empty skill gaps state gracefully', () => {
      const noGapsData = {
        ...baseMockReadiness,
        skillGaps: [],
      };

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: noGapsData,
          loading: false,
        })
      );

      expect(html).toContain('No high-impact skill gaps identified!');
      expect(html).toContain('Your profile covers all core technical skills');
    });

    it('renders recommended actions with correct links and CTA buttons', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: baseMockReadiness,
          loading: false,
        })
      );

      expect(html).toContain('Recommended Readiness Actions');
      expect(html).toContain('Learn TypeScript');
      expect(html).toContain('href="/learning"');
      expect(html).toContain('Learn in Catalog');

      expect(html).toContain('Complete preparation tasks');
      expect(html).toContain('href="/todos"');
      expect(html).toContain('Open Prep Tasks');

      expect(html).toContain('Sync GitHub Proof');
      expect(html).toContain('href="/profile"');
      expect(html).toContain('Sync GitHub Proof');
    });

    it('renders target opportunity cohort transparency section', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: baseMockReadiness,
          loading: false,
        })
      );

      expect(html).toContain('Targeting:');
      expect(html).toContain('Full Stack Developer');
      expect(html).toContain('Software Engineer');
      expect(html).toContain('Top target: Senior Frontend Engineer (FinTech Global)');
      expect(html).toContain('href="/saved"');
      expect(html).toContain('Manage Target Roles');
    });

    it('renders cold-start guidance banner for users with zero target opportunities', () => {
      const coldStartData = {
        ...baseMockReadiness,
        readinessBand: {
          band: 'Early Stage',
          label: 'Early Stage',
          summary: 'Early in profile development.',
          primaryDrivers: [],
        },
        targetProfile: {
          totalOpportunities: 0,
          targetRoles: [],
          cohortSources: {
            savedCount: 0,
            appliedCount: 0,
            fallbackCount: 0,
            totalCount: 0,
          },
          guidance: 'Save 3 target opportunities to personalize your career readiness.',
        },
      };

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: coldStartData,
          loading: false,
        })
      );

      expect(html).toContain('Personalize Your Career Readiness');
      expect(html).toContain('Save 3 target opportunities to personalize your career readiness.');
      expect(html).toContain('Explore Opportunities');
      expect(html).toContain('href="/opportunities"');
    });

    it('renders fallback preference banner when cohort is derived from preferences', () => {
      const fallbackData = {
        ...baseMockReadiness,
        targetProfile: {
          totalOpportunities: 4,
          targetRoles: ['Backend Engineer'],
          cohortSources: {
            savedCount: 0,
            appliedCount: 0,
            fallbackCount: 4,
            totalCount: 4,
          },
          guidance: 'Showing estimated readiness based on active postings matching your career preferences.',
        },
      };

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: fallbackData,
          loading: false,
        })
      );

      expect(html).toContain('Estimated from Career Preferences');
      expect(html).toContain('Showing estimated readiness based on active postings matching your career preferences.');
      expect(html).toContain('Target requirements are currently estimated from published postings');
      expect(html).toContain('4 preference matches');
    });

    it('renders loading skeleton without layout shift or fake percentages', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          loading: true,
        })
      );

      expect(html).toContain('animate-pulse');
      expect(html).not.toContain('85%');
      expect(html).not.toContain('Target Ready');
    });

    it('renders error state with retry button and sanitized human message', () => {
      let retried = false;
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          loading: false,
          error: 'Career readiness is temporarily unavailable.',
          onRetry: () => { retried = true; },
        })
      );

      expect(html).toContain('Career readiness is temporarily unavailable.');
      expect(html).toContain('load your personalized readiness intelligence.');
      expect(html).toContain('Retry');
      // Must not leak sensitive stack traces
      expect(html).not.toContain('MongooseError');
      expect(html).not.toContain('CastError');
      expect(html).not.toContain('stack');
    });
  });

  // =========================================================================
  // 2. FRONTEND API SERVICE TESTS (intelligenceApi.js)
  // =========================================================================
  describe('2. Frontend Intelligence API Service (intelligenceApi.js)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('getCareerReadiness calls GET /api/intelligence/readiness with Authorization Bearer header', async () => {
      const mockPayload = {
        success: true,
        readiness: {
          readinessBand: { band: 'Advancing' },
          dimensions: {},
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const res = await getCareerReadiness('test-session-token');

      expect(res.success).toBe(true);
      expect(res.readiness.readinessBand.band).toBe('Advancing');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/readiness'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-session-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws 401 UNAUTHORIZED when session token is missing before fetch', async () => {
      await expect(getCareerReadiness(null)).rejects.toThrow('Authentication token is required');
      await expect(getCareerReadiness('')).rejects.toThrow('Authentication token is required');
    });

    it('handles 401 Unauthorized API response with friendly session expired error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, message: 'Invalid or expired token' }),
      });

      try {
        await getCareerReadiness('expired-token');
        expect.unreachable('Should have thrown IntelligenceApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('Your session has expired. Please sign in again.');
      }
    });

    it('handles 404 Not Found API response cleanly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ success: false, message: 'Profile not found' }),
      });

      try {
        await getCareerReadiness('token-123');
        expect.unreachable('Should have thrown IntelligenceApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(404);
        expect(err.message).toBe('Profile not found');
      }
    });

    it('handles 500 Server Error API response with sanitized message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ success: false, message: 'Internal server error' }),
      });

      try {
        await getCareerReadiness('token-123');
        expect.unreachable('Should have thrown IntelligenceApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(500);
        expect(err.code).toBe('SERVER_ERROR');
      }
    });

    it('handles network failure cleanly without exposing sensitive tokens', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      try {
        await getCareerReadiness('secret-user-token-xyz');
        expect.unreachable('Should have thrown IntelligenceApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.message).toContain('Unable to connect to the Career Readiness service');
        expect(err.message).not.toContain('secret-user-token-xyz');
      }
    });
  });

  // =========================================================================
  // 3. ACTION ROUTE MAPPINGS
  // =========================================================================
  describe('3. Action Type Route Mappings', () => {
    it('verifies all expected action types map to verified CareerOS routes', () => {
      const actionsToTest = [
        { actionKey: '1', type: 'skill_gap', title: 'A', description: 'D', priority: 'High' },
        { actionKey: '2', type: 'strengthen_evidence', title: 'B', description: 'D', priority: 'Medium' },
        { actionKey: '3', type: 'github_refresh', title: 'C', description: 'D', priority: 'Medium' },
        { actionKey: '4', type: 'prep_execution', title: 'D', description: 'D', priority: 'Low' },
        { actionKey: '5', type: 'application_followup', title: 'E', description: 'D', priority: 'High' },
        { actionKey: '6', type: 'submit_application', title: 'F', description: 'D', priority: 'High' },
        { actionKey: '7', type: 'explore_opportunities', title: 'G', description: 'D', priority: 'Low' },
      ];

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: {
            readinessBand: { band: 'Developing' },
            targetProfile: { totalOpportunities: 2 },
            dimensions: {},
            skillGaps: [],
            actions: actionsToTest,
          },
          loading: false,
        })
      );

      expect(html).toContain('href="/learning"');
      expect(html).toContain('href="/profile"');
      expect(html).toContain('href="/todos"');
      expect(html).toContain('href="/applications"');
      expect(html).toContain('href="/opportunities"');
    });
  });

  // =========================================================================
  // 4. SECURITY & CLIENT-SIDE AUDIT
  // =========================================================================
  describe('4. Security & Zero Client Calculation Verification', () => {
    it('does not recompute percentages, bands, or metrics independently', () => {
      // Backend supplies explicit 42% coverage and 'Developing' band
      const customReadiness = {
        readinessBand: {
          band: 'Developing',
          label: 'Developing',
          summary: 'Testing strict pass-through.',
        },
        targetProfile: { totalOpportunities: 10 },
        dimensions: {
          skillCoverage: { percentage: 42, coveredCount: 3, totalCount: 7 },
          evidenceStrength: { verificationRate: 33, verifiedCount: 1, demonstratedCount: 0 },
          preparationExecution: { percentage: 50, completed: 1, total: 2 },
          learningVelocity: { status: 'paused', relevantActiveItems: 0, relevantCompletedItems: 0 },
          applicationPipeline: { status: 'dormant', activeApplications: 0 },
        },
        skillGaps: [],
        actions: [],
      };

      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: customReadiness,
          loading: false,
        })
      );

      // Verify exact backend percentage is passed through without recalculation
      expect(html).toContain('42%');
      expect(html).toContain('33%');
      expect(html).toContain('50%');
      expect(html).toContain('Developing');
    });

    it('verifies component and service code do not reference browser storage', () => {
      const cardSource = CareerReadinessCard.toString();
      const apiSource = getCareerReadiness.toString();

      expect(cardSource).not.toContain('localStorage');
      expect(cardSource).not.toContain('sessionStorage');
      expect(apiSource).not.toContain('localStorage');
      expect(apiSource).not.toContain('sessionStorage');
    });
  });

  // =========================================================================
  // 5. PROFILE EVIDENCE MATRIX TESTS
  // =========================================================================
  describe('5. Profile EvidenceMatrix Component Tests', () => {
    it('renders all four proof tiers: verified, demonstrated, practicing, claimed', () => {
      const mockEvidence = [
        {
          canonicalKey: 'react',
          displayName: 'React',
          category: 'technical',
          evidenceStrength: 'verified',
          topProof: {
            type: 'github',
            name: 'react-portfolio-app',
          },
          sources: {
            githubVerified: true,
            portfolioProject: true,
            claimed: true,
          },
        },
        {
          canonicalKey: 'python',
          displayName: 'Python',
          category: 'technical',
          evidenceStrength: 'demonstrated',
          topProof: {
            type: 'project',
            title: 'Algorithmic Trading Bot',
          },
          sources: {
            githubVerified: false,
            portfolioProject: true,
            claimed: true,
          },
        },
        {
          canonicalKey: 'machine_learning',
          displayName: 'Machine Learning',
          category: 'domain',
          evidenceStrength: 'practicing',
          topProof: {
            type: 'curriculum',
          },
          sources: {
            githubVerified: false,
            portfolioProject: false,
            claimed: false,
          },
        },
        {
          canonicalKey: 'graphql',
          displayName: 'GraphQL',
          category: 'technical',
          evidenceStrength: 'claimed',
          topProof: {
            type: 'profile_claim',
            proficiency: 'intermediate',
          },
          sources: {
            githubVerified: false,
            portfolioProject: false,
            claimed: true,
          },
        },
      ];

      const html = renderWithRouter(
        React.createElement(EvidenceMatrix, { evidence: mockEvidence })
      );

      // Header
      expect(html).toContain('Evidence Strength Matrix (4)');
      expect(html).toContain('Strongest verified proof for your target and claimed skills');

      // Tier 1: GitHub Verified
      expect(html).toContain('React');
      expect(html).toContain('GitHub Verified');
      expect(html).toContain('Repo: react-portfolio-app');

      // Tier 2: Project Demonstrated
      expect(html).toContain('Python');
      expect(html).toContain('Project Demonstrated');
      expect(html).toContain('Project: Algorithmic Trading Bot');

      // Tier 3: Curriculum Practicing
      expect(html).toContain('Machine Learning');
      expect(html).toContain('Curriculum Practicing');
      expect(html).toContain('Enrolled Learning Track');

      // Tier 4: Self-Claimed
      expect(html).toContain('GraphQL');
      expect(html).toContain('Self-Claimed');
      expect(html).toContain('Listed with intermediate proficiency');

      // Does not contain inflated or forbidden certification labels
      expect(html).not.toContain('Guaranteed');
      expect(html).not.toContain('Certified');
    });

    it('renders null gracefully when evidence array is empty or undefined', () => {
      const htmlEmpty = renderWithRouter(
        React.createElement(EvidenceMatrix, { evidence: [] })
      );
      expect(htmlEmpty).toBe('');

      const htmlNull = renderWithRouter(
        React.createElement(EvidenceMatrix, { evidence: null })
      );
      expect(htmlNull).toBe('');
    });
  });
});
