import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../src/config/db.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { createRefreshSession, hashToken } from '../src/services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(message);
  }
  passed++;
  console.log(`  ✓ [PASS ${passed}] ${message}`);
}

function extractCookie(response, cookieName) {
  const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')];
  for (const c of cookies) {
    if (!c) continue;
    const parts = c.split(';').map((p) => p.trim());
    const [name, val] = parts[0].split('=');
    if (name === cookieName) {
      return {
        value: val,
        raw: c,
        isHttpOnly: parts.some((p) => p.toLowerCase() === 'httponly'),
        isSecure: parts.some((p) => p.toLowerCase() === 'secure'),
        path: parts.find((p) => p.toLowerCase().startsWith('path='))?.split('=')[1] || '/',
        maxAge: parts.find((p) => p.toLowerCase().startsWith('max-age='))?.split('=')[1],
      };
    }
  }
  return null;
}

async function request(baseUrl, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  });
}

console.log('====================================================');
console.log('CAREEROS PHASE 10B — AUTHENTICATION MODERNIZATION');
console.log('HTTP-ONLY COOKIES & ROTATING REFRESH TOKENS');
console.log('====================================================');

let server;
let baseUrl;

try {
  // 1. Connect to Database & Start Server
  console.log('\n--- 1. Infrastructure Readiness & Connection ---');
  await connectDatabase({ maxRetries: 3, initialDelayMs: 200 });
  assert(isDatabaseConnected() === true, 'Database connects successfully');
  try {
    await RefreshToken.collection.dropIndex('expiresAt_1');
  } catch {}
  await Promise.all([User.init(), Profile.init(), RefreshToken.init()]);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running on ${baseUrl}`);

  const testId = `phase10b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `${testId}@example.test`;
  const password = 'StrongPassword123!';
  const cookieName = env.auth.refreshCookieName;

  // ----------------------------------------------------
  // SECTION 2: Signup Flow & Cookie Setting
  // ----------------------------------------------------
  console.log('\n--- 2. Signup Flow & Cookie Setting ---');
  const signupRes = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, firstName: 'Modern', lastName: 'Auth' }),
  });
  assert(signupRes.status === 201, 'Signup returns HTTP 201');

  const signupBody = await signupRes.json();
  assert(signupBody.success === true, 'Signup returns success: true');
  assert(typeof signupBody.token === 'string', 'Signup returns short-lived access token in body');
  assert(signupBody.user && signupBody.user.email === email, 'Signup returns safe user object');
  assert(!signupBody.refreshToken, 'Refresh token is NOT exposed in signup JSON response');

  const signupCookie = extractCookie(signupRes, cookieName);
  assert(signupCookie !== null, 'Signup sets refresh token cookie');
  assert(signupCookie.isHttpOnly === true, 'Refresh cookie has HttpOnly flag set to true');
  assert(signupCookie.path === '/api/auth', 'Refresh cookie is scoped to path /api/auth');
  assert(signupCookie.value.length > 30, 'Refresh cookie contains high-entropy opaque token');

  // Verify access token works
  const meRes = await request(baseUrl, '/api/auth/me', {
    headers: { Authorization: `Bearer ${signupBody.token}` },
  });
  assert(meRes.status === 200, 'Access token successfully authorizes /api/auth/me');

  // ----------------------------------------------------
  // SECTION 3: Login Flow & Refresh Cookie
  // ----------------------------------------------------
  console.log('\n--- 3. Login Flow & Refresh Cookie ---');
  const loginRes = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(loginRes.status === 200, 'Login returns HTTP 200');

  const loginBody = await loginRes.json();
  assert(loginBody.success === true && typeof loginBody.token === 'string', 'Login returns short-lived access token');
  assert(!loginBody.refreshToken, 'Refresh token is NOT exposed in login JSON response');

  const loginCookie = extractCookie(loginRes, cookieName);
  assert(loginCookie !== null, 'Login sets refresh token cookie');
  assert(loginCookie.isHttpOnly === true, 'Login refresh cookie is HttpOnly');

  // Verify raw token is NOT in database, only SHA-256 hash
  const storedSession = await RefreshToken.findOne({ tokenHash: hashToken(loginCookie.value) });
  assert(storedSession !== null, 'Hashed refresh token exists in database');
  const rawMatch = await RefreshToken.findOne({ tokenHash: loginCookie.value });
  assert(rawMatch === null, 'Raw refresh token is NEVER stored unhashed in database');

  // ----------------------------------------------------
  // SECTION 4: Rotation & Renewal via /api/auth/refresh
  // ----------------------------------------------------
  console.log('\n--- 4. Token Refresh & Deterministic Rotation ---');
  const refreshRes1 = await request(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: `${cookieName}=${loginCookie.value}`,
    },
  });
  assert(refreshRes1.status === 200, 'Refresh with valid cookie returns HTTP 200');

  const refreshBody1 = await refreshRes1.json();
  assert(refreshBody1.success === true, 'Refresh returns success: true');
  assert(typeof refreshBody1.token === 'string', 'Refresh returns renewed access token');
  assert(refreshBody1.user && refreshBody1.user.email === email, 'Refresh returns safe user');
  assert(!refreshBody1.refreshToken, 'Refresh token is NOT in refresh JSON response');

  const rotatedCookie1 = extractCookie(refreshRes1, cookieName);
  assert(rotatedCookie1 !== null, 'Refresh endpoint sets newly rotated cookie');
  assert(rotatedCookie1.value !== loginCookie.value, 'Refresh token has rotated to a new opaque string');

  // Verify old token was revoked in DB
  const oldSession = await RefreshToken.findOne({ tokenHash: hashToken(loginCookie.value) });
  assert(oldSession.isRevoked === true, 'Old refresh token document is marked isRevoked: true');
  assert(oldSession.replacedByTokenHash === hashToken(rotatedCookie1.value), 'Old token records replacement hash');

  // ----------------------------------------------------
  // SECTION 5: Reuse Detection & Family Invalidation
  // ----------------------------------------------------
  console.log('\n--- 5. Reuse Detection & Family Invalidation ---');
  // Attempt to use the OLD, already-rotated loginCookie again!
  const reuseRes = await request(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: `${cookieName}=${loginCookie.value}`,
    },
  });
  assert(reuseRes.status === 401, 'Reused rotated token is rejected with HTTP 401');

  // Check that entire family was revoked for security
  const rotatedSessionDoc = await RefreshToken.findOne({ tokenHash: hashToken(rotatedCookie1.value) });
  assert(rotatedSessionDoc.isRevoked === true, 'Reuse detection invalidates entire session family');

  // Attempting refresh with rotatedCookie1 should now also fail because family is compromised
  const compromisedRes = await request(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: `${cookieName}=${rotatedCookie1.value}`,
    },
  });
  assert(compromisedRes.status === 401, 'Subsequent requests from compromised family are rejected');

  // ----------------------------------------------------
  // SECTION 6: Expiration Handling
  // ----------------------------------------------------
  console.log('\n--- 6. Expired Token Rejection ---');
  // Create an expired session directly in DB
  const expiredRawToken = 'test-expired-raw-token-' + Date.now();
  await RefreshToken.create({
    userId: storedSession.userId,
    tokenHash: hashToken(expiredRawToken),
    family: 'expired-family-' + Date.now(),
    expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
  });

  const expiredRes = await request(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: `${cookieName}=${expiredRawToken}`,
    },
  });
  assert(expiredRes.status === 401, 'Expired refresh token is rejected with HTTP 401');

  // ----------------------------------------------------
  // SECTION 7: Logout Invalidation
  // ----------------------------------------------------
  console.log('\n--- 7. Logout Invalidation & Cookie Clearing ---');
  // Log in again to get fresh session
  const freshLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const freshCookie = extractCookie(freshLogin, cookieName);
  assert(freshCookie !== null, 'Fresh login succeeds before logout test');

  // Call logout
  const logoutRes = await request(baseUrl, '/api/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: `${cookieName}=${freshCookie.value}`,
    },
  });
  assert(logoutRes.status === 200, 'Logout endpoint returns HTTP 200');

  const clearedCookie = extractCookie(logoutRes, cookieName);
  assert(clearedCookie !== null, 'Logout response sends clearing cookie');
  assert(clearedCookie.maxAge === '0' || clearedCookie.value === '', 'Logout clears cookie with maxAge: 0');

  // Subsequent refresh attempt with logged-out cookie must fail
  const postLogoutRefresh = await request(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: `${cookieName}=${freshCookie.value}`,
    },
  });
  assert(postLogoutRefresh.status === 401, 'Refresh attempt after logout is rejected with HTTP 401');

  // ----------------------------------------------------
  // SECTION 8: Security Boundary & Unauthenticated Checks
  // ----------------------------------------------------
  console.log('\n--- 8. Security Boundary & Unauthenticated Checks ---');
  const badLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'WrongPassword!' }),
  });
  assert(badLogin.status === 401, 'Invalid credentials return HTTP 401');

  const unauthMe = await request(baseUrl, '/api/auth/me');
  assert(unauthMe.status === 401, 'Unauthenticated /api/auth/me returns HTTP 401');

  const missingCookieRefresh = await request(baseUrl, '/api/auth/refresh', { method: 'POST' });
  assert(missingCookieRefresh.status === 401, 'Refresh without cookie returns HTTP 401');

  // ----------------------------------------------------
  // SECTION 9: Token Storage Audit in Frontend
  // ----------------------------------------------------
  console.log('\n--- 9. Frontend Token Storage Audit ---');
  const authContextPath = path.resolve(__dirname, '../../src/context/AuthContext.jsx');
  const authContextContent = fs.readFileSync(authContextPath, 'utf8');

  // Check that sessionStorage is never used for tokens
  assert(!authContextContent.includes('sessionStorage.setItem'), 'AuthContext does not call sessionStorage.setItem');
  assert(!authContextContent.includes('sessionStorage.getItem'), 'AuthContext does not call sessionStorage.getItem');
  assert(!authContextContent.includes('localStorage.setItem'), 'AuthContext does not call localStorage.setItem');
  assert(!authContextContent.includes('localStorage.getItem'), 'AuthContext does not call localStorage.getItem');

  // ----------------------------------------------------
  // SECTION 10: Role and JWT Payload Integrity
  // ----------------------------------------------------
  console.log('\n--- 10. Role and JWT Payload Integrity ---');
  const finalLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const finalLoginBody = await finalLogin.json();
  const decoded = jwt.decode(finalLoginBody.token);
  assert(decoded.role === 'student', 'JWT payload retains correct student role');
  assert(typeof decoded.sub === 'string', 'JWT payload retains sub user id');

  console.log('\n====================================================');
  console.log(`✅ PHASE 10B VERIFICATION COMPLETE: ALL ${passed} CHECKS PASSED!`);
  console.log('====================================================');
} catch (error) {
  console.error('\n❌ Phase 10B Verification Failed:', error);
  process.exit(1);
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
}
