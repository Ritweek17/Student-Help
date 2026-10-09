import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from './setup.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { hashToken, createAccount } from '../src/services/auth.service.js';

function getCookie(res, cookieName) {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return null;
  const raw = cookies.find((c) => c.startsWith(`${cookieName}=`));
  if (!raw) return null;
  const parts = raw.split(';').map((p) => p.trim());
  const [name, value] = parts[0].split('=');
  return {
    value,
    raw,
    isHttpOnly: parts.some((p) => p.toLowerCase() === 'httponly'),
    isSecure: parts.some((p) => p.toLowerCase() === 'secure'),
    path: parts.find((p) => p.toLowerCase().startsWith('path='))?.split('=')[1],
    sameSite: parts.find((p) => p.toLowerCase().startsWith('samesite='))?.split('=')[1],
    maxAge: parts.find((p) => p.toLowerCase().startsWith('max-age='))?.split('=')[1],
  };
}

describe('CareerOS Authentication Test Suite (Vitest + In-Memory ReplSet)', () => {
  const cookieName = env.auth.refreshCookieName;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  // ==========================================
  // 1. Database & Environment Isolation
  // ==========================================
  describe('Environment & Test Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Core Auth: Signup Flow
  // ==========================================
  describe('POST /api/auth/signup', () => {
    const validUser = {
      email: 'student.vitest@example.test',
      password: 'Password123!',
      firstName: 'Vitest',
      lastName: 'Student',
    };

    it('successfully registers a user, creates user/profile references, and sets HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeTypeOf('string');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();

      // Verify database records
      const dbUser = await User.findById(res.body.user.id).select('+passwordHash');
      expect(dbUser).not.toBeNull();
      expect(dbUser.passwordHash).toMatch(/^\$2/); // bcrypt prefix
      expect(dbUser.passwordHash).not.toBe(validUser.password);

      const dbProfile = await Profile.findOne({ userId: dbUser._id });
      expect(dbProfile).not.toBeNull();
      expect(dbUser.profileId.toString()).toBe(dbProfile._id.toString());
      expect(dbProfile.personal.displayName).toBe('Vitest Student');

      // Verify HttpOnly cookie
      const cookie = getCookie(res, cookieName);
      expect(cookie).not.toBeNull();
      expect(cookie.isHttpOnly).toBe(true);
      expect(cookie.path).toBe('/api/auth');
      expect(cookie.value.length).toBeGreaterThan(30);

      // Verify refresh session in DB is hashed
      const session = await RefreshToken.findOne({ tokenHash: hashToken(cookie.value) });
      expect(session).not.toBeNull();
      expect(session.userId.toString()).toBe(dbUser._id.toString());
      expect(session.isRevoked).toBe(false);
    });

    it('rejects duplicate email with HTTP 409', async () => {
      await request(app).post('/api/auth/signup').send(validUser);
      const res = await request(app).post('/api/auth/signup').send(validUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects invalid email with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects passwords shorter than 8 characters with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 3. Core Auth: Login Flow
  // ==========================================
  describe('POST /api/auth/login', () => {
    const userCredentials = {
      email: 'login.test@example.test',
      password: 'SecurePassword123!',
      firstName: 'Login',
      lastName: 'Tester',
    };

    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(userCredentials);
    });

    it('authenticates valid credentials and issues access token + HttpOnly refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeTypeOf('string');
      expect(res.body.user.email).toBe(userCredentials.email);
      expect(res.body.refreshToken).toBeUndefined();

      const cookie = getCookie(res, cookieName);
      expect(cookie).not.toBeNull();
      expect(cookie.isHttpOnly).toBe(true);
      expect(cookie.path).toBe('/api/auth');

      // Verify raw token is never saved
      const rawInDb = await RefreshToken.findOne({ tokenHash: cookie.value });
      expect(rawInDb).toBeNull();
      const hashInDb = await RefreshToken.findOne({ tokenHash: hashToken(cookie.value) });
      expect(hashInDb).not.toBeNull();
    });

    it('rejects wrong password with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: 'IncorrectPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unknown email with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.test',
          password: userCredentials.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects inactive user with HTTP 401', async () => {
      const dbUser = await User.findOne({ email: userCredentials.email });
      dbUser.isActive = false;
      await dbUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 4. Protected Route: /api/auth/me
  // ==========================================
  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'me.test@example.test',
          password: 'Password123!',
          firstName: 'Me',
          lastName: 'Tester',
        });
      token = signupRes.body.token;
      userId = signupRes.body.user.id;
    });

    it('allows access with valid access token and returns safe user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects request without authorization header with HTTP 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects request with malformed or invalid token with HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects request with expired token with HTTP 401', async () => {
      const expiredToken = jwt.sign(
        { sub: userId, role: 'student' },
        env.jwtSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 5. Refresh Flow & Deterministic Rotation
  // ==========================================
  describe('POST /api/auth/refresh', () => {
    let initialCookie;
    let userEmail;

    beforeEach(async () => {
      userEmail = 'refresh.test@example.test';
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: userEmail,
          password: 'Password123!',
          firstName: 'Refresh',
          lastName: 'Tester',
        });
      initialCookie = getCookie(signupRes, cookieName);
    });

    it('renews access token and rotates refresh cookie on valid refresh request', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`${cookieName}=${initialCookie.value}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeTypeOf('string');
      expect(res.body.user.email).toBe(userEmail);
      expect(res.body.refreshToken).toBeUndefined();

      // Verify newly rotated cookie is returned
      const rotatedCookie = getCookie(res, cookieName);
      expect(rotatedCookie).not.toBeNull();
      expect(rotatedCookie.isHttpOnly).toBe(true);
      expect(rotatedCookie.value).not.toBe(initialCookie.value);

      // Verify old token is marked revoked and successor recorded
      const oldSession = await RefreshToken.findOne({ tokenHash: hashToken(initialCookie.value) });
      expect(oldSession.isRevoked).toBe(true);
      expect(oldSession.replacedByTokenHash).toBe(hashToken(rotatedCookie.value));

      // Verify new token is active
      const newSession = await RefreshToken.findOne({ tokenHash: hashToken(rotatedCookie.value) });
      expect(newSession.isRevoked).toBe(false);
      expect(newSession.family).toBe(oldSession.family);
    });

    it('rejects refresh request without cookie with HTTP 401', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects expired refresh token with HTTP 401', async () => {
      const dbSession = await RefreshToken.findOne({ tokenHash: hashToken(initialCookie.value) });
      dbSession.expiresAt = new Date(Date.now() - 1000); // expired
      await dbSession.save();

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`${cookieName}=${initialCookie.value}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. Reuse Detection & Family Invalidation
  // ==========================================
  describe('Refresh Token Reuse Detection', () => {
    it('detects rotated token reuse, terminates request with 401, and invalidates entire family', async () => {
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'reuse.test@example.test',
          password: 'Password123!',
          firstName: 'Reuse',
          lastName: 'Tester',
        });
      const token1 = getCookie(signupRes, cookieName);

      // Legitimate rotation 1 -> gives token2
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`${cookieName}=${token1.value}`]);
      expect(refreshRes.status).toBe(200);
      const token2 = getCookie(refreshRes, cookieName);
      expect(token2.value).not.toBe(token1.value);

      // Malicious/stale reuse: presenting token1 again
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`${cookieName}=${token1.value}`]);
      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.message).toMatch(/reuse detected/i);

      // Verify that token2 from the same family is now also revoked
      const token2Doc = await RefreshToken.findOne({ tokenHash: hashToken(token2.value) });
      expect(token2Doc.isRevoked).toBe(true);

      // Attempting to refresh with token2 must now fail
      const compromisedRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`${cookieName}=${token2.value}`]);
      expect(compromisedRes.status).toBe(401);
    });
  });

  // ==========================================
  // 7. Logout Invalidation
  // ==========================================
  describe('POST /api/auth/logout', () => {
    it('revokes refresh session in DB and clears HttpOnly cookie', async () => {
      const loginRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'logout.test@example.test',
          password: 'Password123!',
          firstName: 'Logout',
          lastName: 'Tester',
        });
      const cookie = getCookie(loginRes, cookieName);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`${cookieName}=${cookie.value}`]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Cookie cleared
      const clearedCookie = getCookie(logoutRes, cookieName);
      expect(clearedCookie).not.toBeNull();
      expect(clearedCookie.maxAge === '0' || clearedCookie.value === '').toBe(true);

      // Session revoked in DB
      const sessionDoc = await RefreshToken.findOne({ tokenHash: hashToken(cookie.value) });
      expect(sessionDoc.isRevoked).toBe(true);

      // Subsequent refresh fails
      const retryRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`${cookieName}=${cookie.value}`]);
      expect(retryRefresh.status).toBe(401);
    });
  });

  // ==========================================
  // 8. Mongoose Transaction Verification
  // ==========================================
  describe('Mongoose Transactions on In-Memory Replica Set', () => {
    it('proves multi-document atomic commit across User and Profile', async () => {
      const email = 'txn-commit@example.test';
      const result = await createAccount({
        email,
        password: 'Password123!',
        firstName: 'Atomic',
        lastName: 'Commit',
      });

      expect(result.user).toBeDefined();
      const u = await User.findById(result.user.id);
      const p = await Profile.findOne({ userId: u._id });

      expect(u).not.toBeNull();
      expect(p).not.toBeNull();
      expect(u.profileId.toString()).toBe(p._id.toString());
      expect(p.userId.toString()).toBe(u._id.toString());
    });

    it('proves transaction aborts and rolls back completely on mid-transaction failure', async () => {
      const rollbackEmail = 'rollback-atomic@example.test';
      const session = await mongoose.startSession();

      let caughtError = null;
      try {
        await session.withTransaction(async () => {
          // 1. Create user in session
          await User.create([{ email: rollbackEmail, passwordHash: 'dummyhash' }], { session });

          // 2. Abort transaction midway via thrown exception
          throw new Error('Mid-transaction abort test');
        });
      } catch (err) {
        caughtError = err;
      } finally {
        await session.endSession();
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toBe('Mid-transaction abort test');

      // Verify that no orphaned User was persisted
      const orphanedUser = await User.findOne({ email: rollbackEmail });
      expect(orphanedUser).toBeNull();
    });
  });
});
