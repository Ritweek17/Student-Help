import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { User } from '../../src/models/User.js';
import { Profile } from '../../src/models/Profile.js';
import { hashPassword } from '../../src/services/password.service.js';

describe('CareerOS Models Test Suite — User & Profile Models', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([User.init(), Profile.init()]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  // ==========================================
  // 1. Database Isolation
  // ==========================================
  describe('Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Collection Indexes
  // ==========================================
  describe('Indexes', () => {
    it('creates unique email index on User and unique userId index on Profile', async () => {
      const [userIndexes, profileIndexes] = await Promise.all([
        User.collection.indexes(),
        Profile.collection.indexes(),
      ]);

      const hasUniqueEmail = userIndexes.some((index) => index.unique && index.key.email === 1);
      const hasUniqueUserId = profileIndexes.some((index) => index.unique && index.key.userId === 1);

      expect(hasUniqueEmail).toBe(true);
      expect(hasUniqueUserId).toBe(true);
    });
  });

  // ==========================================
  // 3. User & Profile Persistence & Relationships
  // ==========================================
  describe('User & Profile Persistence & Relationships', () => {
    it('creates user and profile, links references, and persists timestamps', async () => {
      const email = `model-test-${Date.now()}@example.test`;
      const passwordHash = await hashPassword('temporary-model-verification-password');

      const user = await User.create({ email, passwordHash });
      const profile = await Profile.create({
        userId: user._id,
        personal: { displayName: 'Phase 2.3 Verification' },
        skills: [{ name: 'JavaScript', level: 'intermediate' }],
      });

      user.profileId = profile._id;
      await user.save();

      const savedUser = await User.findById(user._id).lean();
      const savedProfile = await Profile.findById(profile._id).lean();

      expect(savedUser.profileId.toString()).toBe(profile._id.toString());
      expect(savedProfile.userId.toString()).toBe(user._id.toString());
      expect(savedUser.createdAt).toBeDefined();
      expect(savedUser.updatedAt).toBeDefined();
      expect(savedProfile.createdAt).toBeDefined();
      expect(savedProfile.updatedAt).toBeDefined();
    });
  });

  // ==========================================
  // 4. Unique Constraints
  // ==========================================
  describe('Unique Constraints', () => {
    it('rejects duplicate email with E11000', async () => {
      const email = `duplicate-email-${Date.now()}@example.test`;
      const passwordHash = await hashPassword('password123');

      await User.create({ email, passwordHash });

      await expect(
        User.create({ email, passwordHash: 'duplicate-test-hash' }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('rejects duplicate profile userId with E11000', async () => {
      const email = `profile-dup-${Date.now()}@example.test`;
      const passwordHash = await hashPassword('password123');
      const user = await User.create({ email, passwordHash });

      await Profile.create({ userId: user._id });

      await expect(
        Profile.create({ userId: user._id }),
      ).rejects.toMatchObject({ code: 11000 });
    });
  });

  // ==========================================
  // 5. Schema Validation Behavior
  // ==========================================
  describe('Schema Validation Behavior', () => {
    it('rejects invalid email format', async () => {
      const invalidUser = new User({ email: 'invalid-email' });
      await expect(invalidUser.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid skill level enum', async () => {
      const dummyUserId = new mongoose.Types.ObjectId();
      const invalidProfile = new Profile({
        userId: dummyUserId,
        skills: [{ name: 'JavaScript', level: 'novice' }],
      });
      await expect(invalidProfile.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid URL in professionalLinks', async () => {
      const dummyUserId = new mongoose.Types.ObjectId();
      const invalidProfile = new Profile({
        userId: dummyUserId,
        professionalLinks: { github: 'not-a-url' },
      });
      await expect(invalidProfile.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });
  });
});
