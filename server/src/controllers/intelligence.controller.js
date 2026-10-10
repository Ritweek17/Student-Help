import mongoose from 'mongoose';
import * as matchService from '../services/intelligence/match.service.js';
import * as careerReadinessService from '../services/intelligence/career-readiness.service.js';
import { calculateApplicationIntelligence } from '../services/intelligence/application-intelligence.service.js';
import { startInterviewGeneration } from '../services/intelligence/interview.service.js';

/**
 * GET /api/intelligence/opportunities/:id/match
 * 
 * Computes deterministic personalized match between the authenticated user's profile
 * and the requested opportunity.
 */
export async function getOpportunityMatch(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const userId = request.auth.userId;
    const isAdmin = request.auth?.role === 'admin';

    const result = await matchService.getOpportunityMatchForUser(userId, id, isAdmin);

    return response.status(200).json({
      success: true,
      opportunityId: result.opportunityId,
      match: result.match,
    });
  } catch (error) {
    if (error.status === 400 || error.message === 'Invalid opportunity ID') {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (error.status === 404 || error.message === 'Opportunity not found') {
      return response.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }
    return next(error);
  }
}

/**
 * GET /api/intelligence/opportunities/:id/plan
 * 
 * Retrieves preview of derived preparation plan for the opportunity.
 */
export async function getOpportunityPreparationPlan(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const userId = request.auth.userId;
    const isAdmin = request.auth?.role === 'admin';

    const { getPreparationPlanForUser } = await import(
      '../services/intelligence/preparation-plan.service.js'
    );
    const result = await getPreparationPlanForUser(userId, id, isAdmin);

    return response.status(200).json({
      success: true,
      opportunityId: result.opportunityId,
      plan: result.plan,
    });
  } catch (error) {
    if (error.status === 400 || error.message === 'Invalid opportunity ID') {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (error.status === 404 || error.message === 'Opportunity not found') {
      return response.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }
    return next(error);
  }
}

/**
 * POST /api/intelligence/opportunities/:id/plan/generate
 * 
 * Idempotently generates todos, calendar event, and notification for the preparation plan.
 */
export async function generateOpportunityPreparationPlan(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const userId = request.auth.userId;
    const isAdmin = request.auth?.role === 'admin';
    const options = request.body || {};

    const { generatePreparationPlanTodos } = await import(
      '../services/intelligence/preparation-plan.service.js'
    );
    const result = await generatePreparationPlanTodos(userId, id, options, isAdmin);

    return response.status(201).json({
      success: true,
      opportunityId: result.opportunityId,
      createdCount: result.createdCount,
      existingCount: result.existingCount,
      calendarEventCreated: result.calendarEventCreated,
      plan: result.plan,
    });
  } catch (error) {
    if (error.status === 400 || error.message === 'Invalid opportunity ID') {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (error.status === 404 || error.message === 'Opportunity not found') {
      return response.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }
    return next(error);
  }
}

/**
 * POST /api/intelligence/github/sync
 * 
 * Synchronizes GitHub public proof of work for the authenticated user.
 */
export async function syncGitHubEvidence(request, response, next) {
  try {
    const userId = request.auth.userId;
    const options = request.body || {};

    const { syncGitHubForUser } = await import(
      '../services/intelligence/github-sync.service.js'
    );
    const result = await syncGitHubForUser(userId, options);

    return response.status(200).json({
      success: true,
      cached: Boolean(result.cached),
      evidence: result.evidence,
    });
  } catch (error) {
    if (
      error.statusCode === 400 ||
      error.code === 'INVALID_USERNAME' ||
      error.code === 'INVALID_URL' ||
      error.code === 'GITHUB_LINK_MISSING' ||
      error.code === 'INVALID_DOMAIN' ||
      error.code === 'INSECURE_PROTOCOL' ||
      error.code === 'INVALID_PATH'
    ) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.statusCode === 404 || error.code === 'USER_NOT_FOUND') {
      return response.status(404).json({
        success: false,
        message: error.message || 'GitHub user not found',
      });
    }

    if (error.statusCode === 429 || error.code === 'RATE_LIMIT_EXCEEDED' || error.code === 'COOLDOWN_ACTIVE') {
      return response.status(429).json({
        success: false,
        message: error.message || 'GitHub API rate limit exceeded. Please try again later.',
        rateLimit: error.rateLimit || null,
      });
    }

    if (error.statusCode === 403 || error.code === 'FORBIDDEN') {
      return response.status(403).json({
        success: false,
        message: 'GitHub API access forbidden',
      });
    }

    if (error.statusCode === 504 || error.code === 'TIMEOUT') {
      return response.status(504).json({
        success: false,
        message: 'GitHub API request timed out',
      });
    }

    if (
      error.statusCode === 502 ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'MALFORMED_RESPONSE'
    ) {
      return response.status(502).json({
        success: false,
        message: 'Failed to communicate with GitHub API',
      });
    }

    if (error.statusCode === 503 || error.code === 'SERVER_ERROR') {
      return response.status(503).json({
        success: false,
        message: 'GitHub service is temporarily unavailable',
      });
    }

    return next(error);
  }
}

/**
 * GET /api/intelligence/github/evidence
 * 
 * Retrieves cached GitHub proof of work without invoking the external GitHub API.
 */
