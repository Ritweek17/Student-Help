import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Contest } from '../src/models/Contest.js';
import { generateAccessToken } from '../src/services/auth.service.js';

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

async function runTests() {
  let server;
  const verificationId = `contest-${Date.now()}`;
  
  try {
    await mongoose.connect(env.mongodbUri);
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Create a user for auth token
    const user = await User.create({ email: `${verificationId}@example.com`, passwordHash: 'hash', role: 'student' });
    const token = generateAccessToken(user);
    const headers = { authorization: `Bearer ${token}` };

    // --- 1-5. Model & Schema Validation ---
    console.log('Testing Model & Schema Validation...');
    let validationError;
    try {
      await Contest.create({ name: 'Short' }); // missing fields
    } catch (err) {
      validationError = err;
    }
    assert(validationError && validationError.errors.platform, 'Required platform field not enforced');
    assert(validationError.errors.eventDate, 'Required eventDate field not enforced');

    try {
      await Contest.create({
        name: 'Test Contest',
        platform: 'TestPlatform',
        contestUrl: 'invalid-url',
        eventDate: new Date(),
        endDate: new Date(),
        duration: '1h'
      });
    } catch (err) {
      validationError = err;
    }
    assert(validationError && validationError.errors.contestUrl, 'HTTP/HTTPS URL validation not enforced');

    // --- 14. Persistence against Replica Set ---
    console.log('Testing Persistence...');
    const contestDoc = await Contest.create({
      name: 'Valid Contest',
      platform: 'LeetCode',
      contestUrl: 'https://leetcode.com',
      eventDate: new Date('2026-10-10T10:00:00Z'),
      endDate: new Date('2026-10-10T11:00:00Z'),
      duration: '1h'
    });
    assert(contestDoc._id, 'Contest persistence failed');

    // --- 8. Authentication & Security Boundary ---
    console.log('Testing Authentication Boundary...');
    const noAuthResponse = await request(baseUrl, '/api/contests');
    assert(noAuthResponse.status === 401, 'Unauthenticated access not rejected with 401');

    // --- 6. GET /api/contests, 9. Student Read Access, 13. Query validation ---
    console.log('Testing GET /api/contests...');
    const listResponse = await request(baseUrl, '/api/contests?platform=LeetCode', { headers });
    assert(listResponse.status === 200, 'Student read access failed');
    const listData = await listResponse.json();
    assert(listData.success && Array.isArray(listData.contests) && listData.contests.length > 0, 'GET /api/contests returned invalid data');

    // --- 7. GET /api/contests/:id, 11. Malformed ObjectId, 12. Unknown contest ---
    console.log('Testing GET /api/contests/:id...');
    const getResponse = await request(baseUrl, `/api/contests/${contestDoc._id}`, { headers });
    assert(getResponse.status === 200, 'GET /api/contests/:id failed');
    const getData = await getResponse.json();
    assert(getData.success && getData.contest.name === 'Valid Contest', 'Returned wrong contest');

    const malformedResponse = await request(baseUrl, '/api/contests/invalid-id', { headers });
    assert(malformedResponse.status === 400, 'Malformed ObjectId not rejected with 400');

    const unknownResponse = await request(baseUrl, `/api/contests/${new mongoose.Types.ObjectId()}`, { headers });
    assert(unknownResponse.status === 404, 'Unknown contest not rejected with 404');

    // --- 10. Student Write Rejection ---
    console.log('Testing Write Rejection...');
    const postResponse = await request(baseUrl, '/api/contests', { method: 'POST', headers, body: JSON.stringify({ name: 'Hacked' }) });
    assert(postResponse.status === 404, 'POST to contests was not rejected (should be 404 Not Found since it is unimplemented)');
    const patchResponse = await request(baseUrl, `/api/contests/${contestDoc._id}`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'Hacked' }) });
    assert(patchResponse.status === 404, 'PATCH to contests was not rejected');
    const deleteResponse = await request(baseUrl, `/api/contests/${contestDoc._id}`, { method: 'DELETE', headers });
    assert(deleteResponse.status === 404, 'DELETE to contests was not rejected');

    console.log('--- ALL CONTEST VERIFICATION SUITE TESTS PASSED ---');
  } catch (error) {
    console.error('Verification Failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await Contest.deleteMany({});
    await User.deleteMany({ email: { $regex: 'contest-' } });
    await mongoose.disconnect();
  }
}

runTests();
