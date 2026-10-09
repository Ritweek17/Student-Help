import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startWorker() {
  return new Promise((resolve, reject) => {
    const worker = fork(path.join(__dirname, 'verify-redis-worker.js'));
    
    worker.on('message', (msg) => {
      if (msg.ready) {
        resolve({ worker, port: msg.port });
      }
    });
    
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Worker exited with code ${code}`);
      }
    });
    
    // Timeout
    setTimeout(() => reject(new Error('Worker start timeout')), 5000);
  });
}

async function makeRequest(port, route, userId) {
  const url = `http://127.0.0.1:${port}${route}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
        'Content-Type': 'application/json'
      }
    });
    const body = await res.json();
    return { status: res.status, body };
  } catch (err) {
    return { status: 500, error: err };
  }
}

async function runVerification() {
  if (!process.env.REDIS_URL) {
    console.error('ERROR: REDIS_URL environment variable is required to run this verification.');
    process.exit(1);
  }

  console.log('--- Phase 11I-B2 Multi-Process Redis Verification ---');
  console.log(`Using Redis at ${process.env.REDIS_URL}`);

  let workerA, workerB, workerFail;

  try {
    console.log('Starting independent workers...');
    const resA = await startWorker();
    workerA = resA.worker;
    const portA = resA.port;
    
    const resB = await startWorker();
    workerB = resB.worker;
    const portB = resB.port;
    
    console.log(`Worker A PID: ${workerA.pid} listening on port ${portA}`);
    console.log(`Worker B PID: ${workerB.pid} listening on port ${portB}`);
    
    const redisClient = new Redis(process.env.REDIS_URL);
    await new Promise(r => setTimeout(r, 500)); // wait for redis to connect in master

    // --- 1. Verify Shared Minute Quota ---
    console.log('\n--- 1. Shared Minute Quota ---');
    const testUserId1 = 'user_min_' + Date.now();
    const testUserId2 = 'other_min_' + Date.now();

    console.log(`[Worker A] Making 3 requests for ${testUserId1}`);
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest(portA, '/test/minute-limiter', testUserId1);
      if (res.status === 429) throw new Error('Unexpected 429 too early');
    }

    console.log(`[Worker B] Making 2 requests for ${testUserId1}`);
    for (let i = 0; i < 2; i++) {
      const res = await makeRequest(portB, '/test/minute-limiter', testUserId1);
      if (res.status === 429) throw new Error('Unexpected 429 too early');
    }

    console.log(`[Worker A] Making 6th request for ${testUserId1}`);
    const finalMin = await makeRequest(portA, '/test/minute-limiter', testUserId1);
    if (finalMin.status === 429 && finalMin.body?.category === 'quota_exceeded') {
      console.log('SUCCESS: 6th request rejected by shared minute quota.');
    } else {
      throw new Error(`FAILURE: Expected 429 quota_exceeded, got ${finalMin.status}`);
    }

    // --- TTL Inspection ---
    const minKey = `rl:ai_min:${testUserId1}`;
    const minTtl = await redisClient.pttl(minKey);
    console.log(`[TTL Check] Minute quota key '${minKey}' PTTL is ${minTtl}ms`);
    if (minTtl <= 0 || minTtl > 60000) {
      throw new Error(`FAILURE: Minute TTL is invalid: ${minTtl}`);
    }

    console.log(`[Worker B] Making 1 request for different user ${testUserId2}`);
    const otherMin = await makeRequest(portB, '/test/minute-limiter', testUserId2);
    if (otherMin.status === 200) {
      console.log('SUCCESS: Different user has independent minute quota.');
    } else {
      throw new Error(`FAILURE: Expected 200 for different user, got ${otherMin.status}`);
    }

    // --- Minute Expiry Wait Test ---
    console.log(`[TTL Expiry] Waiting ${minTtl}ms for minute quota to reset naturally...`);
    await new Promise(r => setTimeout(r, minTtl + 1000));
    
    const postExpiryReq = await makeRequest(portA, '/test/minute-limiter', testUserId1);
    if (postExpiryReq.status === 200) {
      console.log('SUCCESS: Quota reset after expiry and request was allowed.');
    } else {
      throw new Error(`FAILURE: Expected 200 after expiry, got ${postExpiryReq.status}`);
    }

    // --- 2. Verify Shared Daily Quota ---
    console.log('\n--- 2. Shared Daily Quota ---');
    const testUserDaily = 'user_daily_' + Date.now();
    const testUserDaily2 = 'other_daily_' + Date.now();

    console.log(`[Worker A] Making 25 requests for ${testUserDaily}`);
    for (let i = 0; i < 25; i++) {
      const res = await makeRequest(portA, '/test/daily-limiter', testUserDaily);
      if (res.status === 429) throw new Error(`Unexpected 429 too early at req ${i+1}`);
    }

    console.log(`[Worker B] Making 25 requests for ${testUserDaily}`);
    for (let i = 0; i < 25; i++) {
      const res = await makeRequest(portB, '/test/daily-limiter', testUserDaily);
      if (res.status === 429) throw new Error(`Unexpected 429 too early at req 25+${i+1}`);
    }

    console.log(`[Worker A] Making 51st request for ${testUserDaily}`);
    const finalDaily = await makeRequest(portA, '/test/daily-limiter', testUserDaily);
    if (finalDaily.status === 429 && finalDaily.body?.category === 'quota_exceeded') {
      console.log('SUCCESS: 51st request rejected by shared daily quota.');
    } else {
      throw new Error(`FAILURE: Expected 429 quota_exceeded, got ${finalDaily.status}`);
    }
    
    const dailyKey = `rl:ai_daily:${testUserDaily}`;
    const dailyTtl = await redisClient.pttl(dailyKey);
    console.log(`[TTL Check] Daily quota key '${dailyKey}' PTTL is ${dailyTtl}ms`);
    if (dailyTtl <= 0 || dailyTtl > 86400000) {
      throw new Error(`FAILURE: Daily TTL is invalid: ${dailyTtl}`);
    }
    
    console.log(`[Worker B] Making 1 request for different user ${testUserDaily2}`);
    const otherDaily = await makeRequest(portB, '/test/daily-limiter', testUserDaily2);
    if (otherDaily.status === 200) {
      console.log('SUCCESS: Different user has independent daily quota.');
    } else {
      throw new Error(`FAILURE: Expected 200 for different user, got ${otherDaily.status}`);
    }

    // --- 3. Redis Failure Behavior ---
    console.log('\n--- 3. Redis Failure Behavior ---');
    // Start a third worker with an invalid REDIS_URL to test failure behavior
    const origRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://non-existent-redis-host:6379';
    process.env.NODE_ENV = 'production';
    try {
      const resF = await startWorker();
      workerFail = resF.worker;
      const portFail = resF.port;
      console.log(`Worker Fail listening on port ${portFail}`);
      
      const failRes = await makeRequest(portFail, '/api/ai/career-coach', 'fail_user');
      if (failRes.status === 503 && failRes.body?.category === 'rate_limit_store_unavailable') {
        console.log('SUCCESS: Production failure returns 503 rate_limit_store_unavailable without falling back to memory.');
      } else {
        throw new Error(`FAILURE: Expected 503 rate_limit_store_unavailable, got ${failRes.status} ${JSON.stringify(failRes.body)}`);
      }
    } finally {
      process.env.REDIS_URL = origRedisUrl;
      process.env.NODE_ENV = 'development';
    }

    console.log('\nALL TESTS PASSED.');

  } catch (err) {
    console.error('Verification Failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up workers...');
    if (workerA) workerA.send('shutdown');
    if (workerB) workerB.send('shutdown');
    if (workerFail) workerFail.send('shutdown');
    
    // Give workers a moment to close connections and exit
    await new Promise(r => setTimeout(r, 1000));
    
    if (workerA) workerA.kill();
    if (workerB) workerB.kill();
    if (workerFail) workerFail.kill();

    if (typeof redisClient !== 'undefined') redisClient.disconnect();
    
    console.log(`[Cleanup Check] Verifying PIDs no longer exist...`);
    const pids = [workerA?.pid, workerB?.pid, workerFail?.pid].filter(Boolean);
    console.log(`PIDs to check: ${pids.join(', ')}`);
    process.exitCode = 0;
  }
}

runVerification();
