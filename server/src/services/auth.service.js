import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Profile } from '../models/Profile.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { comparePassword, hashPassword } from './password.service.js';

function authenticationError() {
  const error = new Error('Invalid email or password');
  error.statusCode = 401;
  return error;
}

export function toSafeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    profileId: user.profileId?.toString() ?? null,
  };
}

export function generateAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.auth.accessTokenExpiresIn,
  });
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function getRefreshCookieOptions() {
  const isProduction = env.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: env.auth.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(response, rawToken) {
  response.cookie(env.auth.refreshCookieName, rawToken, getRefreshCookieOptions());
}

export function clearRefreshCookie(response) {
  response.cookie(env.auth.refreshCookieName, '', {
    ...getRefreshCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function createRefreshSession({ userId, family, ip, userAgent }) {
  const rawToken = generateRefreshToken();
  const tokenHash = hashToken(rawToken);
  const sessionFamily = family || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.auth.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId,
    tokenHash,
    family: sessionFamily,
    expiresAt,
    createdByIp: ip || null,
    userAgent: userAgent || null,
  });

  return {
    refreshToken: rawToken,
    expiresAt,
  };
}

export async function rotateRefreshSession(rawToken, { ip, userAgent } = {}) {
  if (!rawToken || typeof rawToken !== 'string') {
    const error = new Error('Refresh token is required');
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashToken(rawToken);
  const session = await RefreshToken.findOne({ tokenHash });

  if (!session) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    throw error;
  }

  // Reuse Detection:
  // If an already revoked token is used, someone may have intercepted an old token.
  // Invalidate the entire token family immediately to protect the user account.
  if (session.isRevoked) {
    await RefreshToken.updateMany(
      { family: session.family },
      { isRevoked: true, revokedAt: new Date() }
    );
    const error = new Error('Revoked refresh token reuse detected. Session terminated.');
    error.statusCode = 401;
    throw error;
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    session.isRevoked = true;
    session.revokedAt = new Date();
    await session.save();
    const error = new Error('Refresh token expired');
    error.statusCode = 401;
    throw error;
  }

  // Find user and confirm active
  const user = await User.findById(session.userId);
  if (!user || !user.isActive) {
    session.isRevoked = true;
    session.revokedAt = new Date();
    await session.save();
    const error = new Error('User account is inactive or not found');
    error.statusCode = 401;
    throw error;
  }

  // Rotate: generate new token, revoke current token, record replacement hash
  const newRawToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawToken);
  const newExpiresAt = new Date(Date.now() + env.auth.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000);

  session.isRevoked = true;
  session.revokedAt = new Date();
  session.replacedByTokenHash = newTokenHash;
  await session.save();

  // Create new session document in same rotation family
  await RefreshToken.create({
    userId: user._id,
    tokenHash: newTokenHash,
    family: session.family,
    expiresAt: newExpiresAt,
    createdByIp: ip || null,
    userAgent: userAgent || null,
  });

  const newAccessToken = generateAccessToken(user);

  return {
    user: toSafeUser(user),
    accessToken: newAccessToken,
    refreshToken: newRawToken,
    expiresAt: newExpiresAt,
  };
}

export async function revokeRefreshSession(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return;
  }
  const tokenHash = hashToken(rawToken);
  await RefreshToken.updateOne(
    { tokenHash },
    { isRevoked: true, revokedAt: new Date() }
  );
}

export async function createAccount({ email, password, firstName, lastName }, meta = {}) {
  const session = await mongoose.startSession();
  let user;

  try {
    await session.withTransaction(async () => {
      const passwordHash = await hashPassword(password);
      [user] = await User.create([{ email, passwordHash }], { session });
      const [profile] = await Profile.create([{
        userId: user._id,
        personal: { firstName, lastName, displayName: `${firstName}${lastName ? ` ${lastName}` : ''}` },
      }], { session });

      user.profileId = profile._id;
      await user.save({ session });
    });

    const refreshSession = await createRefreshSession({
      userId: user._id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: toSafeUser(user),
      token: generateAccessToken(user),
      refreshToken: refreshSession.refreshToken,
    };
  } finally {
    await session.endSession();
  }
}

export async function authenticateCredentials(email, password, meta = {}) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive || !(await comparePassword(password, user.passwordHash))) {
    throw authenticationError();
  }

  const refreshSession = await createRefreshSession({
    userId: user._id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    user: toSafeUser(user),
    token: generateAccessToken(user),
    refreshToken: refreshSession.refreshToken,
  };
}

export async function getAuthenticatedUser(userId) {
  return User.findById(userId).select('-passwordHash');
}
