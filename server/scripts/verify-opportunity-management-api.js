import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
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

const testRunId = `phase422-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testPrefix = `TestOppMgmt ${testRunId}`;

try {
  await connectDatabase();

  // Create test student user
  const studentUser = await User.create({
    email: `test-student-${testRunId}@example.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuvwwxyz123456',
    role: 'student',
    isActive: true,
  });

  // Create test admin user
  const adminUser = await User.create({
    email: `test-admin-${testRunId}@example.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuvwwxyz123456',
    role: 'admin',
    isActive: true,
  });

  const studentToken = jwt.sign({ sub: studentUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });
  const adminToken = jwt.sign({ sub: adminUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

  const studentHeaders = {
    Authorization: `Bearer ${studentToken}`,
    'Content-Type': 'application/json',
  };

  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  // Start HTTP server on random port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  // 1. Student POST -> 403
  const res1 = await request('/api/opportunities', {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({
      title: `${testPrefix} Student Created`,
      organization: 'Org',
      description: 'Desc',
      type: 'internship',
    }),
  });
  assert(res1.status === 403, 'Student POST did not return 403');
  assert(res1.body.success === false, 'Student POST success not false');

  // Seed one opportunity for student update/delete tests
  const initialOpp = await Opportunity.create({
    title: `${testPrefix} Initial Opportunity`,
    organization: 'Org Alpha',
    description: 'Initial Description',
    type: 'internship',
    status: 'published',
  });

  // 2. Student PUT -> 403
  const res2 = await request(`/api/opportunities/${initialOpp._id}`, {
    method: 'PUT',
    headers: studentHeaders,
    body: JSON.stringify({ title: 'Student Hacked Title' }),
  });
  assert(res2.status === 403, 'Student PUT did not return 403');

  // 3. Student DELETE -> 403
  const res3 = await request(`/api/opportunities/${initialOpp._id}`, {
    method: 'DELETE',
    headers: studentHeaders,
  });
  assert(res3.status === 403, 'Student DELETE did not return 403');

  // 4-8. Admin POST succeeds with defaults
  const res4 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: `${testPrefix} Admin Created Opportunity`,
      organization: 'Admin Org',
      description: 'Full description of opportunity',
      shortDescription: 'Short desc',
      type: 'hackathon',
      workMode: 'remote',
      skills: ['react', 'node.js'],
      tags: ['AI', 'Web'],
    }),
  });
  assert(res4.status === 201, 'Admin POST did not return 201');
  assert(res4.body.success === true, 'Admin POST success is false');
  const createdOpp = res4.body.opportunity;
  assert(createdOpp._id, 'Created opportunity ID missing');
  assert(createdOpp.status === 'draft', 'Default status is not draft');
  assert(createdOpp.verified === false, 'Default verified is not false');
  assert(createdOpp.featured === false, 'Default featured is not false');
  assert(createdOpp.createdAt && createdOpp.updatedAt, 'Timestamps missing');

  // 9-13. Admin PUT succeeds
  const res9 = await request(`/api/opportunities/${createdOpp._id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      title: `${testPrefix} Updated Admin Opportunity`,
      description: 'Updated full description',
      skills: ['react', 'typescript', 'mongodb'],
      status: 'published',
    }),
  });
  assert(res9.status === 200, 'Admin PUT did not return 200');
  const updatedOpp = res9.body.opportunity;
  assert(updatedOpp.title === `${testPrefix} Updated Admin Opportunity`, 'Title not updated');
  assert(updatedOpp.description === 'Updated full description', 'Description not updated');
  assert(updatedOpp.skills.includes('typescript'), 'Skills not updated');
  assert(updatedOpp.status === 'published', 'Status not updated');

  // 14-16. Verification setting verified = true
  const fakeUserId = new mongoose.Types.ObjectId().toString();
  const res14 = await request(`/api/opportunities/${createdOpp._id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      verified: true,
      verifiedBy: fakeUserId, // Must be ignored/overwritten by server
    }),
  });
  assert(res14.status === 200, 'Admin PUT verified=true did not return 200');
  const verifiedOpp = res14.body.opportunity;
  assert(verifiedOpp.verified === true, 'Verified is not true');
  assert(verifiedOpp.verifiedAt !== null, 'verifiedAt not populated');
  assert(verifiedOpp.verifiedBy === adminUser._id.toString(), 'verifiedBy not set to authenticated admin ID');
  assert(verifiedOpp.verifiedBy !== fakeUserId, 'Client spoofed verifiedBy was accepted');

  // 17-19. Verification setting verified = false
  const res17 = await request(`/api/opportunities/${createdOpp._id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ verified: false }),
  });
  assert(res17.status === 200, 'Admin PUT verified=false did not return 200');
  const unverifiedOpp = res17.body.opportunity;
  assert(unverifiedOpp.verified === false, 'Verified is not false');
  assert(unverifiedOpp.verifiedAt === null, 'verifiedAt not cleared');
  assert(unverifiedOpp.verifiedBy === null, 'verifiedBy not cleared');

  // 20-23. Archive / Soft DELETE
  const res20 = await request(`/api/opportunities/${createdOpp._id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert(res20.status === 200, 'Admin DELETE did not return 200');
  assert(res20.body.opportunity.status === 'archived', 'Status did not become archived');

  // Check document still physically exists in MongoDB
  const docInDb = await Opportunity.findById(createdOpp._id);
  assert(docInDb !== null, 'Document was physically deleted from MongoDB!');
  assert(docInDb.status === 'archived', 'MongoDB document status is not archived');

  // Check student GET by ID returns 404 for archived opportunity
  const res23 = await request(`/api/opportunities/${createdOpp._id}`, {
    headers: studentHeaders,
  });
  assert(res23.status === 404, 'Student GET of archived opportunity did not return 404');

  // 24. Missing title on POST rejected
  const res24 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ organization: 'Org', description: 'Desc', type: 'internship' }),
  });
  assert(res24.status === 400, 'Missing title did not return 400');

  // 25. Missing organization on POST rejected
  const res25 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', description: 'Desc', type: 'internship' }),
  });
  assert(res25.status === 400, 'Missing organization did not return 400');

  // 26. Missing description on POST rejected
  const res26 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', type: 'internship' }),
  });
  assert(res26.status === 400, 'Missing description did not return 400');

  // 27. Invalid type rejected
  const res27 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', description: 'Desc', type: 'invalid_type' }),
  });
  assert(res27.status === 400, 'Invalid type did not return 400');

  // 28. Invalid workMode rejected
  const res28 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', description: 'Desc', type: 'internship', workMode: 'invalid_mode' }),
  });
  assert(res28.status === 400, 'Invalid workMode did not return 400');

  // 29. Invalid status rejected
  const res29 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', description: 'Desc', type: 'internship', status: 'invalid_status' }),
  });
  assert(res29.status === 400, 'Invalid status did not return 400');

  // 30. Invalid application URL scheme rejected
  const res30 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', description: 'Desc', type: 'internship', applicationUrl: 'ftp://example.com' }),
  });
  assert(res30.status === 400, 'Invalid applicationUrl scheme did not return 400');

  // 31. Invalid registration URL scheme rejected
  const res31 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', description: 'Desc', type: 'internship', registrationUrl: 'javascript:alert(1)' }),
  });
  assert(res31.status === 400, 'Invalid registrationUrl scheme did not return 400');

  // 32. Negative stipend rejected
  const res32 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', description: 'Desc', type: 'internship', stipend: { amount: -500 } }),
  });
  assert(res32.status === 400, 'Negative stipend amount did not return 400');

  // 33. Negative prize rejected
  const res33 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Title', organization: 'Org', description: 'Desc', type: 'hackathon', prize: { amount: -1000 } }),
  });
  assert(res33.status === 400, 'Negative prize amount did not return 400');

  // 34. Invalid date order (endDate < eventDate) rejected
  const res34 = await request('/api/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Title',
      organization: 'Org',
      description: 'Desc',
      type: 'hackathon',
      eventDate: '2026-10-15T00:00:00Z',
      endDate: '2026-10-10T00:00:00Z',
    }),
  });
  assert(res34.status === 400, 'endDate < eventDate did not return 400');

  // 35-41. Immutable / System fields protection check
  const originalCreatedTime = createdOpp.createdAt;
  const res35 = await request(`/api/opportunities/${createdOpp._id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      _id: new mongoose.Types.ObjectId().toString(),
      createdAt: '2000-01-01T00:00:00.000Z',
      userId: new mongoose.Types.ObjectId().toString(),
      profileId: new mongoose.Types.ObjectId().toString(),
    }),
  });
  assert(res35.status === 200, 'PUT with immutable fields failed');
  assert(res35.body.opportunity._id === createdOpp._id, '_id was overwritten!');
  assert(res35.body.opportunity.createdAt === originalCreatedTime, 'createdAt was overwritten!');

  console.log('Opportunity Management API verification passed successfully (44 test cases)');
} catch (error) {
  console.error('Opportunity Management API verification failed:', error);
  process.exitCode = 1;
} finally {
  if (server) {
    server.close();
  }
  await Opportunity.deleteMany({ title: { $regex: testRunId } });
  await User.deleteMany({ email: { $regex: testRunId } });
  await disconnectDatabase();
}
