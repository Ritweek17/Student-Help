import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Profile } from '../src/models/Profile.js';
import { User } from '../src/models/User.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  });
}

const verificationId = `phase24-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `${verificationId}@example.test`;
const password = 'temporary-auth-test-password';
let server;
let userId;

try {
  await connectDatabase();
  await Promise.all([User.init(), Profile.init()]);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const healthResponse = await request(baseUrl, '/api/health');
  assert(healthResponse.status === 200, 'Health endpoint failed');

  const signupResponse = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, firstName: 'Phase', lastName: 'Verification' }),
  });
  const signup = await signupResponse.json();
  assert(signupResponse.status === 201 && signup.success && signup.token, 'Valid signup failed');
  assert(!Object.hasOwn(signup.user, 'passwordHash'), 'Signup exposed passwordHash');
  userId = signup.user.id;

  const storedUser = await User.findById(userId).select('+passwordHash');
  const profile = await Profile.findOne({ userId });
  assert(storedUser.passwordHash !== password && storedUser.passwordHash.startsWith('$2'), 'Password was not hashed');
  assert(storedUser.profileId.equals(profile._id) && profile.userId.equals(storedUser._id), 'User/Profile references failed');

  const duplicateResponse = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, firstName: 'Phase' }),
  });
  assert(duplicateResponse.status === 409, 'Duplicate email was not rejected');

  const invalidEmailResponse = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalid-email', password, firstName: 'Phase' }),
  });
  assert(invalidEmailResponse.status === 400, 'Invalid email was not rejected');

  const shortPasswordResponse = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: `short-${email}`, password: 'short', firstName: 'Phase' }),
  });
  assert(shortPasswordResponse.status === 400, 'Short password was not rejected');

  const loginResponse = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const login = await loginResponse.json();
  assert(loginResponse.status === 200 && login.success && login.token, 'Valid login failed');

  const wrongPasswordResponse = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'incorrect-password' }),
  });
  assert(wrongPasswordResponse.status === 401, 'Incorrect password was not rejected');

  const unknownEmailResponse = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `unknown-${email}`, password }),
  });
  assert(unknownEmailResponse.status === 401, 'Unknown email was not rejected');

  const meResponse = await request(baseUrl, '/api/auth/me', {
    headers: { authorization: `Bearer ${login.token}` },
  });
  const me = await meResponse.json();
  assert(meResponse.status === 200 && me.user.id === userId, 'Authenticated current-user request failed');
  assert(!Object.hasOwn(me.user, 'passwordHash'), 'Current-user response exposed passwordHash');

  const missingTokenResponse = await request(baseUrl, '/api/auth/me');
  assert(missingTokenResponse.status === 401, 'Missing token was not rejected');

  const invalidTokenResponse = await request(baseUrl, '/api/auth/me', {
    headers: { authorization: 'Bearer invalid-token' },
  });
  assert(invalidTokenResponse.status === 401, 'Invalid token was not rejected');

  const expiredToken = jwt.sign({ sub: userId, role: 'student' }, env.jwtSecret, { expiresIn: '-1s' });
  const expiredTokenResponse = await request(baseUrl, '/api/auth/me', {
    headers: { authorization: `Bearer ${expiredToken}` },
  });
  assert(expiredTokenResponse.status === 401, 'Expired token was not rejected');

  storedUser.isActive = false;
  await storedUser.save();
  const inactiveLoginResponse = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(inactiveLoginResponse.status === 401, 'Inactive user was not rejected');

  console.log('Authentication verification passed');
} catch (error) {
  console.error('Authentication verification failed.', { name: error.name, code: error.code });
  process.exitCode = 1;
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all([
    User.deleteMany({ email }),
    userId ? Profile.deleteMany({ userId }) : Promise.resolve(),
  ]);
  await disconnectDatabase();
}
