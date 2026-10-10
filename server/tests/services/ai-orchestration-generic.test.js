import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateAI } from '../../src/services/ai/ai-orchestration.service.js';
import { MockLLMProvider } from '../../src/services/ai/mock-llm.provider.js';
import { LLMTimeoutError, LLMProviderError } from '../../src/services/ai/llm-provider.interface.js';

describe('Generic AI Orchestration Core (Phase 11I - B3.2A)', () => {
  let mockProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider({
      name: 'test_generic_mock',
      model: 'generic-test-v1',
    });
  });

  const validGenericOutput = { status: 'success', data: 'hello' };

  const syntheticOperation = {
    promptVersion: 'generic.v1',
    buildPrompt: () => ({
      systemPrompt: 'You are a generic bot.',
      userPrompt: 'Say hello.',
      responseSchema: {
        type: 'object',
        required: ['status', 'data'],
        properties: {
          status: { type: 'string' },
          data: { type: 'string' }
        }
      }
    }),
    validateOutput: (response, schema) => {
      // Simulate simple schema validation
      if (!response || !response.parsedJson) {
        return { valid: false, reason: 'schema_invalid', error: 'No parsed JSON' };
      }
      const data = response.parsedJson;
      if (!data.status || !data.data) {
        return { valid: false, reason: 'schema_invalid', error: 'Missing required fields' };
      }
      return { valid: true, data };
    }
  };

  it('1. A synthetic server-defined operation uses a different schema through the shared core', async () => {
    mockProvider.queueResponse(validGenericOutput);

    const result = await orchestrateAI({
      ...syntheticOperation,
      provider: mockProvider
    });

    expect(result.ok).toBe(true);
    expect(result.source).toBe('ai');
    expect(result.data).toEqual(validGenericOutput);
    expect(result.telemetry.promptVersion).toBe('generic.v1');
    expect(result.telemetry.success).toBe(true);
  });

  it('2. Invalid output is never reported as validated success (fails closed)', async () => {
    // Missing 'data' field
    mockProvider.queueResponse({ status: 'success' });

    const result = await orchestrateAI({
      ...syntheticOperation,
      provider: mockProvider
    });

    // Without a generateFallback, the orchestrator returns 'error' explicitly
    expect(result.ok).toBe(false);
    expect(result.source).toBe('error');
    expect(result.reason).toBe('schema_invalid');
    expect(result.error).toBe('Missing required fields');
    expect(result.telemetry.success).toBe(false);
  });

  it('3. One operation cannot accidentally receive another operation\'s fallback shape', async () => {
    // If provider fails, ensure it does NOT receive a Career Coach fallback!
    mockProvider.queueError(new LLMProviderError('API down', { category: 'provider_unavailable' }));

    const result = await orchestrateAI({
      ...syntheticOperation,
      provider: mockProvider
    });

    expect(result.ok).toBe(false);
    expect(result.source).toBe('error');
    expect(result.reason).toBe('provider_unavailable');
    expect(result.fallbackData).toBeUndefined(); // NO Career Coach fallback!
  });

  it('4. Provider failure and exhausted retries follow the selected operation\'s explicit failure policy', async () => {
    // Configure operation WITH its own fallback policy
    mockProvider.queueError(new LLMTimeoutError('Timeout')); // Attempt 1
    mockProvider.queueError(new LLMTimeoutError('Timeout')); // Attempt 2 (Retry)

    const operationWithFallback = {
      ...syntheticOperation,
      generateFallback: (reason) => ({
        status: 'error',
        data: `Synthetic fallback for ${reason}`
      })
    };

    const result = await orchestrateAI({
      ...operationWithFallback,
      provider: mockProvider
    });

    expect(result.ok).toBe(false);
    expect(result.source).toBe('deterministic_fallback');
    expect(result.reason).toBe('provider_timeout');
    expect(result.fallbackData).toEqual({
      status: 'error',
      data: 'Synthetic fallback for provider_timeout'
    });
    // Telemetry shows 1 retry attempted
    expect(result.telemetry.retriesAttempted).toBe(1);
  });

  it('5. Telemetry remains sanitized and does not expose prompts, secrets, or credentials', async () => {
    mockProvider.queueResponse(validGenericOutput);

    const result = await orchestrateAI({
      ...syntheticOperation,
      provider: mockProvider
    });

    const log = result.telemetry;
    expect(log).toHaveProperty('requestId');
    expect(log).toHaveProperty('provider', 'test_generic_mock');
    expect(log).toHaveProperty('latencyMs');
    expect(log).toHaveProperty('success', true);

    // Assert no raw prompts exist in telemetry
    expect(log.systemPrompt).toBeUndefined();
    expect(log.userPrompt).toBeUndefined();
    expect(log.rawText).toBeUndefined();
    expect(log.context).toBeUndefined();
  });
});
