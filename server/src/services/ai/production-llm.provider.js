/**
 * CareerOS Production LLM Provider (Phase 11H — B4)
 *
 * Implements the concrete HTTP LLM adapter for live models (Gemini / OpenAI compatible).
 *
 * Guarantees:
 * - Isolated behind the LLMProvider interface.
 * - Credentials remain strictly server-side; NEVER leaked in errors, logs, or responses.
 * - Enforces timeouts, aborts, and structured JSON parsing.
 * - Standardizes network errors into LLMProviderError, LLMTimeoutError, LLMAbortError, LLMRateLimitError.
 */

import {
  LLMProvider,
  LLMProviderError,
  LLMTimeoutError,
  LLMAbortError,
  LLMRateLimitError,
} from './llm-provider.interface.js';

export class ProductionLLMProvider extends LLMProvider {
  /**
   * @param {Object} config
   * @param {'gemini'|'openai'|string} [config.name='gemini']
   * @param {string} [config.model]
   * @param {string} config.apiKey
   * @param {number} [config.defaultTimeoutMs=6000]
   */
  constructor(config = {}) {
    super({
      name: config.name || 'gemini',
      model: config.model || (config.name === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash'),
      defaultTimeoutMs: config.defaultTimeoutMs || 6000,
    });

    if (!config.apiKey || typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
      throw new LLMProviderError(`Missing credentials for provider "${this.name}": AI_API_KEY is required`, {
        category: 'provider_unavailable',
        provider: this.name,
      });
    }

    this.apiKey = config.apiKey.trim();
  }

  /**
   * Generates structured response via HTTP vendor endpoint.
   *
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @param {Object} params.context
   * @param {Object} params.responseSchema
   * @param {string} params.requestId
   * @param {number} [params.timeoutMs]
   * @param {AbortSignal} [params.signal]
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
  async generateStructuredResponse(params) {
    const startTime = Date.now();
    const {
      systemPrompt,
      userPrompt,
      requestId,
      timeoutMs = this.defaultTimeoutMs,
      signal,
    } = params;

    if (signal?.aborted) {
      throw new LLMAbortError('Request was aborted prior to execution', {
        provider: this.name,
      });
    }

    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    // Link incoming signal to internal abort controller
    if (signal) {
      signal.addEventListener('abort', () => abortController.abort(), { once: true });
    }

    let url;
    let headers;
    let body;

    if (this.name === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Request-Id': requestId,
      };
      body = JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });
    } else {
      // Default: Google Gemini REST API using header auth (avoids key in URL query string)
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
      headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
        'X-Request-Id': requestId,
      };
      body = JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: abortController.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutTimer);
      if (abortController.signal.aborted || fetchError?.name === 'AbortError') {
        if (Date.now() - startTime >= timeoutMs) {
          throw new LLMTimeoutError(`LLM request timed out after ${timeoutMs}ms`, {
            provider: this.name,
          });
        }
        throw new LLMAbortError('LLM request was aborted', {
          provider: this.name,
        });
      }

      throw new LLMProviderError('Provider network communication failure', {
        category: 'provider_error',
        isRetryable: true,
        provider: this.name,
      });
    } finally {
      clearTimeout(timeoutTimer);
    }

    const latencyMs = Math.max(1, Date.now() - startTime);

    if (!response.ok) {
      if (response.status === 429) {
        throw new LLMRateLimitError('Provider quota or rate limit exceeded', {
          provider: this.name,
        });
      }
      if (response.status === 401 || response.status === 403) {
        throw new LLMProviderError('Provider authentication failed', {
          category: 'provider_unavailable',
          isRetryable: false,
          provider: this.name,
        });
      }
      if (response.status >= 500) {
        throw new LLMProviderError(`Provider returned upstream server error (${response.status})`, {
          category: 'provider_error',
          isRetryable: true,
          provider: this.name,
        });
      }

      throw new LLMProviderError(`Provider rejected request with status ${response.status}`, {
        category: 'provider_error',
        isRetryable: false,
        provider: this.name,
      });
    }

    let responseJson;
    try {
      responseJson = await response.json();
    } catch {
      throw new LLMProviderError('Provider response could not be parsed as JSON', {
        category: 'provider_error',
        isRetryable: false,
        provider: this.name,
      });
    }

    let rawText = '';
    let usage = null;

    if (this.name === 'openai') {
      rawText = responseJson?.choices?.[0]?.message?.content || '';
      usage = responseJson?.usage
        ? {
            promptTokens: responseJson.usage.prompt_tokens,
            completionTokens: responseJson.usage.completion_tokens,
            totalTokens: responseJson.usage.total_tokens,
          }
        : undefined;
    } else {
      // Gemini format
      rawText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (responseJson?.usageMetadata) {
        usage = {
          promptTokens: responseJson.usageMetadata.promptTokenCount,
          completionTokens: responseJson.usageMetadata.candidatesTokenCount,
          totalTokens: responseJson.usageMetadata.totalTokenCount,
        };
      }
    }

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      parsedJson = null;
    }

    return {
      rawText,
      parsedJson,
      metadata: {
        provider: this.name,
        model: this.model,
        latencyMs,
        ...(usage ? { usage } : {}),
      },
    };
  }
}