export async function getGitHubEvidence(request, response, next) {
  try {
    const userId = request.auth.userId;

    const { getGitHubEvidenceForUser } = await import(
      '../services/intelligence/github-sync.service.js'
    );
    const evidence = await getGitHubEvidenceForUser(userId);

    return response.status(200).json({
      success: true,
      evidence,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/intelligence/github/disconnect
 * 
 * Clears cached GitHub proof of work, preserving profile URL unless explicitly requested.
 */
export async function disconnectGitHubEvidence(request, response, next) {
  try {
    const userId = request.auth.userId;
    const clearLink = request.query.clearLink === 'true';

    const { disconnectGitHubForUser } = await import(
      '../services/intelligence/github-sync.service.js'
    );
    const result = await disconnectGitHubForUser(userId, { clearLink });

    return response.status(200).json({
      success: true,
      message: 'GitHub evidence disconnected successfully',
      linkPreserved: result.linkPreserved,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/intelligence/readiness
 * 
 * Computes deterministic Career Readiness snapshot for the authenticated student.
 */
export async function getCareerReadiness(request, response, next) {
  try {
    const userId = request.auth.userId;
    const options = {};
    if (process.env.NODE_ENV === 'test' && request.query?.referenceDate) {
      const parsedDate = new Date(request.query.referenceDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        options.referenceDate = parsedDate;
      }
    }
    const readiness = await careerReadinessService.calculateCareerReadiness(userId, options);

    return response.status(200).json({
      success: true,
      readiness,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/intelligence/applications/overview
 * 
 * Computes deterministic application pipeline health, operational funnel metrics,
 * stalled application alerts, recent activity, and follow-up candidates.
 */
export async function getApplicationOverview(request, response, next) {
  try {
    const userId = request.auth.userId;
    const options = {};
    if (process.env.NODE_ENV === 'test' && request.query?.referenceDate) {
      const parsedDate = new Date(request.query.referenceDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        options.referenceDate = parsedDate;
      }
    }
    const result = await calculateApplicationIntelligence(userId, options);

    return response.status(200).json({
      success: true,
      overview: {
        health: result.health,
        funnel: result.funnel,
        stalledApplications: result.stalledApplications,
        recentActivity: result.recentActivity,
        interviewInsights: result.interviewInsights,
        preparationFeedback: result.preparationFeedback,
        actions: result.actions,
        generatedAt: result.generatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/intelligence/applications/outcomes
 * 
 * Computes deterministic historical outcome analytics, recurring rejection gaps,
 * role/group patterns, funnel conversion metrics, and preparation observations.
 */
export async function getApplicationOutcomes(request, response, next) {
  try {
    const userId = request.auth.userId;
    const options = {};
    if (process.env.NODE_ENV === 'test' && request.query?.referenceDate) {
      const parsedDate = new Date(request.query.referenceDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        options.referenceDate = parsedDate;
      }
    }
    const result = await calculateApplicationIntelligence(userId, options);

    return response.status(200).json({
      success: true,
      outcomes: {
        outcomes: result.outcomes,
        rejectionPatterns: result.rejectionPatterns,
        rolePatterns: result.rolePatterns,
        conversionMetrics: result.funnel,
        preparationOutcomeObservations: result.preparationFeedback,
        generatedAt: result.generatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/intelligence/applications/actions/followups
 * POST /api/intelligence/applications/:applicationId/follow-up
 * 
 * Executes recommended follow-up actions for stalled applications.
 * Idempotently creates Todo and Notification records with 7-day cooldown protection.
 */
export async function executeApplicationFollowUps(request, response, next) {
  try {
    const userId = request.auth.userId;
    const applicationId = request.params.applicationId || request.body?.applicationId || null;

    const options = { applicationId };
    if (process.env.NODE_ENV === 'test') {
      const refDateVal = request.query?.referenceDate || request.body?.referenceDate;
      if (refDateVal) {
        const parsed = new Date(refDateVal);
        if (!isNaN(parsed.getTime())) {
          options.referenceDate = parsed;
        }
      }
    }

    const { executeApplicationFollowUps: runFollowUps } = await import(
      '../services/intelligence/application-followup.service.js'
    );
    const result = await runFollowUps(userId, options);

    return response.status(200).json(result);
  } catch (error) {
    if (
      error.status === 400 ||
      error.message === 'Invalid application ID' ||
      error.message === 'Invalid user ID'
    ) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (error.status === 403 || error.message === 'Application does not belong to user') {
      return response.status(403).json({
        success: false,
        message: 'Application does not belong to user',
      });
    }
    if (error.status === 404 || error.message === 'Application not found') {
      return response.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }
    return next(error);
  }
}

/**
 * POST /api/intelligence/interview/start
 * 
 * Initiates a new Interview Preparation V1 session.
 * Authenticates user, verifies application ownership/eligibility, and returns a signed question envelope.
 */
export async function startInterview(request, response, next) {
  try {
    const userId = request.auth.userId;
    const applicationId = request.body?.applicationId;

    if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid application ID',
      });
    }

    const { envelope, questions } = await startInterviewGeneration(userId, applicationId);

    return response.status(200).json({
      success: true,
      envelope,
      questions,
    });
  } catch (error) {
    if (error.status === 400) {
      return response.status(400).json({ success: false, message: error.message });
    }
    if (error.status === 404) {
      return response.status(404).json({ success: false, message: error.message });
    }
    if (error.status === 503) {
      return response.status(503).json({ success: false, message: error.message });
    }
    return next(error);
  }
}
