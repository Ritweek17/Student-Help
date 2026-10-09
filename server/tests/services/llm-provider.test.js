import { describe, it, expect } from 'vitest';
import {
  LLMProvider,
  LLMProviderError,
  LLMTimeoutError,
  LLMAbortError,
  LLMRateLimitError,
} from '../../src/services/ai/llm-provider.interface.js';
import { MockLLMProvider } from '../../src/services/ai/mock-llm.provider.js';
import { getAIProvider, setDefaultProvider } from '../../src/services/ai/production-adapter.seam.js';

describe('CareerOS LLM Provider Interface & Mock Adapter (Phase 11H — B3)', () => {
  it('1. Abstract base class enforces generateStructuredResponse implementation', async () => {
    const base = new LLMProvider();
    await expect(base.generateStructuredResponse({})).rejects.toThrow(
      'generateStructuredResponse must be implemented'
    );
  });

  it('2. Custom error classes maintain correct properties and retryability', () => {
    const err = new LLMProviderError('Base error', { category: 'custom_cat', isRetryable: true });
    expect(err.name).toBe('LLMProviderError');
    expect(err.category).toBe('custom_cat');
    expect(err.isRetryable).toBe(true);

    const timeout = new LLMTimeoutError('Timed out');
    expect(timeout.name).toBe('LLMTimeoutError');
    expect(timeout.category).toBe('provider_timeout');
    expect(timeout.isRetryable).toBe(true);

    const abort = new LLMAbortError('Aborted');
    expect(abort.name).toBe('LLMAbortError');
    expect(abort.category).toBe('aborted');
    expect(abort.isRetryable).toBe(false);

    const rate = new LLMRateLimitError('Quota exceeded');
    expect(rate.name).toBe('LLMRateLimitError');
    expect(rate.category).toBe('quota_exceeded');
    expect(rate.isRetryable).toBe(false);
  });

  it('3. Mock provider returns structured response and captures call parameters', async () => {
    const mock = new MockLLMProvider();
    const testPayload = {
      adviceType: 'skill_guidance',
      headline: 'Improve Docker Skills',
      keyPoints: ['Deploy a containerized API.'],
      referencedSkills: ['docker'],
      suggestedAction: 'Complete container module.',
    };
    mock.queueResponse(testPayload);

    const response = await mock.generateStructuredResponse({
      systemPrompt: 'System',
      userPrompt: 'User',
      context: { version: '1' },
      responseSchema: {},
      requestId: 'req-123',
    });

    expect(response.parsedJson).toEqual(testPayload);
    expect(response.rawText).toBe(JSON.stringify(testPayload));
    expect(response.metadata.provider).toBe('mock_provider');
    expect(mock.callHistory.length).toBe(1);
    expect(mock.callHistory[0].requestId).toBe('req-123');
  });

  it('4. Mock provider triggers timeout error when simulated latency exceeds timeoutMs', async () => {
    const mock = new MockLLMProvider({ simulatedLatencyMs: 50 });
    await expect(
      mock.generateStructuredResponse({
        systemPrompt: 'S',
        userPrompt: 'U',
        context: {},
        responseSchema: {},
        requestId: 'req-timeout',
        timeoutMs: 10,
      })
    ).rejects.toThrow(LLMTimeoutError);
  });

  it('5. Mock provider aborts cleanly when AbortSignal is triggered', async () => {
    const mock = new MockLLMProvider({ simulatedLatencyMs: 100 });
    const controller = new AbortController();

    setTimeout(() => controller.abort(), 20);

    await expect(
      mock.generateStructuredResponse({
        systemPrompt: 'S',
        userPrompt: 'U',
        context: {},
        responseSchema: {},
        requestId: 'req-abort',
        signal: controller.signal,
      })
    ).rejects.toThrow(LLMAbortError);
  });

  it('6. Production adapter seam resolves mock provider by default and rejects unknown external vendors', () => {
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(LLMProvider);

    expect(() => getAIProvider({ providerType: 'unsupported_vendor' })).toThrow(LLMProviderError);

    const customMock = new MockLLMProvider({ name: 'custom_mock' });
    setDefaultProvider(customMock);
    expect(getAIProvider().name).toBe('custom_mock');
    setDefaultProvider(null); // Reset
  });
});
