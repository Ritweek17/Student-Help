/**
 * CareerOS AI Orchestration Service (Phase 11H — B3, Refactored 11I — B3.2A)
 *
 * Coordinates the execution of AI capabilities:
 * 1. Shared generic `orchestrateAI` core for timeout, retry, validation, and telemetry.
 * 2. Backward-compatible `orchestrateCareerCoach` wrapping the core.
 *
 * Guarantees:
 * - Deterministic CareerOS intelligence is never duplicated or modified.
 * - Client cannot override trusted context, scores, or skill gaps.
 * - Non-causal rules and safety contracts are strictly enforced.
 * - Defense-in-depth prompt injection controls are applied across boundaries.
 * - Telemetry is sanitized (no PII, no raw prompts, no raw models responses logged).
 */

import crypto from 'node:crypto';
import { getTrustedAIContextForUser, buildTrustedAIContext } from '../intelligence/career-context.service.js';
import { getAIProvider } from './production-adapter.seam.js';
import { buildCareerCoachPromptV1, PROMPT_VERSION } from './prompts/career-coach.v1.js';
import { validateAIOutputPipeline } from './validation/output-validator.js';
import { LLMProviderError, LLMTimeoutError } from './llm-provider.interface.js';

export const DEFAULT_AI_TIMEOUT_MS = 6000;
export const MAX_AI_RETRIES = 1;

/**
 * Machine-safe fallback reason categories.
 */
export const FALLBACK_REASONS = Object.freeze({
  PROVIDER_TIMEOUT: 'provider_timeout',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  PROVIDER_ERROR: 'provider_error',
  INVALID_JSON: 'invalid_json',
  SCHEMA_INVALID: 'schema_invalid',
  GROUNDING_FAILED: 'grounding_failed',
  UNSAFE_OUTPUT: 'unsafe_output',
  QUOTA_EXCEEDED: 'quota_exceeded',
  CONTEXT_RETRIEVAL_FAILED: 'context_retrieval_failed',
});

/**
 * Sanitized operational telemetry logger.
 * Never logs raw prompts, model text, context, or user queries.
 *
 * @param {Object} telemetry
 */
export function logAITelemetry(telemetry) {
  const safeLog = {
    timestamp: new Date().toISOString(),
    requestId: telemetry.requestId || 'unknown',
    provider: telemetry.provider || 'unknown',
    model: telemetry.model || 'unknown',
    latencyMs: typeof telemetry.latencyMs === 'number' ? telemetry.latencyMs : null,
    success: Boolean(telemetry.success),
    category: telemetry.category || (telemetry.success ? 'success' : 'failure'),
    retriesAttempted: telemetry.retriesAttempted || 0,
    promptVersion: telemetry.promptVersion || 'unknown',
  };

  // Structured telemetry output
  if (process.env.NODE_ENV !== 'test') {
    if (safeLog.success) {
      console.info('[AI Telemetry]', JSON.stringify(safeLog));
    } else {
      console.warn('[AI Telemetry Warning]', JSON.stringify(safeLog));
    }
  }

  return safeLog;
}

/**
 * Generic AI Orchestration Core (Phase 11I - B3.2A)
 *
 * Provides shared timeout, retry, telemetry, and validation logic
 * without coupling to specific operation prompts or schemas.
 *
 * @param {Object} operation - Trusted server-side operation contract
 * @param {Function} operation.buildPrompt - Returns { systemPrompt, userPrompt, responseSchema }
 * @param {Function} operation.validateOutput - (response, schema) => { valid, data, reason, error }
 * @param {Function} [operation.generateFallback] - (reason) => fallbackData (Optional)
 * @param {string} [operation.promptVersion] - Version tag for telemetry
 * @param {Object} [operation.context] - Trusted context to pass to provider for telemetry/mock tracking
 * @param {import('./llm-provider.interface.js').LLMProvider} [operation.provider] - Injected provider
 * @param {Object} [operation.options] - Execution options (timeoutMs, requestId)
 */
