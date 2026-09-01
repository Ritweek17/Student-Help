import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Profile } from '../models/Profile.js';
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
    expiresIn: env.jwtExpiresIn,
  });
}

export async function createAccount({ email, password, firstName, lastName }) {
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

    return {
      user: toSafeUser(user),
      token: generateAccessToken(user),
    };
  } finally {
    await session.endSession();
  }
}

export async function authenticateCredentials(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive || !(await comparePassword(password, user.passwordHash))) {
    throw authenticationError();
  }

  return {
    user: toSafeUser(user),
    token: generateAccessToken(user),
  };
}

export async function getAuthenticatedUser(userId) {
  return User.findById(userId).select('-passwordHash');
}
