import { Router } from 'express';
import {
  getOpportunityMatch,
  getOpportunityPreparationPlan,
  generateOpportunityPreparationPlan,
  syncGitHubEvidence,
  getGitHubEvidence,
  disconnectGitHubEvidence,
  getCareerReadiness,
  getApplicationOverview,
  getApplicationOutcomes,
  executeApplicationFollowUps,
} from '../controllers/intelligence.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { githubSyncLimiter } from '../middleware/rateLimiter.js';

export const intelligenceRouter = Router();

// Intelligence endpoints strictly require authentication
intelligenceRouter.use(requireAuth);

// -------------------------------------------------------------
// Application Intelligence & Outcome Feedback Endpoints (Phase 11G)
// -------------------------------------------------------------

// GET /api/intelligence/applications/overview (Pipeline Health & Operational Overview)
intelligenceRouter.get('/applications/overview', getApplicationOverview);

// GET /api/intelligence/applications/outcomes (Outcome Analytics & Rejection Gaps)
intelligenceRouter.get('/applications/outcomes', getApplicationOutcomes);

// POST /api/intelligence/applications/actions/followups (Execute Follow-Up Actions)
intelligenceRouter.post('/applications/actions/followups', executeApplicationFollowUps);

// POST /api/intelligence/applications/:applicationId/follow-up (Execute Single Follow-Up Action)
intelligenceRouter.post('/applications/:applicationId/follow-up', executeApplicationFollowUps);

// -------------------------------------------------------------
// Career Profile Readiness Intelligence Endpoint (Phase 11F)
// -------------------------------------------------------------

// GET /api/intelligence/readiness (Career Profile Readiness Snapshot)
intelligenceRouter.get('/readiness', getCareerReadiness);

// GET /api/intelligence/opportunities/:id/match
intelligenceRouter.get('/opportunities/:id/match', getOpportunityMatch);

// GET /api/intelligence/opportunities/:id/plan (Plan Preview)
intelligenceRouter.get('/opportunities/:id/plan', getOpportunityPreparationPlan);

// POST /api/intelligence/opportunities/:id/plan/generate (Idempotent Execution)
intelligenceRouter.post('/opportunities/:id/plan/generate', generateOpportunityPreparationPlan);

// -------------------------------------------------------------
// GitHub Proof of Work Intelligence Endpoints (Phase 11E)
// -------------------------------------------------------------

// POST /api/intelligence/github/sync (Synchronize and refresh proof of work)
intelligenceRouter.post('/github/sync', githubSyncLimiter, syncGitHubEvidence);

// GET /api/intelligence/github/evidence (Retrieve cached proof of work)
intelligenceRouter.get('/github/evidence', getGitHubEvidence);

// DELETE /api/intelligence/github/disconnect (Disconnect and clear cached proof)
intelligenceRouter.delete('/github/disconnect', disconnectGitHubEvidence);