export async function orchestrateAI(operation) {
  const startTime = Date.now();
  const requestId = operation.options?.requestId || crypto.randomUUID();
  const timeoutMs = typeof operation.options?.timeoutMs === 'number'
    ? operation.options.timeoutMs
    : DEFAULT_AI_TIMEOUT_MS;

  // Helper to handle standardized failure returns
  const handleFailure = (category, retriesAttempted = 0, providerName = 'unknown', modelName = 'unknown', errorDetails = null) => {
    const telemetry = logAITelemetry({
      requestId,
      provider: providerName,
      model: modelName,
      latencyMs: Date.now() - startTime,
      success: false,
      category,
      retriesAttempted,
      promptVersion: operation.promptVersion,
    });

    if (typeof operation.generateFallback === 'function') {
      return {
        ok: false,
        source: 'deterministic_fallback',
        reason: category,
        fallbackData: operation.generateFallback(category),
        telemetry,
      };
    }

    return {
      ok: false,
      source: 'error',
      reason: category,
      error: errorDetails,
      telemetry,
    };
  };

  // 1. Resolve Provider
  let provider;
  try {
    provider = operation.provider || getAIProvider(operation.options);
  } catch (err) {
    const category = err.category || FALLBACK_REASONS.PROVIDER_UNAVAILABLE;
    return handleFailure(category, 0, err.provider, 'unknown', err);
  }

  // 2. Build Prompt Envelope
  let promptEnvelope;
  try {
    promptEnvelope = operation.buildPrompt();
  } catch (err) {
    return handleFailure('prompt_generation_failed', 0, provider.name, provider.model, err);
  }

  // 3. Bounded Invocation with Single Retry
  let providerResponse = null;
  let retriesAttempted = 0;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt++) {
    let isTimeout = false;
    const abortController = new AbortController();
    const timer = setTimeout(() => {
      isTimeout = true;
      abortController.abort();
    }, timeoutMs);

    try {
      providerResponse = await provider.generateStructuredResponse({
        systemPrompt: promptEnvelope.systemPrompt,
        userPrompt: promptEnvelope.userPrompt,
        responseSchema: promptEnvelope.responseSchema,
        context: operation.context,
        requestId,
        timeoutMs,
        signal: abortController.signal,
      });
      clearTimeout(timer);
      break; // Success on this attempt
    } catch (err) {
      clearTimeout(timer);
      if (isTimeout || err?.name === 'LLMTimeoutError' || err?.category === 'provider_timeout') {
        lastError = new LLMTimeoutError(`Request timed out after ${timeoutMs}ms`, {
          provider: provider.name,
        });
      } else {
        lastError = err;
      }

      // Retry once if error is marked retryable or transient network/timeout
      const isRetryable = lastError?.isRetryable || lastError?.name === 'LLMTimeoutError';
      if (attempt < MAX_AI_RETRIES && isRetryable) {
        retriesAttempted++;
        continue;
      }
      break;
    }
  }

  // 4. Check Provider Errors
  if (!providerResponse) {
    let failureCategory = FALLBACK_REASONS.PROVIDER_ERROR;
    if (lastError?.name === 'LLMTimeoutError' || lastError?.category === 'provider_timeout') {
      failureCategory = FALLBACK_REASONS.PROVIDER_TIMEOUT;
    } else if (lastError?.category === 'quota_exceeded') {
      failureCategory = FALLBACK_REASONS.QUOTA_EXCEEDED;
    } else if (lastError?.category === 'provider_unavailable') {
      failureCategory = FALLBACK_REASONS.PROVIDER_UNAVAILABLE;
    }

    return handleFailure(failureCategory, retriesAttempted, provider.name, provider.model, lastError);
  }

  // 5. Output Validation Pipeline
  const validation = operation.validateOutput(providerResponse, promptEnvelope.responseSchema);

  if (!validation.valid) {
    return handleFailure(validation.reason || FALLBACK_REASONS.SCHEMA_INVALID, retriesAttempted, provider.name, provider.model, validation.error);
  }

  // 6. Successful Response
  const telemetry = logAITelemetry({
    requestId,
    provider: provider.name,
    model: provider.model,
    latencyMs: Date.now() - startTime,
    success: true,
    category: 'success',
    retriesAttempted,
    promptVersion: operation.promptVersion,
  });

  return {
    ok: true,
    source: 'ai',
    data: validation.data,
    telemetry,
  };
}

/**
 * Generates an authoritative deterministic fallback derived exclusively
 * from TrustedAIContextV1 when AI generation or validation fails.
 *
 * @param {Object} context - Authoritative TrustedAIContextV1
 * @param {string} [reason='provider_error']
 * @returns {Object} Schema-compliant fallback advice
 */
