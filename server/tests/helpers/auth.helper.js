import { User } from '../../src/models/User.js';
import { generateAccessToken } from '../../src/services/auth.service.js';

/**
 * Creates an isolated test user and returns the user document and signed access token.
 * @param {string} prefix - Email prefix to differentiate test contexts
 * @param {string} role - Role of the user, defaults to 'student'
 * @returns {Promise<{ user: import('mongoose').Document, token: string }>}
 */
export async function createTestUser(prefix = 'user', role = 'student') {
  const user = await User.create({
    email: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.test`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    role,
  });

  const token = generateAccessToken(user);
  return { user, token };
}
