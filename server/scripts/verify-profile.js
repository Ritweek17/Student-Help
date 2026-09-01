import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Profile } from '../src/models/Profile.js';
import { User } from '../src/models/User.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, path, options = {}) {
  const { headers, ...restOptions } = options;
  return fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...headers },
    ...restOptions,
  });
}


const verificationId = `phase31-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const userAEmail = `userA-${verificationId}@example.test`;
const userBEmail = `userB-${verificationId}@example.test`;
const testPassword = 'test-password-12345';

let server;
let userAId;
let userBId;
let userAToken;
let userBToken;

try {
  await connectDatabase();
  await Promise.all([User.init(), Profile.init()]);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // 1. Create User A and User B via /api/auth/signup
  const signupARes = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: testPassword, firstName: 'UserA', lastName: 'Test' }),
  });
  const signupA = await signupARes.json();
  assert(signupARes.status === 201 && signupA.token, 'Signup User A failed');
  userAToken = signupA.token;
  userAId = signupA.user.id;

  const signupBRes = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: userBEmail, password: testPassword, firstName: 'UserB', lastName: 'Test' }),
  });
  const signupB = await signupBRes.json();
  assert(signupBRes.status === 201 && signupB.token, 'Signup User B failed');
  userBToken = signupB.token;
  userBId = signupB.user.id;

  // 2. User A authenticated GET profile succeeds
  const getProfileARes = await request(baseUrl, '/api/profile', {
    headers: { authorization: `Bearer ${userAToken}` },
  });
  const profileAData = await getProfileARes.json();
  assert(getProfileARes.status === 200 && profileAData.success, 'GET User A profile failed');
  assert(profileAData.profile.personal.firstName === 'UserA', 'User A profile data mismatch');
  assert(!Object.hasOwn(profileAData.profile, 'passwordHash'), 'Exposed passwordHash in profile');

  // 3. User A authenticated PUT profile succeeds & persists
  const updatePayload = {
    personal: {
      displayName: 'User A Updated',
      phone: '+1234567890',
    },
    skills: [
      { name: 'JavaScript', level: 'advanced' },
      { name: 'React', level: 'intermediate' },
    ],
    professionalLinks: {
      github: 'https://github.com/user-a',
    },
  };

  const putProfileARes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${userAToken}` },
    body: JSON.stringify(updatePayload),
  });
  const putProfileAData = await putProfileARes.json();
  assert(putProfileARes.status === 200 && putProfileAData.success, 'PUT User A profile failed');
  assert(putProfileAData.profile.personal.displayName === 'User A Updated', 'DisplayName not updated');


  assert(putProfileAData.profile.personal.firstName === 'UserA', 'FirstName wiped on nested update');
  assert(putProfileAData.profile.personal.phone === '+1234567890', 'Phone not set');
  assert(putProfileAData.profile.skills.length === 2, 'Skills array not updated');

  // 4. GET after update returns updated data & partial nested update preserved fields
  const verifyGetRes = await request(baseUrl, '/api/profile', {
    headers: { authorization: `Bearer ${userAToken}` },
  });
  const verifyGetData = await verifyGetRes.json();
  assert(verifyGetData.profile.personal.displayName === 'User A Updated', 'Persisted GET displayName mismatch');
  assert(verifyGetData.profile.personal.firstName === 'UserA', 'Persisted GET firstName wiped');
  assert(verifyGetData.profile.professionalLinks.github === 'https://github.com/user-a', 'Persisted github URL mismatch');

  // 5. Partial nested update testing (update location without wiping displayName or phone)
  const partialNestedRes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({
      personal: {
        location: { city: 'Bengaluru', country: 'India' },
      },
    }),
  });
  const partialNestedData = await partialNestedRes.json();
  assert(partialNestedData.profile.personal.displayName === 'User A Updated', 'Nested update wiped displayName');
  assert(partialNestedData.profile.personal.phone === '+1234567890', 'Nested update wiped phone');
  assert(partialNestedData.profile.personal.location.city === 'Bengaluru', 'City not set');

  // 6. Invalid skill level returns 400
  const invalidSkillRes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({
      skills: [{ name: 'C++', level: 'master-ninja' }],
    }),
  });
  assert(invalidSkillRes.status === 400, 'Invalid skill level was not rejected with 400');

  // 7. Invalid URL returns 400
  const invalidUrlRes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({
      professionalLinks: { github: 'not-a-valid-url' },
    }),
  });
  assert(invalidUrlRes.status === 400, 'Invalid URL was not rejected with 400');

  // 8. Invalid CGPA returns 400
  const invalidCgpaRes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({
      education: [{ institution: 'Apex Tech', cgpa: 15 }],
    }),
  });
  assert(invalidCgpaRes.status === 400, 'Invalid CGPA > 10 was not rejected with 400');

  // 9. Unauthenticated GET returns 401
  const unauthGetRes = await request(baseUrl, '/api/profile');
  assert(unauthGetRes.status === 401, 'Unauthenticated GET was not rejected with 401');

  // 10. Unauthenticated PUT returns 401
  const unauthPutRes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    body: JSON.stringify({ personal: { displayName: 'Hacker' } }),
  });
  assert(unauthPutRes.status === 401, 'Unauthenticated PUT was not rejected with 401');

  // 11. Missing profile returns 404
  const testNoProfileUser = await User.create({
    email: `noprofile-${verificationId}@example.test`,
    passwordHash: 'dummyhash',
  });
  const testNoProfileToken = (await import('../src/services/auth.service.js')).generateAccessToken(testNoProfileUser);
  const noProfileRes = await request(baseUrl, '/api/profile', {
    headers: { authorization: `Bearer ${testNoProfileToken}` },
  });
  assert(noProfileRes.status === 404, 'Missing profile was not returned as 404');
  await User.deleteOne({ _id: testNoProfileUser._id });

  // 12 & 13. Cross-user isolation: User A cannot read or modify User B's profile
  const getBRes = await request(baseUrl, '/api/profile', {
    headers: { authorization: `Bearer ${userBToken}` },
  });
  const profileBData = await getBRes.json();
  assert(profileBData.profile.personal.firstName === 'UserB', 'User B profile mismatch');
  assert(profileBData.profile.userId.toString() === userBId, 'User B userId mismatch');

  // 14 & 15. Client ownership attack tests: body.userId / body.profileId override attempt
  const attackRes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({
      userId: userBId,
      profileId: profileBData.profile._id,
      personal: { displayName: 'User A Self Edit' },
    }),
  });
  const attackData = await attackRes.json();
  assert(attackRes.status === 200, 'Attack request failed');
  assert(attackData.profile.userId.toString() === userAId, 'Attack payload altered User A profile ownership');

  // Check User B profile to ensure User B was untouched by User A's update
  const verifyUserBRes = await request(baseUrl, '/api/profile', {
    headers: { authorization: `Bearer ${userBToken}` },
  });
  const verifyUserBData = await verifyUserBRes.json();
  assert(verifyUserBData.profile.personal.firstName === 'UserB', 'User B profile was modified by User A');
  assert(verifyUserBData.profile.personal.displayName !== 'User A Self Edit', 'User B displayName was overwritten');

  // 16. Forbidden system fields cannot overwrite ownership or system data
  const systemFieldRes = await request(baseUrl, '/api/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${userAToken}` },
    body: JSON.stringify({
      _id: '60c72b2f9b1d8b0015b6d000',
      userId: userBId,
      createdAt: '1970-01-01T00:00:00.000Z',
    }),
  });
  const systemFieldData = await systemFieldRes.json();
  assert(systemFieldData.profile.userId.toString() === userAId, 'System field attack changed userId');

  console.log('Profile API verification passed successfully');
} catch (error) {
  console.error('Profile API verification failed:', error);
  process.exitCode = 1;
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all([
    User.deleteMany({ email: { $in: [userAEmail, userBEmail] } }),
    userAId ? Profile.deleteMany({ userId: { $in: [userAId, userBId] } }) : Promise.resolve(),
  ]);
  await disconnectDatabase();
}
