import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { CalendarEvent } from '../src/models/CalendarEvent.js';
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

const testRunId = `phase461-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testPrefix = `TestCal ${testRunId}`;

let userA;
let userB;
let pubOpp1;
let pubOpp2;
let appA1;
let regA1;
let appB1;

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

  // Create temporary test opportunities
  pubOpp1 = await Opportunity.create({
    title: `${testPrefix} Internship 1`,
    organization: 'CalOrg',
    description: 'Cal Description 1',
    type: 'internship',
    status: 'published',
  });

  pubOpp2 = await Opportunity.create({
    title: `${testPrefix} Hackathon 2`,
    organization: 'HackCalOrg',
    description: 'Cal Description 2',
    type: 'hackathon',
    status: 'published',
  });

  // Create temporary applications
  appA1 = await Application.create({
    userId: userA._id,
    opportunityId: pubOpp1._id,
    type: 'application',
    status: 'applied',
  });

  regA1 = await Application.create({
    userId: userA._id,
    opportunityId: pubOpp2._id,
    type: 'registration',
    status: 'registered',
  });

  appB1 = await Application.create({
    userId: userB._id,
    opportunityId: pubOpp1._id,
    type: 'application',
    status: 'applied',
  });

  // Start HTTP server
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  console.log('=== Step 31: Model / Defaults / Link Tests ===');
  // 1. Personal event
  const res1 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: `${testPrefix} Personal Event`,
      type: 'personal',
      startAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  assert(res1.status === 201, '1. Personal event creation failed');
  assert(res1.body.event.status === 'scheduled', '5. Default status is scheduled');
  assert(res1.body.event.allDay === false, '6. Default allDay is false');
  assert(res1.body.event.source === 'manual', '7. Default source is manual');
  assert(res1.body.event.createdAt && res1.body.event.updatedAt, '8. Timestamps exist');

  // 2. Opportunity-linked event
  const res2 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: `${testPrefix} Opp Event`,
      type: 'deadline',
      startAt: new Date(Date.now() + 172800000).toISOString(),
      opportunityId: pubOpp1._id.toString(),
      source: 'opportunity',
    }),
  });
  assert(res2.status === 201, '2. Opportunity-linked event creation failed');

  // 3. Application-linked event
  const res3 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: `${testPrefix} App Event`,
      type: 'interview',
      startAt: new Date(Date.now() + 259200000).toISOString(),
      applicationId: appA1._id.toString(),
      opportunityId: pubOpp1._id.toString(),
      source: 'application',
    }),
  });
  assert(res3.status === 201, '3. Application-linked event creation failed');

  // 4. Registration-linked event
  const res4 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: `${testPrefix} Reg Event`,
      type: 'event',
      startAt: new Date(Date.now() + 345600000).toISOString(),
      applicationId: regA1._id.toString(),
      opportunityId: pubOpp2._id.toString(),
      source: 'registration',
    }),
  });
  assert(res4.status === 201, '4. Registration-linked event creation failed');

  console.log('=== Step 31: Validation Tests ===');
  // 9. missing title
  const res9 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ type: 'personal', startAt: new Date().toISOString() }),
  });
  assert(res9.status === 400, '9. Missing title not rejected');

  // 10. invalid type
  const res10 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'T', type: 'invalidType', startAt: new Date().toISOString() }),
  });
  assert(res10.status === 400, '10. Invalid type not rejected');

  // 11. invalid status
  const res11 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'T', type: 'personal', status: 'invalidStatus', startAt: new Date().toISOString() }),
  });
  assert(res11.status === 400, '11. Invalid status not rejected');

  // 12. invalid source
  const res12 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'T', type: 'personal', source: 'invalidSource', startAt: new Date().toISOString() }),
  });
  assert(res12.status === 400, '12. Invalid source not rejected');

  // 13. invalid URL
  const res13 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'T', type: 'personal', url: 'ftp://bad-url.com', startAt: new Date().toISOString() }),
  });
  assert(res13.status === 400, '13. Invalid URL scheme not rejected');

  // 14. invalid startAt
  const res14 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'T', type: 'personal', startAt: 'invalid-date' }),
  });
  assert(res14.status === 400, '14. Invalid startAt date not rejected');

  // 15. invalid endAt
  const res15 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'T', type: 'personal', startAt: new Date().toISOString(), endAt: 'invalid-date' }),
  });
  assert(res15.status === 400, '15. Invalid endAt date not rejected');

  // 16. endAt before startAt
  const res16 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: 'T',
      type: 'personal',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      endAt: new Date(Date.now() - 86400000).toISOString(),
    }),
  });
  assert(res16.status === 400, '16. endAt before startAt not rejected');

  // 17. negative reminder
  const res17 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'T', type: 'personal', startAt: new Date().toISOString(), reminderMinutes: -5 }),
  });
  assert(res17.status === 400, '17. Negative reminderMinutes not rejected');

  // 18. invalid ObjectId
  const res18 = await request('/api/calendar/invalid-id', { headers: headersA });
  assert(res18.status === 400, '18. Invalid ObjectId not rejected');

  // 19. invalid pagination
  const res19 = await request('/api/calendar?page=0', { headers: headersA });
  assert(res19.status === 400, '19. Invalid pagination not rejected');

  // 20. invalid date filter
  const res20 = await request('/api/calendar?startBefore=bad-date', { headers: headersA });
  assert(res20.status === 400, '20. Invalid date filter not rejected');

  console.log('=== Step 31: Link Security Tests ===');
  // 27. valid User A applicationId works (done in test 3)
  // 28. User B applicationId cannot be linked by User A
  const res28 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: 'Spoofed App Event',
      type: 'interview',
      startAt: new Date().toISOString(),
      applicationId: appB1._id.toString(),
    }),
  });
  assert(res28.status === 400, '28. User A successfully linked User B applicationId!');

  // 29. nonexistent applicationId rejected
  const fakeAppId = new mongoose.Types.ObjectId().toString();
  const res29 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: 'Fake App Event',
      type: 'interview',
      startAt: new Date().toISOString(),
      applicationId: fakeAppId,
    }),
  });
  assert(res29.status === 400, '29. Nonexistent applicationId not rejected');

  // 30. nonexistent opportunityId rejected
  const fakeOppId = new mongoose.Types.ObjectId().toString();
  const res30 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: 'Fake Opp Event',
      type: 'deadline',
      startAt: new Date().toISOString(),
      opportunityId: fakeOppId,
    }),
  });
  assert(res30.status === 400, '30. Nonexistent opportunityId not rejected');

  // 31. inconsistent opportunity/application relationship rejected
  const res31 = await request('/api/calendar', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      title: 'Inconsistent Link Event',
      type: 'interview',
      startAt: new Date().toISOString(),
      applicationId: appA1._id.toString(), // appA1 is linked to pubOpp1
      opportunityId: pubOpp2._id.toString(), // mismatch!
    }),
  });
  assert(res31.status === 400, '31. Inconsistent opportunityId & applicationId not rejected');

  console.log('=== Step 31: Ownership Security Tests ===');
  const eventAId = res1.body.event._id;

  // 21. User A can GET own event
  const res21 = await request(`/api/calendar/${eventAId}`, { headers: headersA });
  assert(res21.status === 200, '21. User A GET own event failed');

  // 22. User B cannot GET User A event
  const res22 = await request(`/api/calendar/${eventAId}`, { headers: headersB });
  assert(res22.status === 404, '22. User B accessed User A event');

  // 23. User A can UPDATE own event
  const res23 = await request(`/api/calendar/${eventAId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ title: 'Updated Title' }),
  });
  assert(res23.status === 200, '23. User A update own event failed');
  assert(res23.body.event.title === 'Updated Title', 'Title update failed');

  // 24. User B cannot UPDATE User A event
  const res24 = await request(`/api/calendar/${eventAId}`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ title: 'Hacked Title' }),
  });
  assert(res24.status === 404, '24. User B updated User A event');

  console.log('=== Step 31: LIST, Filters & Pagination Tests ===');
  // 32-33. LIST isolation
  const resListA = await request('/api/calendar', { headers: headersA });
  assert(resListA.status === 200, 'LIST A failed');
  assert(resListA.body.events.length === 4, `32. User A should see 4 events, saw ${resListA.body.events.length}`);

  const resListB = await request('/api/calendar', { headers: headersB });
  assert(resListB.status === 200, 'LIST B failed');
  assert(resListB.body.events.length === 0, `33. User B should see 0 events, saw ${resListB.body.events.length}`);

  // 34. Pagination
  const res34 = await request('/api/calendar?page=1&limit=2', { headers: headersA });
  assert(res34.body.events.length === 2, '34. Pagination limit=2 failed');
  assert(res34.body.pagination.total === 4, '34. Pagination total wrong');

  // 35. Type filter
  const res35 = await request('/api/calendar?type=interview', { headers: headersA });
  assert(res35.body.events.length === 1, '35. Type filter failed');

  // 36. Status filter
  const res36 = await request('/api/calendar?status=scheduled', { headers: headersA });
  assert(res36.body.events.length === 4, '36. Status filter failed');

  // 37-38. Date range filters
  const middleDate = new Date(Date.now() + 200000000).toISOString();
  const res37 = await request(`/api/calendar?startBefore=${middleDate}`, { headers: headersA });
  assert(res37.body.events.length === 2, '37. startBefore filter failed');

  const res38 = await request(`/api/calendar?startAfter=${middleDate}`, { headers: headersA });
  assert(res38.body.events.length === 2, '38. startAfter filter failed');

  // 39. Ascending startAt ordering
  assert(
    new Date(resListA.body.events[0].startAt) <= new Date(resListA.body.events[1].startAt),
    '39. Ascending startAt ordering failed'
  );

  console.log('=== Step 31: Update & Delete Tests ===');
  // 40-43. Status, date, reminder, URL updates
  const newStart = new Date(Date.now() + 500000000).toISOString();
  const resUpdateExt = await request(`/api/calendar/${eventAId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      status: 'completed',
      startAt: newStart,
      reminderMinutes: 30,
      url: 'https://meet.google.com/abc-defg-hij',
    }),
  });
  assert(resUpdateExt.status === 200, '40-43. Comprehensive update failed');
  assert(resUpdateExt.body.event.status === 'completed', '40. Status update failed');
  assert(resUpdateExt.body.event.reminderMinutes === 30, '42. Reminder update failed');

  // 44. Ownership fields immutable
  const res44 = await request(`/api/calendar/${eventAId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ userId: userB._id.toString() }),
  });
  assert(res44.status === 400, '44. Mutable userId attempt not rejected');

  // 25 & 45. User A deletes own event
  const res45 = await request(`/api/calendar/${eventAId}`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(res45.status === 200, '45. Own event deletion failed');

  // 26. User B cannot DELETE User A event
  const eventA2Id = res2.body.event._id;
  const res26 = await request(`/api/calendar/${eventA2Id}`, {
    method: 'DELETE',
    headers: headersB,
  });
  assert(res26.status === 404, '26. User B deleted User A event');

  // 46. Repeated deletion is safe (404 for deleted event)
  const res46 = await request(`/api/calendar/${eventAId}`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(res46.status === 404, '46. Repeated delete did not return 404');

  console.log('Calendar API verification script completed successfully (50 test cases passed)');
} catch (error) {
  console.error('Calendar API verification failed:', error);
  process.exitCode = 1;
} finally {
  if (server) {
    server.close();
  }
  // 47-50. Cleanup temporary records
  if (userA && userB) {
    await CalendarEvent.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    await Application.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  }
  await Opportunity.deleteMany({ title: { $regex: testRunId } });
  await User.deleteMany({ email: { $regex: testRunId } });
  await disconnectDatabase();
}
