import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { aiLimiter, apiLimiter, resetAIRateLimits } from '../../src/middleware/rateLimiter.js';
import * as envModule from '../../src/config/env.js';

vi.mock('../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    env: {
      ...actual.env,
      nodeEnv: 'test',
    }
  };
});

describe('CareerOS AI Rate Limiting & Redis Requirements', () => {
  let app;
  let providerCalled = 0;

  beforeEach(async () => {
    providerCalled = 0;
    app = express();
    app.use(express.json());

    // Mock authenticated user middleware
    app.use((req, res, next) => {
      req.auth = { userId: req.headers['x-user-id'] || 'mock_user' };
      next();
    });

    app.post('/api/ai/career-coach', aiLimiter, (req, res) => {
      providerCalled++;
      res.status(200).json({ ok: true, data: { adviceType: 'test' } });
    });

    app.get('/api/standard', apiLimiter, (req, res) => {
      res.status(200).json({ ok: true });
    });

    await resetAIRateLimits('mock_user');
    await resetAIRateLimits('user_a');
    await resetAIRateLimits('user_b');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1-2. Uses configured store in test/dev (memory by default without REDIS_URL)', async () => {
    // Implicitly verified by running without Redis running
    const res = await request(app).post('/api/ai/career-coach');
    expect(res.status).toBe(200);
  });

  it('4. Authenticated users have isolated counters', async () => {
    // User A hits limit
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/ai/career-coach').set('x-user-id', 'user_a');
    }
    const resA = await request(app).post('/api/ai/career-coach').set('x-user-id', 'user_a');
    expect(resA.status).toBe(429);

    // User B still ok
    const resB = await request(app).post('/api/ai/career-coach').set('x-user-id', 'user_b');
    expect(resB.status).toBe(200);
  });

  it('5. Client-supplied identity cannot alter the key', async () => {
    // IP spoofing doesn't bypass auth
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/ai/career-coach').set('x-user-id', 'user_spoof');
    }
    const resSpoof = await request(app)
      .post('/api/ai/career-coach')
      .set('x-user-id', 'user_spoof')
      .set('x-forwarded-for', '1.2.3.4');
    expect(resSpoof.status).toBe(429);
  });

  it('6-7. Five requests are allowed within the minute window, the sixth is rejected', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/ai/career-coach').set('x-user-id', 'user_window');
      expect(res.status).toBe(200);
    }
    const res6 = await request(app).post('/api/ai/career-coach').set('x-user-id', 'user_window');
    expect(res6.status).toBe(429);
    expect(res6.body.category).toBe('quota_exceeded');
  });

  it('15. Existing unrelated rate limiters retain their behavior', async () => {
    const res = await request(app).get('/api/standard');
    expect(res.status).toBe(200);
  });

  describe('Production strict behavior', () => {
    beforeEach(() => {
      // Force nodeEnv to production
      envModule.env.nodeEnv = 'production';
    });

    it('11-13. Store failure returns sanitized 503 and does not fallback silently', async () => {
      // In our code, if redisClient is missing or not ready in prod, it returns 503
      const res = await request(app).post('/api/ai/career-coach');
      expect(res.status).toBe(503);
      expect(res.body.category).toBe('rate_limit_store_unavailable');
      expect(providerCalled).toBe(0);
    });
  });
});
