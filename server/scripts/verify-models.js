import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Profile } from '../src/models/Profile.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/services/password.service.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectValidationError(document, message) {
  try {
    await document.validate();
  } catch (error) {
    assert(error.name === 'ValidationError', message);
    return;
  }

  throw new Error(message);
}

async function expectDuplicateError(operation, message) {
  try {
    await operation();
  } catch (error) {
    assert(error.code === 11000, message);
    return;
  }

  throw new Error(message);
}

const verificationId = `phase23-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `${verificationId}@example.test`;
let userId;

try {
  await connectDatabase();
  await Promise.all([User.init(), Profile.init()]);
  const [userIndexes, profileIndexes] = await Promise.all([
    User.collection.indexes(),
    Profile.collection.indexes(),
  ]);
  assert(
    userIndexes.some((index) => index.unique && index.key.email === 1),
    'Unique email index was not created',
  );
  assert(
    profileIndexes.some((index) => index.unique && index.key.userId === 1),
    'Unique profile userId index was not created',
  );

  const user = await User.create({ email, passwordHash: await hashPassword('temporary-model-verification-password') });
  userId = user._id;
  const profile = await Profile.create({
    userId,
    personal: { displayName: 'Phase 2.3 Verification' },
    skills: [{ name: 'JavaScript', level: 'intermediate' }],
  });

  user.profileId = profile._id;
  await user.save();

  const savedUser = await User.findById(userId).lean();
  const savedProfile = await Profile.findById(profile._id).lean();
  assert(savedUser.profileId.equals(profile._id), 'User profileId relationship was not persisted');
  assert(savedProfile.userId.equals(userId), 'Profile userId relationship was not persisted');
  assert(savedUser.createdAt && savedUser.updatedAt, 'User timestamps were not persisted');
  assert(savedProfile.createdAt && savedProfile.updatedAt, 'Profile timestamps were not persisted');

  await expectDuplicateError(
    () => User.create({ email }),
    'Duplicate email was not rejected',
  );
  await expectDuplicateError(
    () => Profile.create({ userId }),
    'Duplicate profile userId was not rejected',
  );
  await expectValidationError(
    new User({ email: 'invalid-email' }),
    'Invalid email was not rejected',
  );
  await expectValidationError(
    new Profile({ userId: new User()._id, skills: [{ name: 'JavaScript', level: 'novice' }] }),
    'Invalid skill level was not rejected',
  );
  await expectValidationError(
    new Profile({ userId: new User()._id, professionalLinks: { github: 'not-a-url' } }),
    'Invalid URL was not rejected',
  );

  console.log('User and Profile model verification passed');
} catch (error) {
  console.error('User and Profile model verification failed.', { name: error.name, code: error.code });
  process.exitCode = 1;
} finally {
  await Promise.all([
    User.deleteMany({ email }),
    userId ? Profile.deleteMany({ userId }) : Promise.resolve(),
  ]);
  await disconnectDatabase();
}
