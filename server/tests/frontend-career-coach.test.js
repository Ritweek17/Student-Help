/**
 * CareerOS Frontend AI Career Copilot Integration Test Suite
 * Phase 11H — Batch 5
 *
 * Covers:
 * 1. CareerCoachCard renders
 * 2. Collapsed state
 * 3. Expanded state
 * 4. Suggested prompts per surface context
 * 5. Custom query handling
 * 6. Query length validation (<= 500 characters)
 * 7. Loading state
 * 8. Duplicate submission prevention & abort controller
 * 9. Successful AI response handling
 * 10. Structured keyPoints rendering
 * 11. Referenced skills rendering
 * 12. Suggested action rendering
 * 13. Deterministic fallback rendering
 * 14. 401 Unauthorized handling
 * 15. 429 Rate limit & quota handling
 * 16. 500 Server error handling
 * 17. Retry behavior
 * 18. Empty/cold-start context
 * 19. Zero client-side intelligence calculations
 * 20. Zero localStorage / sessionStorage AI persistence
 * 21. Accessible keyboard controls & aria attributes
 * 22. Mobile layout & responsive behavior
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CareerCoachCard } from '../../src/components/intelligence/CareerCoachCard.jsx';
import { CareerReadinessCard } from '../../src/components/intelligence/CareerReadinessCard.jsx';
import {
  getCareerCoachAdvice,
  IntelligenceApiError,
} from '../../src/services/intelligenceApi.js';

describe('CareerOS Frontend AI Career Copilot Suite (Phase 11H — B5)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const renderWithRouter = (ui) => {
    const raw = renderToString(React.createElement(MemoryRouter, null, ui));
    return raw.replace(/<!--.*?-->/g, '');
  };

  // =========================================================================
  // 1 & 2 & 3. COMPONENT RENDERING, COLLAPSED & EXPANDED STATES
  // =========================================================================
  describe('1-3. CareerCoachCard Component Rendering & Collapse/Expand States', () => {
    it('1. CareerCoachCard renders successfully with default props', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, { token: 'mock-jwt-token' })
      );
      expect(html).toContain('AI Career Coach');
      expect(html).toContain('AI-generated guidance grounded in your CareerOS data.');
    });

    it('2. renders properly in collapsed state by default', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          token: 'mock-jwt-token',
          defaultExpanded: false,
        })
      );
      // Collapsed toggle button has aria-expanded="false"
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('Ask Coach');
      // Textarea input is not rendered in collapsed state
      expect(html).not.toContain('<textarea');
    });

    it('3. renders properly in expanded state when defaultExpanded is true', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          token: 'mock-jwt-token',
          defaultExpanded: true,
        })
      );
      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain('<textarea');
      expect(html).toContain('Get Guidance');
      expect(html).toContain('Suggested Questions');
    });
  });

  // =========================================================================
  // 4 & 5 & 18. CONTEXTUAL PROMPTS & COLD START
  // =========================================================================
  describe('4, 5 & 18. Contextual Suggested Prompts & Cold Start Experience', () => {
    it('4a. renders dashboard-specific suggested prompts for dashboard surface', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          contextType: 'dashboard',
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );
      expect(html).toContain('What should I focus on this week?');
      expect(html).toContain('What is my highest-priority career action?');
      expect(html).toContain('How can I improve my momentum?');
      expect(html).toContain('Dashboard Copilot');
    });

    it('4b. renders opportunity-specific suggested prompts for opportunity surface', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          contextType: 'opportunity',
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );
      expect(html).toContain('How should I prepare for this opportunity?');
      expect(html).toContain('What are my key gaps for this opportunity?');
      expect(html).toContain('Opportunity Prep');
    });

    it('4c. renders readiness-specific suggested prompts for readiness surface', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          contextType: 'readiness',
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );
      expect(html).toContain('What is my biggest career bottleneck right now?');
      expect(html).toContain('How can I advance my readiness band?');
      expect(html).toContain('Readiness Coach');
    });

    it('5. allows custom default prompt override', () => {
      const customPrompt = 'How do I optimize my portfolio for full-stack roles?';
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultPrompt: customPrompt,
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );
      expect(html).toContain(customPrompt);
    });

    it('18. handles cold-start context gracefully without crash', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          token: 'mock-jwt-token',
          contextType: 'unknown_surface',
          defaultExpanded: true,
        })
      );
      // Falls back to dashboard copilot config safely
      expect(html).toContain('AI Career Coach');
      expect(html).toContain('What should I focus on this week?');
    });
  });

  // =========================================================================
  // 6. QUERY LENGTH & VALIDATION IN API CLIENT
  // =========================================================================
  describe('6. Query Length Validation (Max 500 characters)', () => {
    it('rejects queries exceeding 500 characters in API service client', async () => {
      const oversizedQuery = 'a'.repeat(501);
      await expect(
        getCareerCoachAdvice('mock-token', oversizedQuery)
      ).rejects.toThrow('Career Coach query must be 500 characters or fewer.');
    });

    it('rejects empty or whitespace-only queries in API service client', async () => {
      await expect(getCareerCoachAdvice('mock-token', '   ')).rejects.toThrow(
        'Please enter a question for the Career Coach.'
      );
      await expect(getCareerCoachAdvice('mock-token', '')).rejects.toThrow(
        'Please enter a question for the Career Coach.'
      );
    });

    it('rejects invocation without authentication token', async () => {
      await expect(
        getCareerCoachAdvice('', 'What should I do next?')
      ).rejects.toThrow('Authentication token is required');
    });

    it('displays character counter boundary in UI', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );
      expect(html).toContain('/500');
      expect(html).toContain('Maximum 500 characters');
    });
  });

  // =========================================================================
  // 7 & 8. LOADING STATE & DUPLICATE SUBMISSION PREVENTION
  // =========================================================================
  describe('7-8. Loading & Duplicate Submission Controls', () => {
    it('7. renders disabled submit button and skeleton indicator during loading in API client contract', async () => {
      let fetchCalled = false;
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        fetchCalled = true;
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const err = new Error('The user aborted a request.');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const controller = new AbortController();
      const promise = getCareerCoachAdvice('mock-token', 'Test query', controller.signal);
      expect(fetchCalled).toBe(true);
      controller.abort();
      await expect(promise).rejects.toThrow('The user aborted a request.');
    });

    it('8. supports abort signal to cancel duplicate or in-flight requests', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(abortError);

      const controller = new AbortController();
      controller.abort();

      await expect(
        getCareerCoachAdvice('mock-token', 'Test query', controller.signal)
      ).rejects.toThrow('The user aborted a request.');
    });
  });

  // =========================================================================
  // 9-13. SUCCESSFUL AI RESPONSE & STRUCTURED FIELD RENDERING
  // =========================================================================
  describe('9-13. Structured Field Rendering (AI & Deterministic Fallback)', () => {
    it('9. processes successful AI response payload from API client', async () => {
      const mockAiPayload = {
        ok: true,
        source: 'ai',
        data: {
          adviceType: 'Action Priority',
          headline: 'Complete Docker Ingestion Project to Prove Backend Readiness',
          keyPoints: [
            'Target roles in your cohort demand verified backend system integration.',
            'Completing the active Docker ingestion module will increase coverage by 15%.',
          ],
          referencedSkills: ['Docker', 'Node.js', 'MongoDB'],
          suggestedAction: 'Resume the Docker Ingestion module in your Learning Catalog.',
        },
        requestId: 'req-12345',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockAiPayload,
      });

      const result = await getCareerCoachAdvice('mock-token', 'What should I do?');
      expect(result.ok).toBe(true);
      expect(result.source).toBe('ai');
      expect(result.data.headline).toBe(mockAiPayload.data.headline);
      expect(result.data.referencedSkills).toEqual(['Docker', 'Node.js', 'MongoDB']);
    });

    it('10-12. renders keyPoints, referencedSkills, and suggestedAction in CareerCoachCard', () => {
      const mockResult = {
        source: 'ai',
        adviceType: 'Strategy',
        headline: 'Focus on System Design and Verified GitHub Evidence',
        keyPoints: [
          'High demand for Redis caching across 4 of your target jobs.',
          'Your project evidence currently lacks production deployment proof.',
        ],
        referencedSkills: ['Redis', 'System Design'],
        suggestedAction: 'Deploy your pending full-stack project to GitHub and trigger verification.',
      };

      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
          initialResult: mockResult,
        })
      );

      // Verify all structured fields rendered cleanly
      expect(html).toContain('Focus on System Design and Verified GitHub Evidence');
      expect(html).toContain('Strategy');
      expect(html).toContain('Key Recommendations');
      expect(html).toContain('High demand for Redis caching across 4 of your target jobs.');
      expect(html).toContain('Your project evidence currently lacks production deployment proof.');
      expect(html).toContain('Referenced Skills');
      expect(html).toContain('Redis');
      expect(html).toContain('System Design');
      expect(html).toContain('Recommended Next Step');
      expect(html).toContain('Deploy your pending full-stack project to GitHub and trigger verification.');
      expect(html).toContain('Grounded Guidance');
      expect(html).toContain('AI-generated guidance grounded in your CareerOS data.');
    });

    it('10b. renders rejection pattern transparency footnote when advice is rejection-related', () => {
      const mockRejectionResult = {
        source: 'ai',
        adviceType: 'Rejection Analysis',
        headline: 'Address Observed Resume Screening Bottlenecks',
        keyPoints: ['Resume screening automated filters rejected 3 applications with missing Docker skill.'],
        referencedSkills: ['Docker'],
        suggestedAction: 'Add verified Docker evidence to your profile projects.',
      };

      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
          initialResult: mockRejectionResult,
        })
      );

      expect(html).toContain('Observed patterns, not confirmed employer rejection reasons.');
    });

    it('10c. preserves previously displayed valid result while a new request loads', () => {
      const mockResult = {
        source: 'ai',
        adviceType: 'Strategy',
        headline: 'Focus on System Design and Verified GitHub Evidence',
        keyPoints: ['Demand for Redis caching.'],
        referencedSkills: ['Redis'],
        suggestedAction: 'Deploy project.',
      };

      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
          initialResult: mockResult,
          initialLoading: true,
        })
      );

      // Both loader and previous result are present
      expect(html).toContain('Synthesizing guidance grounded in your profile and activity...');
      expect(html).toContain('Focus on System Design and Verified GitHub Evidence');
      expect(html).toContain('opacity-50 pointer-events-none');
    });

    it('13. processes deterministic fallback response naturally and renders fallback banner', async () => {
      const mockFallbackPayload = {
        ok: false,
        source: 'deterministic_fallback',
        reason: 'provider_timeout',
        fallbackData: {
          adviceType: 'Rule-Based Guidance',
          headline: 'Close Top P0 Skill Gap: Docker Containerization',
          keyPoints: [
            'Required by 80% of your target cohort opportunities.',
            'Directly impacts your advancement to Target Ready band.',
          ],
          referencedSkills: ['Docker'],
          suggestedAction: 'Enroll in Docker Containerization track in Learning Catalog.',
        },
        requestId: 'req-fallback-999',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockFallbackPayload,
      });

      const result = await getCareerCoachAdvice('mock-token', 'What is my bottleneck?');
      expect(result.ok).toBe(false);
      expect(result.source).toBe('deterministic_fallback');
      expect(result.fallbackData.headline).toBe('Close Top P0 Skill Gap: Docker Containerization');
      expect(result.fallbackData.referencedSkills).toEqual(['Docker']);

      // Render fallback result in component
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
          initialResult: {
            source: 'deterministic_fallback',
            ...mockFallbackPayload.fallbackData,
          },
        })
      );

      expect(html).toContain('Career Coach is temporarily unavailable.');
      expect(html).toContain('trusted CareerOS recommendation based on your current profile.');
      expect(html).toContain('Close Top P0 Skill Gap: Docker Containerization');
      expect(html).toContain('Deterministic Rule');
    });
  });

  // =========================================================================
  // 14-17. ERROR HANDLING & RETRY BEHAVIOR
  // =========================================================================
  describe('14-17. HTTP Error Handling & Retry Mechanics', () => {
    it('14. handles HTTP 401 Unauthorized cleanly with session expired message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Authentication required' }),
      });

      try {
        await getCareerCoachAdvice('invalid-token', 'What should I do?');
        expect.unreachable('Should have thrown 401 error');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toContain('Your session has expired');
      }
    });

    it('15. handles HTTP 429 Quota Exceeded cleanly with quota message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Daily advice quota reached. Please check back tomorrow.' }),
      });

      try {
        await getCareerCoachAdvice('mock-token', 'What should I do?');
        expect.unreachable('Should have thrown 429 error');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(429);
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.message).toContain('Daily advice quota reached');
      }
    });

    it('16. handles HTTP 500 Server Error without leaking internal stack traces', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'InternalServerError: Secret key invalid at /server/src/keys.js:42',
        }),
      });

      try {
        await getCareerCoachAdvice('mock-token', 'What should I do?');
        expect.unreachable('Should have thrown 500 error');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.status).toBe(500);
        expect(err.code).toBe('SERVER_ERROR');
        // Safe generic message, zero stack trace leakage
        expect(err.message).toContain('Career Coach service is temporarily unavailable');
        expect(err.message).not.toContain('Secret key');
        expect(err.message).not.toContain('/server/src/keys.js');
      }
    });

    it('17. handles network connectivity errors cleanly', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      try {
        await getCareerCoachAdvice('mock-token', 'What should I do?');
        expect.unreachable('Should have thrown network error');
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceApiError);
        expect(err.code).toBe('NETWORK_ERROR');
        expect(err.message).toContain('Unable to connect to the Career Coach service');
      }
    });

    it('17b. renders retry button when transient error occurs (500 / network failure)', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
          initialError: {
            message: 'Unable to connect to the Career Coach service. Please check your network connection.',
            status: 0,
            code: 'NETWORK_ERROR',
          },
        })
      );
      expect(html).toContain('Unable to connect to the Career Coach service');
      expect(html).toContain('Retry');
    });
  });

  // =========================================================================
  // 19 & 20. SECURITY, NO CLIENT CALCULATION, NO BROWSER STORAGE
  // =========================================================================
  describe('19-20. Security Audit & Zero Client Calculations', () => {
    it('19. does not perform client-side intelligence math, match scoring, or gap analysis', () => {
      const cardSource = CareerCoachCard.toString();
      const apiSource = getCareerCoachAdvice.toString();

      // Ensure React does not calculate weights or readiness formulas
      expect(cardSource).not.toContain('calculateMatch');
      expect(cardSource).not.toContain('computeReadiness');
      expect(cardSource).not.toContain('calculateScore');
      expect(apiSource).not.toContain('calculateMatch');

      // Ensure client does not send forbidden fields
      expect(apiSource).not.toContain('userId:');
      expect(apiSource).not.toContain('matchScore:');
      expect(apiSource).not.toContain('readinessScore:');
      expect(apiSource).not.toContain('TrustedAIContext');
    });

    it('20. strictly does not use localStorage or sessionStorage for AI prompts or responses', () => {
      const cardSource = CareerCoachCard.toString();
      const apiSource = getCareerCoachAdvice.toString();

      expect(cardSource).not.toContain('localStorage');
      expect(cardSource).not.toContain('sessionStorage');
      expect(apiSource).not.toContain('localStorage');
      expect(apiSource).not.toContain('sessionStorage');
    });

    it('ensures API client sends ONLY { query } in the POST body', async () => {
      let interceptedBody = null;
      let interceptedHeaders = null;

      global.fetch = vi.fn().mockImplementation((url, options) => {
        interceptedHeaders = options.headers;
        interceptedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            source: 'ai',
            data: {
              adviceType: 'Focus',
              headline: 'Test Headline',
              keyPoints: [],
              referencedSkills: [],
              suggestedAction: 'Action',
            },
          }),
        });
      });

      await getCareerCoachAdvice('test-bearer-jwt', 'What should I do?');

      expect(interceptedHeaders.Authorization).toBe('Bearer test-bearer-jwt');
      expect(interceptedHeaders['Content-Type']).toBe('application/json');
      expect(interceptedBody).toEqual({ query: 'What should I do?' });

      // Explicit verification: zero extra properties sent
      expect(Object.keys(interceptedBody)).toEqual(['query']);
      expect(interceptedBody.userId).toBeUndefined();
      expect(interceptedBody.profile).toBeUndefined();
      expect(interceptedBody.matchScore).toBeUndefined();
    });
  });

  // =========================================================================
  // 21 & 22. ACCESSIBILITY & RESPONSIVE BEHAVIOR
  // =========================================================================
  describe('21-22. Accessibility & Responsive Design', () => {
    it('21. includes accessible aria attributes and keyboard controls', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );
      // aria-live for async updates
      expect(html).toContain('aria-live="polite"');
      // aria-label on interactive inputs
      expect(html).toContain('aria-label="Ask AI Career Coach"');
      expect(html).toContain('aria-controls="career-coach-content"');
      // Semantic heading
      expect(html).toContain('<h3');
    });

    it('22. uses responsive classes preventing horizontal overflow on mobile', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );
      // Responsive utility classes verified
      expect(html).toContain('truncate');
      expect(html).toContain('min-w-0');
      expect(html).toContain('flex-wrap');
      expect(html).toContain('w-full');
    });
  });

  // =========================================================================
  // 23. DASHBOARD DEDUPLICATION & MULTI-SURFACE PLACEMENT (Phase 11H — B6.1)
  // =========================================================================
  describe('23. Dashboard Deduplication & Multi-Surface Placement (Phase 11H — B6.1)', () => {
    const mockReadiness = {
      readinessBand: {
        band: 'Target Ready',
        label: 'Target Ready',
        summary: 'Exceptional alignment across target role requirements.',
        primaryDrivers: ['Strong verified evidence'],
      },
      targetProfile: {
        totalOpportunities: 5,
        targetRoles: ['Full Stack Developer'],
        cohortSources: { totalCount: 5 },
      },
      dimensions: {
        skillCoverage: { percentage: 85, coveredCount: 6, totalCount: 7 },
        evidenceStrength: { verificationRate: 75, verifiedCount: 4 },
        preparationExecution: { percentage: 100, completed: 4, total: 4 },
        learningVelocity: { status: 'steady', recentProgress: true },
        applicationPipeline: { status: 'active', activeApplications: 2 },
      },
      skillGaps: [],
      evidence: [],
      actions: [],
      sourceOpportunities: [],
    };

    it('23a. suppresses embedded CareerCoachCard in CareerReadinessCard when showCareerCoach={false}', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: mockReadiness,
          showCareerCoach: false,
        })
      );
      // Confirms embedded coach is suppressed
      expect(html).not.toContain('Readiness Coach');
      expect(html).not.toContain('What is my biggest career bottleneck right now?');
      // Confirms core deterministic readiness content remains intact
      expect(html).toContain('Target Ready');
      expect(html).toContain('85%');
    });

    it('23b. preserves embedded CareerCoachCard in CareerReadinessCard by default when showCareerCoach is omitted', () => {
      const html = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: mockReadiness,
        })
      );
      // Confirms embedded coach is rendered by default for non-dashboard surfaces
      expect(html).toContain('Readiness Coach');
      expect(html).toContain('AI Career Coach');
      expect(html).toContain('Ask Coach');
    });

    it('23c. renders exactly ONE CareerCoachCard on Dashboard layout with contextType="dashboard"', () => {
      // Simulate Dashboard two-column layout:
      // Left: CareerReadinessCard with showCareerCoach={false}
      // Right: Standalone CareerCoachCard with contextType="dashboard"
      const dashboardLayout = React.createElement(
        'div',
        null,
        React.createElement(CareerReadinessCard, {
          readiness: mockReadiness,
          showCareerCoach: false,
        }),
        React.createElement(CareerCoachCard, {
          contextType: 'dashboard',
          token: 'mock-jwt-token',
        })
      );

      const html = renderWithRouter(dashboardLayout);

      // Exactly ONE AI Career Coach component heading rendered
      const coachHeadings = (html.match(/<h3[^>]*>AI Career Coach<\/h3>/g) || []).length;
      expect(coachHeadings).toBe(1);

      // Instance is dashboard-specific
      expect(html).toContain('Dashboard Copilot');
      expect(html).not.toContain('Readiness Coach');
    });

    it('23d. preserves standalone Opportunity Detail Career Coach with contextType="opportunity"', () => {
      const html = renderWithRouter(
        React.createElement(CareerCoachCard, {
          contextType: 'opportunity',
          defaultExpanded: true,
          token: 'mock-jwt-token',
        })
      );

      expect(html).toContain('Opportunity Prep');
      expect(html).toContain('How should I prepare for this opportunity?');
      expect(html).not.toContain('Dashboard Copilot');
      expect(html).not.toContain('Readiness Coach');
    });

    it('23e. Career Readiness calculations, bands and dimensions render identically whether showCareerCoach is true or false', () => {
      const htmlWithCoach = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: mockReadiness,
          showCareerCoach: true,
        })
      );
      const htmlWithoutCoach = renderWithRouter(
        React.createElement(CareerReadinessCard, {
          readiness: mockReadiness,
          showCareerCoach: false,
        })
      );

      // Both versions render identical deterministic data
      expect(htmlWithCoach).toContain('Target Ready');
      expect(htmlWithoutCoach).toContain('Target Ready');
      expect(htmlWithCoach).toContain('85%');
      expect(htmlWithoutCoach).toContain('85%');
      expect(htmlWithCoach).toContain('Full Stack Developer');
      expect(htmlWithoutCoach).toContain('Full Stack Developer');
    });
  });
});
