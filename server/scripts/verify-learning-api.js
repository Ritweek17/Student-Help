import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { LearningTrack } from '../src/models/LearningTrack.js';
import { LearningItem } from '../src/models/LearningItem.js';
import { LearningResource } from '../src/models/LearningResource.js';
import { UserLearningProgress } from '../src/models/UserLearningProgress.js';
import { generateAccessToken } from '../src/services/auth.service.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, path, options = {}) {
  const { headers, ...rest } = options;
  return fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function runTests() {
  let server;
  const verificationId = `learning-${Date.now()}`;
  
  try {
    await mongoose.connect(env.mongodbUri);
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Create a user for auth token
    const user = await User.create({ email: `${verificationId}@example.com`, passwordHash: 'hash', role: 'student' });
    const token = generateAccessToken(user);
    const headers = { authorization: `Bearer ${token}` };

    // --- Create test data ---
    const track = await LearningTrack.create({
      title: 'Test Track',
      category: 'Test',
      description: 'A test track',
      isActive: true
    });

    const item = await LearningItem.create({
      trackId: track._id,
      title: 'Test Item',
      duration: '10m',
      order: 1
    });

    const resource = await LearningResource.create({
      trackId: track._id,
      title: 'Test Resource',
      type: 'Doc',
      url: 'https://test.com'
    });

    // --- Validation tests ---
    console.log('Testing schema and validation...');
    let validationError;
    try {
      await UserLearningProgress.create({ userId: user._id, trackId: track._id, itemId: item._id, status: 'InvalidStatus' });
    } catch (err) {
      validationError = err;
    }
    assert(validationError && validationError.errors.status, 'Progress status validation failed');

    // --- Authentication Boundary & Access ---
    console.log('Testing authentication boundary...');
    const noAuthResponse = await request(baseUrl, '/api/learning/tracks');
    assert(noAuthResponse.status === 401, 'Unauthenticated access not rejected with 401');

    console.log('Testing GET /api/learning/tracks...');
    const tracksResponse = await request(baseUrl, '/api/learning/tracks', { headers });
    if (tracksResponse.status !== 200) console.error(await tracksResponse.text());
    assert(tracksResponse.status === 200, 'GET tracks failed');
    const tracksData = await tracksResponse.json();
    assert(tracksData.success && tracksData.data.length > 0, 'GET tracks returned invalid data');

    console.log('Testing GET /api/learning/tracks/:id...');
    const trackResponse = await request(baseUrl, `/api/learning/tracks/${track._id}`, { headers });
    assert(trackResponse.status === 200, 'GET track by ID failed');

    console.log('Testing GET /api/learning/tracks/:id/items...');
    const itemsResponse = await request(baseUrl, `/api/learning/tracks/${track._id}/items`, { headers });
    assert(itemsResponse.status === 200, 'GET track items failed');

    console.log('Testing GET /api/learning/resources...');
    const resourcesResponse = await request(baseUrl, '/api/learning/resources', { headers });
    assert(resourcesResponse.status === 200, 'GET resources failed');

    // --- Progress Update & Persistence ---
    console.log('Testing progress update and persistence...');
    const body = JSON.stringify({ trackId: track._id, itemId: item._id, status: 'Completed' });
    console.log('Sending body:', body);
    const progressResponse = await request(baseUrl, '/api/learning/progress', {
      method: 'PATCH',
      headers,
      body
    });
    if (progressResponse.status !== 200) console.error(await progressResponse.text());
    assert(progressResponse.status === 200, 'PATCH progress failed');

    // Fetch tracks again to check if completedItems changed
    const updatedTracksRes = await request(baseUrl, '/api/learning/tracks', { headers });
    const updatedTracksData = await updatedTracksRes.json();
    const updatedTrack = updatedTracksData.data.find(t => t.id === track._id.toString());
    assert(updatedTrack.completedItems === 1, 'Progress not reflected in track aggregation');
    assert(updatedTrack.progress === 100, 'Progress percentage not computed properly');
    assert(updatedTrack.status === 'Completed', 'Track status not computed correctly');

    // --- Write Rejection for Content ---
    console.log('Testing student write rejection for content...');
    const postTrackRes = await request(baseUrl, '/api/learning/tracks', {
      method: 'POST', headers, body: JSON.stringify({ title: 'Hacked' })
    });
    assert(postTrackRes.status === 404, 'POST to tracks not rejected (404)'); // Because route doesn't exist

    // --- Recommended Next ---
    console.log('Testing Recommended Next...');
    const recResponse = await request(baseUrl, '/api/learning/recommended', { headers });
    assert(recResponse.status === 200, 'GET recommended failed');

    console.log('--- ALL LEARNING VERIFICATION SUITE TESTS PASSED ---');
  } catch (error) {
    console.error('Verification Failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await User.deleteMany({ email: { $regex: 'learning-' } });
    await mongoose.disconnect();
  }
}

runTests();
