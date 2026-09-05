import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { SavedOpportunity } from '../src/models/SavedOpportunity.js';
import { User } from '../src/models/User.js';
import { app } from '../src/app.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let server;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, body: data };
}

const testRunId = `phase441-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testPrefix = `TestSaved ${testRunId}`;

let userA;
let userB;

try {
  await connectDatabase();

  // Create temporary User A and User B
  userA = await User.create({
    email: `usera-${testRunId}@example.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuvwwxyz123456',
    role: 'student',
    isActive: true,
  });

  userB = await User.create({
    email: `userb-${testRunId}@example.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuvwwxyz123456',
    role: 'student',
    isActive: true,
  });

  const tokenA = jwt.sign({ sub: userA._id.toString() }, env.jwtSecret, { expiresIn: '1h' });
  const tokenB = jwt.sign({ sub: userB._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

  const headersA = {
    Authorization: `Bearer ${tokenA}`,
    'Content-Type': 'application/json',
  };

  const headersB = {
    Authorization: `Bearer ${tokenB}`,
    'Content-Type': 'application/json',
  };

  // Create test opportunities: published, draft, archived, expired
  const pubOpp1 = await Opportunity.create({
    title: `${testPrefix} Published Opp 1`,
    organization: 'Org Alpha',
    description: 'Description 1',
    type: 'internship',
    status: 'published',
  });

  const pubOpp2 = await Opportunity.create({
    title: `${testPrefix} Published Opp 2`,
    organization: 'Org Beta',
    description: 'Description 2',
    type: 'hackathon',
    status: 'published',
  });

  const draftOpp = await Opportunity.create({
    title: `${testPrefix} Draft Opp`,
    organization: 'Org Gamma',
    description: 'Description Draft',
    type: 'workshop',
    status: 'draft',
  });

  const archivedOpp = await Opportunity.create({
    title: `${testPrefix} Archived Opp`,
    organization: 'Org Delta',
    description: 'Description Archived',
    type: 'conference',
    status: 'archived',
  });

  const expiredOpp = await Opportunity.create({
    title: `${testPrefix} Expired Opp`,
    organization: 'Org Epsilon',
    description: 'Description Expired',
    type: 'competition',
    status: 'expired',
  });

  // Start HTTP server
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  // 1-6. Model checks & compound unique index
  const directSave = await SavedOpportunity.create({
    userId: userA._id,
    opportunityId: pubOpp1._id,
  });
  assert(directSave._id, 'SavedOpportunity not created');
  assert(directSave.createdAt && directSave.updatedAt, 'Timestamps missing on SavedOpportunity');

  let duplicateCaught = false;
  try {
    await SavedOpportunity.create({
      userId: userA._id,
      opportunityId: pubOpp1._id,
    });
  } catch (err) {
    if (err.code === 11000) duplicateCaught = true;
  }
  assert(duplicateCaught, 'Compound unique index did not prevent duplicate creation at DB layer');

  // Remove direct test save for clean API testing
  await SavedOpportunity.deleteMany({ userId: userA._id });

  // 23-25. Security: Unauthenticated requests -> 401
  const resUnauthPost = await request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'POST' });
  assert(resUnauthPost.status === 401, 'Unauthenticated POST did not return 401');

  const resUnauthDelete = await request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'DELETE' });
  assert(resUnauthDelete.status === 401, 'Unauthenticated DELETE did not return 401');

  const resUnauthGet = await request('/api/saved-opportunities');
  assert(resUnauthGet.status === 401, 'Unauthenticated GET did not return 401');

  // 14-16. Visibility rules: cannot save draft, archived, or expired
  const resSaveDraft = await request(`/api/opportunities/${draftOpp._id}/save`, { method: 'POST', headers: headersA });
  assert(resSaveDraft.status === 404, 'Save draft opportunity did not return 404');
  assert(resSaveDraft.body.message === 'Opportunity not found', 'Leaked draft existence');

  const resSaveArchived = await request(`/api/opportunities/${archivedOpp._id}/save`, { method: 'POST', headers: headersA });
  assert(resSaveArchived.status === 404, 'Save archived opportunity did not return 404');

  const resSaveExpired = await request(`/api/opportunities/${expiredOpp._id}/save`, { method: 'POST', headers: headersA });
  assert(resSaveExpired.status === 404, 'Save expired opportunity did not return 404');

  // 7-10. Save endpoint & Idempotency & User Isolation
  // User A saves pubOpp1
  const resSaveA1 = await request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'POST', headers: headersA });
  assert(resSaveA1.status === 201, 'User A save pubOpp1 did not return 201');
  assert(resSaveA1.body.success === true && resSaveA1.body.saved === true, 'Save response invalid');

  // Duplicate save by User A -> 200
  const resSaveA1Dup = await request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'POST', headers: headersA });
  assert(resSaveA1Dup.status === 200, 'Duplicate save did not return 200');
  assert(resSaveA1Dup.body.saved === true, 'Duplicate save response invalid');

  // User B saves pubOpp1 independently -> 201
  const resSaveB1 = await request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'POST', headers: headersB });
  assert(resSaveB1.status === 201, 'User B save pubOpp1 did not return 201');

  // User A saves pubOpp2 -> 201
  const resSaveA2 = await request(`/api/opportunities/${pubOpp2._id}/save`, { method: 'POST', headers: headersA });
  assert(resSaveA2.status === 201, 'User A save pubOpp2 did not return 201');

  // 17-22. Saved List & User Isolation & Pagination & Ordering
  // GET saved list for User A (should see pubOpp2 then pubOpp1)
  const resListA = await request('/api/saved-opportunities', { headers: headersA });
  assert(resListA.status === 200, 'User A list did not return 200');
  assert(resListA.body.savedOpportunities.length === 2, `User A should see 2 saved opps, saw ${resListA.body.savedOpportunities.length}`);
  assert(resListA.body.savedOpportunities[0].opportunity._id === pubOpp2._id.toString(), 'Newest saved opp not first');
  assert(resListA.body.savedOpportunities[1].opportunity._id === pubOpp1._id.toString(), 'Older saved opp not second');
  assert(resListA.body.pagination.total === 2, 'Pagination total invalid');

  // GET saved list for User B (should see only pubOpp1)
  const resListB = await request('/api/saved-opportunities', { headers: headersB });
  assert(resListB.status === 200, 'User B list did not return 200');
  assert(resListB.body.savedOpportunities.length === 1, 'User B list count wrong');
  assert(resListB.body.savedOpportunities[0].opportunity._id === pubOpp1._id.toString(), 'User B saw wrong opp');

  // 11-13 & 32. Unsave endpoint & User Isolation
  // User A unsaves pubOpp1
  const resUnsaveA1 = await request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'DELETE', headers: headersA });
  assert(resUnsaveA1.status === 200, 'User A unsave did not return 200');
  assert(resUnsaveA1.body.saved === false, 'Unsave response invalid');

  // Repeated unsave is safe (200)
  const resUnsaveA1Rep = await request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'DELETE', headers: headersA });
  assert(resUnsaveA1Rep.status === 200, 'Repeated unsave did not return 200');

  // Check User B's save is unaffected
  const resListBAfter = await request('/api/saved-opportunities', { headers: headersB });
  assert(resListBAfter.body.savedOpportunities.length === 1, 'User A unsaving affected User B!');

  // 20. Hidden opportunity filter in saved list
  // User A saves pubOpp2. Now archive pubOpp2 directly in DB.
  await Opportunity.findByIdAndUpdate(pubOpp2._id, { status: 'archived' });
  const resListAHidden = await request('/api/saved-opportunities', { headers: headersA });
  assert(resListAHidden.body.savedOpportunities.length === 0, 'Archived opp was exposed in active saved list');
  assert(resListAHidden.body.pagination.total === 0, 'Pagination total included archived opp!');

  // 26-29. Validation & Bounds checks
  const resBadId = await request('/api/opportunities/invalid-id/save', { method: 'POST', headers: headersA });
  assert(resBadId.status === 400, 'Invalid ObjectId did not return 400');

  const resBadPage = await request('/api/saved-opportunities?page=0', { headers: headersA });
  assert(resBadPage.status === 400, 'page=0 did not return 400');

  const resBadLimit = await request('/api/saved-opportunities?limit=100', { headers: headersA });
  assert(resBadLimit.status === 400, 'limit=100 did not return 400');

  // 30-31. Security: spoofed body fields ignored
  const fakeUserId = new mongoose.Types.ObjectId().toString();
  const fakeOppId = new mongoose.Types.ObjectId().toString();
  const resSpoof = await request(`/api/opportunities/${pubOpp1._id}/save`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ userId: fakeUserId, opportunityId: fakeOppId }),
  });
  assert(resSpoof.status === 201, 'Spoofed body save failed');
  const savedDoc = await SavedOpportunity.findOne({ userId: userA._id, opportunityId: pubOpp1._id });
  assert(savedDoc !== null, 'Body spoofing overrode route parameters or user auth!');

  // 33. Duplicate concurrent save race check
  await SavedOpportunity.deleteMany({ userId: userA._id, opportunityId: pubOpp1._id });
  const concurrentReqs = await Promise.all([
    request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'POST', headers: headersA }),
    request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'POST', headers: headersA }),
    request(`/api/opportunities/${pubOpp1._id}/save`, { method: 'POST', headers: headersA }),
  ]);
  concurrentReqs.forEach((r) => {
    assert(r.status === 201 || r.status === 200, 'Concurrent save failed');
    assert(r.body.saved === true, 'Concurrent save output invalid');
  });
  const savedCount = await SavedOpportunity.countDocuments({ userId: userA._id, opportunityId: pubOpp1._id });
  assert(savedCount === 1, `Concurrent save created ${savedCount} documents instead of 1`);

  console.log('Saved Opportunities API verification passed successfully (36 test cases)');
} catch (error) {
  console.error('Saved Opportunities API verification failed:', error);
  process.exitCode = 1;
} finally {
  if (server) {
    server.close();
  }
  await SavedOpportunity.deleteMany({ userId: { $in: [userA?._id, userB?._id].filter(Boolean) } });
  await Opportunity.deleteMany({ title: { $regex: testRunId } });
  await User.deleteMany({ email: { $regex: testRunId } });
  await disconnectDatabase();
}
