import express from 'express';
import { aiLimiter, aiDailyLimiter, aiMinuteLimiter, closeRedisClient, redisClient } from '../src/middleware/rateLimiter.js';

const app = express();
app.use(express.json());

// Auth stub for tests
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId) {
    req.auth = { userId };
  }
  next();
});

// Route using combined limiter (for minute limits mostly since 5/min < 50/day)
app.post('/api/ai/career-coach', aiLimiter, (req, res) => {
  res.status(200).json({ ok: true });
});

// Route using only daily limiter for independent verification
app.post('/test/daily-limiter', aiDailyLimiter, (req, res) => {
  res.status(200).json({ ok: true });
});

// Route using only minute limiter for independent verification
app.post('/test/minute-limiter', aiMinuteLimiter, (req, res) => {
  res.status(200).json({ ok: true });
});

async function start() {
  // Wait for Redis to be ready (up to 2 seconds) to avoid stream isn't writeable error
  if (redisClient) {
    let attempts = 0;
    while (redisClient.status !== 'ready' && redisClient.status !== 'end' && attempts < 40) {
      await new Promise(r => setTimeout(r, 50));
      attempts++;
    }
    console.log(`Worker Redis status: ${redisClient.status} after ${attempts} attempts`);
  }

  const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    if (process.send) {
      process.send({ ready: true, port });
    } else {
      console.log(`Worker listening on port ${port}`);
    }
  });

  let isShuttingDown = false;
  async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    await new Promise((resolve) => server.close(resolve));
    await closeRedisClient();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      shutdown();
    }
  });
}

start();
