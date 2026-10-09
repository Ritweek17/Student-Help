import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import RedisStore from 'rate-limit-redis';
import { env } from '../config/env.js';

export let redisClient = null;

if (env.redisUrl) {
  redisClient = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  redisClient.on('error', () => {
    // Ignore to prevent unhandled exceptions; we handle health/state via client.status
  });
}

export async function closeRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Force disconnect if graceful quit fails
      redisClient.disconnect();
    }
    redisClient = null;
  }
}


export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    const o = req.originalUrl || '';
    return p === '/health' || p.startsWith('/health/') || o === '/api/health' || o.startsWith('/api/health/');
  },
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});

export const authLimiter = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again later.',
  },
});

export const githubSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many GitHub sync attempts, please try again later.',
  },
});

/**
 * Dedicated AI rate limiter: 5 requests per minute per authenticated user (Phase 11H — B4)
 */
export const aiMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: false,
  legacyHeaders: false,
  validate: false,
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:ai_min:',
  }) : undefined,
  keyGenerator: (req) => {
    return req.auth?.userId || req.ip;
  },
  handler: (_req, res) => {
    return res.status(429).json({
      ok: false,
      category: 'quota_exceeded',
      message: 'AI request limit exceeded: maximum 5 requests per minute allowed.',
    });
  },
});

/**
 * Dedicated AI daily quota limiter: 50 requests per day per authenticated user (Phase 11H — B4)
 */
export const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  standardHeaders: false,
  legacyHeaders: false,
  validate: false,
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:ai_daily:',
  }) : undefined,
  keyGenerator: (req) => {
    return req.auth?.userId || req.ip;
  },
  handler: (_req, res) => {
    return res.status(429).json({
      ok: false,
      category: 'quota_exceeded',
      message: 'AI daily quota exceeded: maximum 50 requests per day allowed.',
    });
  },
});

/**
 * Combined AI rate limiter enforcing both daily quota and per-minute constraints.
 * Strictly prevents fallback to memory in production if Redis is unavailable.
 */
export function aiLimiter(req, res, next) {
  const isProduction = env.nodeEnv === 'production';

  // Strict production guard: Fail if Redis is not configured or unavailable
  if (isProduction) {
    if (!redisClient || redisClient.status !== 'ready') {
      return res.status(503).json({
        ok: false,
        category: 'rate_limit_store_unavailable',
        message: 'Service temporarily unavailable.',
      });
    }
  }

  aiDailyLimiter(req, res, (dailyErr) => {
    if (dailyErr) {
      if (isProduction) {
        return res.status(503).json({
          ok: false,
          category: 'rate_limit_store_unavailable',
          message: 'Service temporarily unavailable.',
        });
      }
      return next(dailyErr);
    }
    aiMinuteLimiter(req, res, (minErr) => {
      if (minErr) {
        if (isProduction) {
          return res.status(503).json({
            ok: false,
            category: 'rate_limit_store_unavailable',
            message: 'Service temporarily unavailable.',
          });
        }
        return next(minErr);
      }
      next();
    });
  });
}

/**
 * Test helper to reset AI rate limits for a user.
 */
export async function resetAIRateLimits(userId) {
  if (userId) {
    if (aiMinuteLimiter?.resetKey) await aiMinuteLimiter.resetKey(userId);
    if (aiDailyLimiter?.resetKey) await aiDailyLimiter.resetKey(userId);
  }
}

/**
 * Test helper to reset only the per-minute limit for a user (allowing daily quota testing).
 */
export async function resetAIMinuteLimit(userId) {
  if (userId && aiMinuteLimiter?.resetKey) {
    await aiMinuteLimiter.resetKey(userId);
  }
}

