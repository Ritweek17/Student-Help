/**
 * CareerOS AI Routes (Phase 11H — B4)
 *
 * Exposes minimal surface for AI Career Coach.
 *
 * Security:
 * - All endpoints strictly require authentication (requireAuth).
 * - Enforces dedicated AI per-user rate limiting (5 req/min, 50 req/day).
 * - Client query is treated strictly as untrusted input.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { getCareerCoachAdvice } from '../controllers/ai.controller.js';

export const aiRouter = Router();

// 1. Authentication enforcement across all AI endpoints
aiRouter.use(requireAuth);

// 2. Dedicated per-user AI rate limiting and daily quota
aiRouter.use(aiLimiter);

// 3. POST /api/ai/career-coach — Career Coach Advice Endpoint
aiRouter.post('/career-coach', getCareerCoachAdvice);
