/**
 * CareerOS AI Controller (Phase 11H — B4)
 *
 * Exposes AI orchestration layer through secure, authenticated HTTP endpoints.
 *
 * Responsibilities:
 * - Extracts verified user identity exclusively from request.auth.userId.
 * - Validates request body with strict schema enforcement.
 * - Invokes ai-orchestration.service.js without duplicating context or calculation.
 * - Returns machine-safe structured responses (HTTP 200 for AI or fallback).
 * - Guarantees zero credential, prompt, context, or stack trace leakage.
 */

import crypto from 'node:crypto';
import { orchestrateCareerCoach } from '../services/ai/ai-orchestration.service.js';
import { validateCareerCoachRequest } from '../validators/ai.validator.js';

/**
 * POST /api/ai/career-coach
 *
 * Computes AI-driven career coach guidance grounded strictly in the user's
 * authoritative CareerOS context, with automatic deterministic fallback.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
export async function getCareerCoachAdvice(request, response) {
  const clientRequestId = request.headers['x-request-id'];
  const requestId = (typeof clientRequestId === 'string' && clientRequestId.trim())
    ? clientRequestId.trim()
    : crypto.randomUUID();

  response.setHeader('X-Request-Id', requestId);

  try {
    const userId = request.auth?.userId;
    if (!userId) {
      return response.status(401).json({
        ok: false,
        category: 'unauthenticated',
        message: 'Authentication required',
        requestId,
      });
    }

    // 1. Strict Request Validation
    const validation = validateCareerCoachRequest(request.body);
    if (!validation.isValid) {
      return response.status(validation.status || 400).json({
        ok: false,
        category: validation.category || 'invalid_request',
        message: validation.message,
        requestId,
      });
    }

    // 2. Invoke Orchestration Service
    // The controller does not calculate intelligence or build TrustedAIContext;
    // orchestration securely retrieves context from career-context.service.js.
    const result = await orchestrateCareerCoach({
      userId,
      userQuery: validation.value.query,
      options: {
        requestId,
      },
    });

    // 3. Return Safe Structured Response
    if (result.ok && result.source === 'ai') {
      return response.status(200).json({
        ok: true,
        source: 'ai',
        data: result.data,
        requestId,
      });
    }

    // Deterministic Fallback Response (HTTP 200)
    return response.status(200).json({
      ok: false,
      source: 'deterministic_fallback',
      reason: result.reason || 'provider_error',
      fallbackData: result.fallbackData,
      requestId,
    });
  } catch (_error) {
    // Defense-in-depth: never leak stack trace or internal system details
    return response.status(500).json({
      ok: false,
      category: 'internal_error',
      message: 'An unexpected internal error occurred while processing career advice.',
      requestId,
    });
  }
}