export function generateDeterministicFallback(context = {}, reason = 'provider_error') {
  const gaps = Array.isArray(context?.canonicalSkillGaps) ? context.canonicalSkillGaps : [];
  const opp = context?.opportunityFacts;
  const match = context?.matchBreakdown;

  if (gaps.length > 0) {
    const topGap = gaps[0];
    return {
      adviceType: 'skill_guidance',
      headline: `Focus on closing key skill gap: ${topGap}`,
      keyPoints: [
        `Your profile has ${gaps.length} canonical skill gap${gaps.length > 1 ? 's' : ''} identified.`,
        `Top recommended priority to address: ${topGap}.`,
      ],
      referencedSkills: gaps.slice(0, 3),
      suggestedAction: `Complete preparation learning tasks or portfolio projects demonstrating ${topGap}.`,
    };
  }

  if (opp) {
    const oppSkills = Array.isArray(opp.requiredCanonicalSkills) ? opp.requiredCanonicalSkills : [];
    return {
      adviceType: 'opportunity_alignment',
      headline: `Review alignment for ${opp.title}`,
      keyPoints: [
        `Target opportunity at ${opp.organization || 'target organization'}.`,
        match ? `Current deterministic match score: ${match.score}%.` : 'Review requirement checklist.',
      ],
      referencedSkills: oppSkills.slice(0, 3),
      suggestedAction: 'Verify portfolio projects and resume alignment before submitting application.',
    };
  }

  return {
    adviceType: 'general_guidance',
    headline: 'Build demonstrated project proof',
    keyPoints: [
      'Focus on full-stack projects with verified public repository evidence.',
      'Maintain regular practice and track your applications.',
    ],
    referencedSkills: [],
    suggestedAction: 'Explore published opportunities and align your learning goals.',
  };
}

/**
 * Orchestrates Career Coach AI guidance with grounding and safety enforcement.
 * Maintained as a backward-compatible wrapper around the shared core.
 *
 * @param {Object} params
 * @param {string|Object} [params.userId] - Authenticated user ID (ownership-enforced)
 * @param {Object} [params.preloadedContext] - Pre-authorized TrustedAIContextV1 (internal only)
 * @param {string} [params.userQuery] - User query (treated strictly as unexecutable data)
 * @param {import('./llm-provider.interface.js').LLMProvider} [params.provider] - Injected provider
 * @param {Object} [params.options={}]
 * @param {number} [params.options.timeoutMs]
 * @param {string} [params.options.requestId]
 * @param {Date} [params.options.referenceDate]
 * @param {string} [params.options.opportunityId]
 */
export async function orchestrateCareerCoach(params = {}) {
  // 1. Resolve Authoritative Trusted Context early for fallback and prompt
  let trustedContext;
  try {
    if (params.preloadedContext && typeof params.preloadedContext === 'object' && params.preloadedContext.version === '1') {
      trustedContext = params.preloadedContext;
    } else if (params.userId) {
      trustedContext = await getTrustedAIContextForUser(params.userId, {
        referenceDate: params.options?.referenceDate,
        opportunityId: params.options?.opportunityId,
      });
    } else {
      trustedContext = buildTrustedAIContext({}, params.options);
    }
  } catch {
    // If context fetch fails before orchestration can start, we must manually trigger the fallback.
    const fallback = generateDeterministicFallback({}, FALLBACK_REASONS.CONTEXT_RETRIEVAL_FAILED);
    const telemetry = logAITelemetry({
      requestId: params.options?.requestId || crypto.randomUUID(),
      provider: params.provider?.name || 'unknown',
      model: params.provider?.model || 'unknown',
      latencyMs: 0,
      success: false,
      category: FALLBACK_REASONS.CONTEXT_RETRIEVAL_FAILED,
      promptVersion: PROMPT_VERSION,
    });
    return {
      ok: false,
      source: 'deterministic_fallback',
      reason: FALLBACK_REASONS.CONTEXT_RETRIEVAL_FAILED,
      fallbackData: fallback,
      telemetry,
    };
  }

  // 2. Delegate to generic orchestration core
  return orchestrateAI({
    provider: params.provider,
    options: params.options,
    promptVersion: PROMPT_VERSION,
    context: trustedContext,
    buildPrompt: () => buildCareerCoachPromptV1({
      context: trustedContext,
      userQuery: params.userQuery,
    }),
    validateOutput: (providerResponse, schema) => validateAIOutputPipeline(providerResponse, schema, trustedContext),
    generateFallback: (reason) => generateDeterministicFallback(trustedContext, reason)
  });
}
