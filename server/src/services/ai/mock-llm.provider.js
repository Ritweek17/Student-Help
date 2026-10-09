/**
 * CareerOS Mock LLM Provider (Phase 11H — B3)
 *
 * In-memory test provider implementing the LLMProvider contract.
 * Enables 100% offline, deterministic testing of orchestration,
 * timeouts, retries, aborts, and schema validation.
 */

import {
  LLMProvider,
  LLMProviderError,
  LLMTimeoutError,
  LLMAbortError,
} from './llm-provider.interface.js';

export class MockLLMProvider extends LLMProvider {
  /**
   * @param {Object} [config={}]
   * @param {string} [config.name='mock_provider']
   * @param {string} [config.model='mock-model-v1']
   * @param {number} [config.simulatedLatencyMs=0]
   * @param {any} [config.defaultResponse]
   */
  constructor(config = {}) {
    super({
      name: config.name || 'mock_provider',
      model: config.model || 'mock-model-v1',
      defaultTimeoutMs: config.defaultTimeoutMs || 5000,
    });

    this.simulatedLatencyMs = config.simulatedLatencyMs || 0;
    this.defaultResponse = config.defaultResponse || null;
    this.responseQueue = [];
    this.errorQueue = [];
    this.callHistory = [];
  }

  /**
   * Enqueues a response to be returned on subsequent invocation.
   * @param {Object|string} response
   */
  queueResponse(response) {
    this.responseQueue.push(response);
  }

  /**
   * Enqueues an error to be thrown on subsequent invocation.
   * @param {Error} error
   */
  queueError(error) {
    this.errorQueue.push(error);
  }

  /**
   * Clears call history and queues.
   */
  reset() {
    this.responseQueue = [];
    this.errorQueue = [];
    this.callHistory = [];
    this.simulatedLatencyMs = 0;
  }

  /**
   * Executes structured generation.
   *
   * @param {Object} params
   * @returns {Promise<{ rawText: string, parsedJson: Object|null, metadata: Object }>}
   */
  async generateStructuredResponse(params) {
    const startTime = Date.now();
    const {
      systemPrompt,
      userPrompt,
      context,
      responseSchema,
      requestId,
      timeoutMs = this.defaultTimeoutMs,
      signal,
    } = params;

    // Record call metadata for test inspection
    this.callHistory.push({
      requestId,
      systemPrompt,
      userPrompt,
      context,
      responseSchema,
      timeoutMs,
      timestamp: startTime,
    });

    // Check immediate abort
    if (signal?.aborted) {
      throw new LLMAbortError('Request was aborted prior to execution', {
        provider: this.name,
      });
    }

    // Simulate latency with abort awareness
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, this.simulatedLatencyMs);

        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new LLMAbortError('Request aborted during execution', {
              provider: this.name,
            }));
          }, { once: true });
        }
      });
    }

    // Check timeout threshold
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      throw new LLMTimeoutError(`Request exceeded timeout of ${timeoutMs}ms`, {
        provider: this.name,
      });
    }

    // Check queued error
    if (this.errorQueue.length > 0) {
      const err = this.errorQueue.shift();
      throw err;
    }

    // Resolve response: check queue first, then defaultResponse, then fallback
    let responsePayload = this.responseQueue.length > 0
      ? this.responseQueue.shift()
      : this.defaultResponse;

    if (!responsePayload) {
      responsePayload = {
        adviceType: 'general_guidance',
        headline: 'Continue skill development',
        keyPoints: ['Review target opportunities and maintain active practice.'],
        referencedSkills: [],
        suggestedAction: 'Explore relevant development tracks.',
      };
    }

    let rawText = '';
    let parsedJson = null;

    if (typeof responsePayload === 'string') {
      rawText = responsePayload;
      try {
        parsedJson = JSON.parse(responsePayload);
      } catch {
        parsedJson = null;
      }
    } else {
      rawText = JSON.stringify(responsePayload);
      parsedJson = responsePayload;
    }

    return {
      rawText,
      parsedJson,
      metadata: {
        provider: this.name,
        model: this.model,
        latencyMs: Math.max(1, Date.now() - startTime),
        usage: {
          promptTokens: 120,
          completionTokens: 85,
          totalTokens: 205,
        },
      },
    };
  }
}
