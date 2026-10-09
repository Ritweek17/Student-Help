/**
 * CareerOS Production AI Adapter Seam (Phase 11H — B3)
 *
 * Provides a vendor-agnostic seam for instantiating or resolving the configured LLM provider.
 * Does not make external network calls.
 * Does not require external API credentials for development or tests.
 */

import { MockLLMProvider } from './mock-llm.provider.js';
import { LLMProviderError } from './llm-provider.interface.js';
import { ProductionLLMProvider } from './production-llm.provider.js';

let defaultProviderInstance = null;

/**
 * Resolves the active AI provider based on environment or options.
 *
 * @param {Object} [options={}]
 * @param {import('./llm-provider.interface.js').LLMProvider} [options.provider] - Injected provider instance
 * @param {string} [options.providerType] - Provider name override
 * @param {string} [options.apiKey] - Provider API key override
 * @param {string} [options.model] - Model name override
 * @param {number} [options.timeoutMs] - Timeout override
 * @returns {import('./llm-provider.interface.js').LLMProvider}
 */
export function getAIProvider(options = {}) {
  if (options.provider) {
    return options.provider;
  }

  const requestedType = options.providerType || process.env.AI_PROVIDER || 'mock';

  if (requestedType === 'mock') {
    if (!defaultProviderInstance) {
      defaultProviderInstance = new MockLLMProvider();
    }
    return defaultProviderInstance;
  }

  if (requestedType === 'gemini' || requestedType === 'openai') {
    const apiKey = options.apiKey || process.env.AI_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new LLMProviderError(`Missing credentials for provider "${requestedType}": AI_API_KEY is required`, {
        category: 'provider_unavailable',
        provider: requestedType,
      });
    }

    const model = options.model || process.env.AI_MODEL || (requestedType === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
    const timeoutMs = typeof options.timeoutMs === 'number'
      ? options.timeoutMs
      : (Number(process.env.AI_TIMEOUT_MS) || 6000);

    return new ProductionLLMProvider({
      name: requestedType,
      model,
      apiKey,
      defaultTimeoutMs: timeoutMs,
    });
  }

  // Explicitly rejects unknown or unconfigured providers with machine-safe error
  throw new LLMProviderError(`Provider adapter for "${requestedType}" is not configured or available`, {
    category: 'provider_unavailable',
    provider: requestedType,
  });
}

/**
 * Sets or resets the default provider instance (useful in tests).
 * @param {import('./llm-provider.interface.js').LLMProvider|null} provider
 */
export function setDefaultProvider(provider) {
  defaultProviderInstance = provider;
}
