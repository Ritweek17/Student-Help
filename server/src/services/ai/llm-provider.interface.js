/**
 * CareerOS LLM Provider Interface (Phase 11H — B3)
 *
 * Defines the vendor-neutral abstract contract for LLM providers.
 *
 * Guarantees:
 * - Provider-neutral, async, deterministic at contract level.
 * - Explicit about failure/timeout categories.
 * - Completely independent of Express, HTTP transports, and MongoDB models.
 * - Never performs authorization or data mutation.
 */

export class LLMProviderError extends Error {
  /**
   * @param {string} message
   * @param {Object} [options={}]
   * @param {string} [options.category='provider_error']
   * @param {boolean} [options.isRetryable=false]
   * @param {string} [options.provider='unknown']
   * @param {any} [options.originalError=null]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'LLMProviderError';
    this.category = options.category || 'provider_error';
    this.isRetryable = Boolean(options.isRetryable);
    this.provider = options.provider || 'unknown';
    this.originalError = options.originalError || null;
  }
}

export class LLMTimeoutError extends LLMProviderError {
  constructor(message = 'LLM request timed out', options = {}) {
    super(message, {
      ...options,
      category: 'provider_timeout',
      isRetryable: true,
    });
    this.name = 'LLMTimeoutError';
  }
}

export class LLMAbortError extends LLMProviderError {
  constructor(message = 'LLM request was aborted', options = {}) {
    super(message, {
      ...options,
      category: 'aborted',
      isRetryable: false,
    });
    this.name = 'LLMAbortError';
  }
}

export class LLMRateLimitError extends LLMProviderError {
  constructor(message = 'LLM provider quota or rate limit exceeded', options = {}) {
    super(message, {
      ...options,
      category: 'quota_exceeded',
      isRetryable: false,
    });
    this.name = 'LLMRateLimitError';
  }
}

/**
 * Base abstract class for LLM providers.
 */
export class LLMProvider {
  /**
   * @param {Object} [config={}]
   * @param {string} [config.name='unnamed_provider']
   * @param {string} [config.model='default_model']
   * @param {number} [config.defaultTimeoutMs=8000]
   */
  constructor(config = {}) {
    this.name = config.name || 'unnamed_provider';
    this.model = config.model || 'default_model';
    this.defaultTimeoutMs = typeof config.defaultTimeoutMs === 'number' ? config.defaultTimeoutMs : 8000;
  }

  /**
   * Generates a structured response from the model.
   *
   * @param {Object} params
   * @param {string} params.systemPrompt - Authoritative system instructions
   * @param {string} params.userPrompt - User-directed query / prompt
   * @param {Object} params.context - Authoritative TrustedAIContextV1
   * @param {Object} params.responseSchema - Target JSON schema definition
   * @param {string} params.requestId - Unique request identifier for telemetry
   * @param {number} [params.timeoutMs] - Optional timeout override
   * @param {AbortSignal} [params.signal] - Optional abort signal
   * @returns {Promise<{
   *   rawText: string,
   *   parsedJson: Object|null,
   *   metadata: {
   *     provider: string,
   *     model: string,
   *     latencyMs: number,
   *     usage?: { promptTokens?: number, completionTokens?: number, totalTokens?: number }
   *   }
   * }>}
   */
  async generateStructuredResponse(_params) {
    throw new Error('generateStructuredResponse must be implemented by concrete LLM provider');
  }
}
