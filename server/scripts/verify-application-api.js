import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { Application } from '../src/models/Application.js';
import { Opportunity } from '../src/models/Opportunity.js';
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

const testRunId = `phase451-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testPrefix = `TestApp ${testRunId}`;

let userA;
let userB;
let pubOpp1;
let pubOpp2;
let draftOpp;

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

  // Create test opportunities: 2 published, 1 draft
  pubOpp1 = await Opportunity.create({
    title: `${testPrefix} Internship 1`,
    organization: 'TechCorp',
    description: 'Description Internship 1',
    type: 'internship',
    status: 'published',
  });

  pubOpp2 = await Opportunity.create({
    title: `${testPrefix} Hackathon 2`,
    organization: 'HackInc',
    description: 'Description Hackathon 2',
    type: 'hackathon',
    status: 'published',
  });

  draftOpp = await Opportunity.create({
    title: `${testPrefix} Draft Opp`,
    organization: 'DraftOrg',
    description: 'Description Draft',
    type: 'workshop',
    status: 'draft',
  });

  // Start HTTP server
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  console.log('=== Step 29: Model Tests ===');
  // 1-5. Model checks, timestamps, type/status validation, compound index
  const directApp = await Application.create({
    userId: userA._id,
    opportunityId: pubOpp1._id,
    type: 'application',
    status: 'applied',
    notes: 'Direct test note',
  });
  assert(directApp._id, '1. Application model creation failed');
  assert(directApp.createdAt && directApp.updatedAt, '4. Timestamps missing');

  let dupCaught = false;
  try {
    await Application.create({
      userId: userA._id,
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'interview',
    });
  } catch (err) {
    if (err.code === 11000) dupCaught = true;
  }
  assert(dupCaught, '2-3. Compound unique index did not prevent duplicate user/opportunity/type creation');

  let invalidStatusCaught = false;
  try {
    await Application.create({
      userId: userA._id,
      opportunityId: pubOpp2._id,
      type: 'application',
      status: 'registered', // Invalid for type application
    });
  } catch (err) {
    invalidStatusCaught = true;
  }
  assert(invalidStatusCaught, '5. Schema failed to reject invalid status for application type');

  // Clean up direct test records before API tests
  await Application.deleteMany({ userId: { $in: [userA._id, userB._id] } });

  console.log('=== Step 29: Security Tests (Unauthenticated & Invalid requests) ===');
  // 36-40. Unauthenticated requests -> 401
  const resUnauthPost = await request('/api/applications', { method: 'POST' });
  assert(resUnauthPost.status === 401, '36. Unauthenticated POST did not return 401');

  const resUnauthList = await request('/api/applications');
  assert(resUnauthList.status === 401, '37. Unauthenticated GET list did not return 401');

  const resUnauthGet = await request(`/api/applications/${pubOpp1._id}?type=application`);
  assert(resUnauthGet.status === 401, '38. Unauthenticated GET single did not return 401');

  const resUnauthPut = await request(`/api/applications/${pubOpp1._id}?type=application`, { method: 'PUT' });
  assert(resUnauthPut.status === 401, '39. Unauthenticated PUT did not return 401');

  const resUnauthDel = await request(`/api/applications/${pubOpp1._id}?type=application`, { method: 'DELETE' });
  assert(resUnauthDel.status === 401, '40. Unauthenticated DELETE did not return 401');

  // 41-44. Validation error checks
  const resBadId = await request('/api/applications/invalid-id?type=application', { headers: headersA });
  assert(resBadId.status === 400, '41. Invalid ObjectId did not return 400');

  const resBadPage = await request('/api/applications?page=0', { headers: headersA });
  assert(resBadPage.status === 400, '42. Invalid page did not return 400');

  const resBadUrl = await request('/api/applications', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ opportunityId: pubOpp1._id, type: 'application', externalUrl: 'ftp://bad-scheme.com' }),
  });
  assert(resBadUrl.status === 400, '43. Unsupported scheme in externalUrl did not return 400');

  const resHiddenCreate = await request('/api/applications', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ opportunityId: draftOpp._id, type: 'application' }),
  });
  assert(resHiddenCreate.status === 404, '44. Hidden/draft opportunity create did not return 404');

  console.log('=== Step 29: Create Endpoint & Idempotency Tests ===');
  // 6. User A creates application for pubOpp1
  const resCreateA1 = await request('/api/applications', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'applied',
      notes: 'Applied on official site',
      externalUrl: 'https://careers.techcorp.com/app/1',
    }),
  });
  assert(resCreateA1.status === 201, '6. User A application creation failed');
  assert(resCreateA1.body.application.appliedAt, '10. appliedAt auto-populated');

  // 7. User A creates registration for same pubOpp1 (different type)
  const resCreateA1Reg = await request('/api/applications', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      opportunityId: pubOpp1._id,
      type: 'registration',
      status: 'registered',
      notes: 'Registered for webinar',
    }),
  });
  assert(resCreateA1Reg.status === 201, '7. User A registration creation for same opp failed');
  assert(resCreateA1Reg.body.application.registeredAt, '11. registeredAt auto-populated');

  // 8. User B creates application for same pubOpp1
  const resCreateB1 = await request('/api/applications', {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'applied',
    }),
  });
  assert(resCreateB1.status === 201, '8. User B application creation failed');

  // 9. Duplicate create by User A for pubOpp1 (application type) -> Idempotent 200
  const resCreateA1Dup = await request('/api/applications', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'applied',
    }),
  });
  assert(resCreateA1Dup.status === 200, '9. Duplicate create did not return idempotent 200');

  // User A creates application for pubOpp2
  const resCreateA2 = await request('/api/applications', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      opportunityId: pubOpp2._id,
      type: 'application',
      status: 'interview',
    }),
  });
  assert(resCreateA2.status === 201, 'User A second application creation failed');

  console.log('=== Step 29: GET Single Record Tests ===');
  // 12-13. User A gets own application & registration
  const resGetA1App = await request(`/api/applications/${pubOpp1._id}?type=application`, { headers: headersA });
  assert(resGetA1App.status === 200, '12. User A GET own application failed');
  assert(resGetA1App.body.application.opportunity.title === pubOpp1.title, 'Opportunity populated in GET single');

  const resGetA1Reg = await request(`/api/applications/${pubOpp1._id}?type=registration`, { headers: headersA });
  assert(resGetA1Reg.status === 200, '13. User A GET own registration failed');

  // 14-15. Missing/invalid type returns 400
  const resGetNoType = await request(`/api/applications/${pubOpp1._id}`, { headers: headersA });
  assert(resGetNoType.status === 400, '14. GET single without type did not return 400');

  const resGetBadType = await request(`/api/applications/${pubOpp1._id}?type=invalidType`, { headers: headersA });
  assert(resGetBadType.status === 400, '15. GET single with invalid type did not return 400');

  // 16. User A cannot retrieve User B's record (User B has no pubOpp2 record)
  const resGetB2AsA = await request(`/api/applications/${pubOpp2._id}?type=application`, { headers: headersB });
  assert(resGetB2AsA.status === 404, '16. User B accessed record created by User A');

  console.log('=== Step 29: LIST & Filter & Pagination Tests ===');
  // 17-18. LIST isolation
  const resListA = await request('/api/applications', { headers: headersA });
  assert(resListA.status === 200, 'User A LIST failed');
  assert(resListA.body.applications.length === 3, `17. User A should see 3 records, saw ${resListA.body.applications.length}`);

  const resListB = await request('/api/applications', { headers: headersB });
  assert(resListB.status === 200, 'User B LIST failed');
  assert(resListB.body.applications.length === 1, `18. User B should see 1 record, saw ${resListB.body.applications.length}`);

  // 19. Pagination
  const resListAPage = await request('/api/applications?page=1&limit=2', { headers: headersA });
  assert(resListAPage.body.applications.length === 2, '19. Pagination limit=2 failed');
  assert(resListAPage.body.pagination.total === 3, '19. Pagination total wrong');
  assert(resListAPage.body.pagination.pages === 2, '19. Pagination pages wrong');

  // 20. Type filter
  const resListATypeReg = await request('/api/applications?type=registration', { headers: headersA });
  assert(resListATypeReg.body.applications.length === 1, '20. Type filter registration failed');

  // 21. Status filter
  const resListAStatusInt = await request('/api/applications?status=interview', { headers: headersA });
  assert(resListAStatusInt.body.applications.length === 1, '21. Status filter interview failed');

  // 22. Newest first
  assert(
    new Date(resListA.body.applications[0].createdAt) >= new Date(resListA.body.applications[1].createdAt),
    '22. Sort order is not createdAt descending'
  );

  // 23-24. Published opportunity filtering in LIST
  await Opportunity.findByIdAndUpdate(pubOpp2._id, { status: 'archived' });
  const resListAHidden = await request('/api/applications', { headers: headersA });
  assert(resListAHidden.body.applications.length === 2, '24. Archived opportunity was exposed in LIST endpoint');
  assert(resListAHidden.body.pagination.total === 2, '24. Pagination total included archived opportunity!');
  await Opportunity.findByIdAndUpdate(pubOpp2._id, { status: 'published' });

  console.log('=== Step 29: UPDATE Endpoint & Security Tests ===');
  // 25-27. User A updates own status, notes, externalUrl
  const resUpdateA1 = await request(`/api/applications/${pubOpp1._id}?type=application`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      status: 'interview',
      notes: 'Scheduled for technical round',
      externalUrl: 'https://careers.techcorp.com/app/1/interview',
    }),
  });
  assert(resUpdateA1.status === 200, '25-27. User A update failed');
  assert(resUpdateA1.body.application.status === 'interview', 'Status update failed');
  assert(resUpdateA1.body.application.notes === 'Scheduled for technical round', 'Notes update failed');

  // 28. Invalid type/status combination rejected
  const resUpdateBadStatus = await request(`/api/applications/${pubOpp1._id}?type=application`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ status: 'attended' }),
  });
  assert(resUpdateBadStatus.status === 400, '28. Cross-type status update not rejected');

  // 29-30. Type and ownership immutability
  const resUpdateImm = await request(`/api/applications/${pubOpp1._id}?type=application`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ type: 'registration', userId: userB._id.toString() }),
  });
  assert(resUpdateImm.status === 400, '29-30. Immutable type or userId modification did not return 400');

  // 31. User A cannot update User B's record
  const resUpdateBAsA = await request(`/api/applications/${pubOpp1._id}?type=application`, {
    method: 'PUT',
    headers: headersB, // User B trying to update pubOpp1 (which User B has 'applied' for, but let's test pubOpp2 where B has no app)
  });
  const resUpdateB2AsA = await request(`/api/applications/${pubOpp2._id}?type=application`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ status: 'rejected' }),
  });
  assert(resUpdateB2AsA.status === 404, '31. User B updated record created by User A');

  console.log('=== Step 29: DELETE Endpoint & Security Tests ===');
  // 32. User A deletes own application for pubOpp1
  const resDelA1App = await request(`/api/applications/${pubOpp1._id}?type=application`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(resDelA1App.status === 200, '32. User A delete application failed');

  // 33. User A deletes own registration for pubOpp1
  const resDelA1Reg = await request(`/api/applications/${pubOpp1._id}?type=registration`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(resDelA1Reg.status === 200, '33. User A delete registration failed');

  // 34. Repeated delete is safe
  const resDelA1Rep = await request(`/api/applications/${pubOpp1._id}?type=application`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(resDelA1Rep.status === 200, '34. Repeated delete did not return 200');

  // 35. Check User B's record for pubOpp1 is unaffected
  const resGetB1After = await request(`/api/applications/${pubOpp1._id}?type=application`, { headers: headersB });
  assert(resGetB1After.status === 200, '35. User A delete affected User B!');

  console.log('Application API verification script completed successfully (47 test cases passed)');
} catch (error) {
  console.error('Application API verification failed:', error);
  process.exitCode = 1;
} finally {
  if (server) {
    server.close();
  }
  // 45-47. Cleanup temporary records
  if (userA && userB) {
    await Application.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  }
  await Opportunity.deleteMany({ title: { $regex: testRunId } });
  await User.deleteMany({ email: { $regex: testRunId } });
  await disconnectDatabase();
}
