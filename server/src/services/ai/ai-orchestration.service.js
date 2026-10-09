/**
 * CareerOS AI Orchestration Service (Phase 11H — B3)
 *
 * Coordinates the execution of AI career coaching:
 * 1. Resolves authoritative TrustedAIContextV1 via career-context.service.js.
 * 2. Assembles versioned prompt envelope (career-coach.v1).
 * 3. Dispatches to provider with bounded timeout and single retry.
 * 4. Validates transport, JSON, schema, safety, and grounding.
 * 5. Returns safe typed result or machine-safe deterministic fallback.
 *
 * Guarantees:
 * - Deterministic CareerOS intelligence is never duplicated or modified.
 * - Client cannot override trusted context, scores, or skill gaps.
 * - Non-causal rules and safety contracts are strictly enforced.
 * - Defense-in-depth prompt injection controls are applied across boundaries.
 *   No single layer guarantees prompt-injection immunity.
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
    promptVersion: telemetry.promptVersion || PROMPT_VERSION,
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
 * @returns {Promise<{
 *   ok: boolean,
 *   source: 'ai' | 'deterministic_fallback',
 *   data?: Object,
 *   reason?: string,
 *   fallbackData?: Object,
 *   telemetry: Object
 * }>}
 */
export async function orchestrateCareerCoach(params = {}) {
  const startTime = Date.now();
  const requestId = params.options?.requestId || crypto.randomUUID();
  const timeoutMs = typeof params.options?.timeoutMs === 'number'
    ? params.options.timeoutMs
    : DEFAULT_AI_TIMEOUT_MS;

  // 1. Resolve Provider
  let provider;
  try {
    provider = params.provider || getAIProvider(params.options);
  } catch (err) {
    const category = err.category || FALLBACK_REASONS.PROVIDER_UNAVAILABLE;
    const fallback = generateDeterministicFallback(params.preloadedContext, category);
    const telemetry = logAITelemetry({
      requestId,
      provider: err.provider || 'unknown',
      latencyMs: Date.now() - startTime,
      success: false,
      category,
    });
    return {
      ok: false,
      source: 'deterministic_fallback',
      reason: category,
      fallbackData: fallback,
      telemetry,
    };
  }

  // 2. Resolve Authoritative Trusted Context
  // Context MUST come from career-context.service.js. Never trust client-provided scores or skill gaps.
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
    const fallback = generateDeterministicFallback({}, FALLBACK_REASONS.CONTEXT_RETRIEVAL_FAILED);
    const telemetry = logAITelemetry({
      requestId,
      provider: provider.name,
      model: provider.model,
      latencyMs: Date.now() - startTime,
      success: false,
      category: FALLBACK_REASONS.CONTEXT_RETRIEVAL_FAILED,
    });
    return {
      ok: false,
      source: 'deterministic_fallback',
      reason: FALLBACK_REASONS.CONTEXT_RETRIEVAL_FAILED,
      fallbackData: fallback,
      telemetry,
    };
  }

  // 3. Assemble Versioned Prompt Envelope
  const promptEnvelope = buildCareerCoachPromptV1({
    context: trustedContext,
    userQuery: params.userQuery,
  });

  // 4. Bounded Invocation with Single Retry
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
        context: trustedContext,
        responseSchema: promptEnvelope.responseSchema,
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

  // 5. Check Provider Errors
  if (!providerResponse) {
    let failureCategory = FALLBACK_REASONS.PROVIDER_ERROR;
    if (lastError?.name === 'LLMTimeoutError' || lastError?.category === 'provider_timeout') {
      failureCategory = FALLBACK_REASONS.PROVIDER_TIMEOUT;
    } else if (lastError?.category === 'quota_exceeded') {
      failureCategory = FALLBACK_REASONS.QUOTA_EXCEEDED;
    } else if (lastError?.category === 'provider_unavailable') {
      failureCategory = FALLBACK_REASONS.PROVIDER_UNAVAILABLE;
    }

    const fallback = generateDeterministicFallback(trustedContext, failureCategory);
    const telemetry = logAITelemetry({
      requestId,
      provider: provider.name,
      model: provider.model,
      latencyMs: Date.now() - startTime,
      success: false,
      category: failureCategory,
      retriesAttempted,
    });

    return {
      ok: false,
      source: 'deterministic_fallback',
      reason: failureCategory,
      fallbackData: fallback,
      telemetry,
    };
  }

  // 6. Output Validation Pipeline (Transport -> JSON -> Schema -> Safety -> Grounding)
  const validation = validateAIOutputPipeline(
    providerResponse,
    promptEnvelope.responseSchema,
    trustedContext
  );

  if (!validation.valid) {
    const fallback = generateDeterministicFallback(trustedContext, validation.reason);
    const telemetry = logAITelemetry({
      requestId,
      provider: provider.name,
      model: provider.model,
      latencyMs: Date.now() - startTime,
      success: false,
      category: validation.reason,
      retriesAttempted,
    });

    return {
      ok: false,
      source: 'deterministic_fallback',
      reason: validation.reason,
      fallbackData: fallback,
      telemetry,
    };
  }

  // 7. Successful Grounded Response
  const latencyMs = Date.now() - startTime;
  const telemetry = logAITelemetry({
    requestId,
    provider: provider.name,
    model: provider.model,
    latencyMs,
    success: true,
    category: 'success',
    retriesAttempted,
  });

  return {
    ok: true,
    source: 'ai',
    data: validation.data,
    telemetry,
  };
}
