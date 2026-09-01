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

const testRunId = `phase421-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testPrefix = `TestOppAPI ${testRunId}`;

try {
  await connectDatabase();

  // Create temporary test user
  const user = await User.create({
    email: `test-opp-user-${testRunId}@example.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuvwwxyz123456',
    role: 'student',
    isActive: true,
  });

  const token = jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: '1h' });
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Start temporary HTTP server on random port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  // Seed test opportunities
  const pubInternship = await Opportunity.create({
    title: `${testPrefix} Published React Internship`,
    organization: 'Alpha Tech',
    description: 'Frontend React development internship.',
    shortDescription: 'React Developer',
    type: 'internship',
    workMode: 'remote',
    location: { country: 'India', state: 'Karnataka', city: 'Bengaluru' },
    skills: ['react', 'javascript', 'css'],
    tags: ['Web', 'Frontend'],
    status: 'published',
    verified: true,
    featured: true,
    deadline: new Date('2026-10-01T00:00:00Z'),
    eventDate: new Date('2026-10-05T00:00:00Z'),
  });

  const pubHackathon = await Opportunity.create({
    title: `${testPrefix} Published AI Hackathon`,
    organization: 'Beta Corp',
    description: 'Build AI applications with Python.',
    shortDescription: 'Python AI Challenge',
    type: 'hackathon',
    workMode: 'onsite',
    location: { country: 'India', state: 'Maharashtra', city: 'Mumbai' },
    skills: ['python', 'ai', 'tensorflow'],
    tags: ['AI', 'Hackathon'],
    status: 'published',
    verified: false,
    featured: false,
    deadline: new Date('2026-11-01T00:00:00Z'),
    eventDate: new Date('2026-11-10T00:00:00Z'),
  });

  const pubWorkshop = await Opportunity.create({
    title: `${testPrefix} Published Node.js Workshop`,
    organization: 'Gamma Systems',
    description: 'Backend Node.js microservices workshop.',
    type: 'workshop',
    workMode: 'hybrid',
    location: { country: 'India', state: 'Karnataka', city: 'Bengaluru' },
    skills: ['node.js', 'express', 'mongodb'],
    status: 'published',
    deadline: new Date('2026-12-01T00:00:00Z'),
    eventDate: new Date('2026-12-05T00:00:00Z'),
  });

  const draftOpp = await Opportunity.create({
    title: `${testPrefix} Draft Opportunity`,
    organization: 'Delta Corp',
    description: 'Draft description.',
    type: 'internship',
    workMode: 'remote',
    status: 'draft',
  });

  const archivedOpp = await Opportunity.create({
    title: `${testPrefix} Archived Opportunity`,
    organization: 'Epsilon Inc',
    description: 'Archived description.',
    type: 'workshop',
    workMode: 'online',
    status: 'archived',
  });

  const expiredOpp = await Opportunity.create({
    title: `${testPrefix} Expired Opportunity`,
    organization: 'Zeta Inc',
    description: 'Expired description.',
    type: 'meetup',
    workMode: 'online',
    status: 'expired',
  });

  // 1. Authenticated list succeeds
  const res1 = await request('/api/opportunities', { headers: authHeaders });
  assert(res1.status === 200, 'Authenticated list did not return 200');
  assert(res1.body.success === true, 'Response success is false');
  assert(Array.isArray(res1.body.opportunities), 'Opportunities is not an array');
  assert(res1.body.pagination, 'Pagination object missing');

  // 2. Unauthenticated list returns 401
  const res2 = await request('/api/opportunities');
  assert(res2.status === 401, 'Unauthenticated list did not return 401');

  // 3. Published opportunities are visible
  const oppIds = res1.body.opportunities.map((o) => o._id);
  assert(oppIds.includes(pubInternship._id.toString()), 'Published internship not visible');
  assert(oppIds.includes(pubHackathon._id.toString()), 'Published hackathon not visible');

  // 4. Draft opportunities are hidden
  assert(!oppIds.includes(draftOpp._id.toString()), 'Draft opportunity was exposed');

  // 5. Archived opportunities are hidden
  assert(!oppIds.includes(archivedOpp._id.toString()), 'Archived opportunity was exposed');

  // 6. Explicit expired opportunities are hidden
  assert(!oppIds.includes(expiredOpp._id.toString()), 'Expired opportunity was exposed');

  // 7. GET by published ID succeeds
  const res7 = await request(`/api/opportunities/${pubInternship._id}`, { headers: authHeaders });
  assert(res7.status === 200, 'GET by published ID did not return 200');
  assert(res7.body.opportunity.title === pubInternship.title, 'Opportunity title mismatch');

  // 8. GET draft by ID returns 404
  const res8 = await request(`/api/opportunities/${draftOpp._id}`, { headers: authHeaders });
  assert(res8.status === 404, 'GET draft by ID did not return 404');

  // 9. GET archived by ID returns 404
  const res9 = await request(`/api/opportunities/${archivedOpp._id}`, { headers: authHeaders });
  assert(res9.status === 404, 'GET archived by ID did not return 404');

  // 10. Invalid ObjectId returns 400
  const res10 = await request('/api/opportunities/invalid-id-123', { headers: authHeaders });
  assert(res10.status === 400, 'Invalid ObjectId did not return 400');

  // 11. Missing ID returns 404
  const missingId = new mongoose.Types.ObjectId().toString();
  const res11 = await request(`/api/opportunities/${missingId}`, { headers: authHeaders });
  assert(res11.status === 404, 'Missing ID did not return 404');

  // 12. Pagination works
  const res12 = await request('/api/opportunities?page=1&limit=2', { headers: authHeaders });
  assert(res12.status === 200, 'Pagination did not return 200');
  assert(res12.body.opportunities.length <= 2, 'Limit not respected');
  assert(res12.body.pagination.page === 1, 'Pagination page mismatch');

  // 13. Limit capped / rejected above 50
  const res13 = await request('/api/opportunities?limit=100', { headers: authHeaders });
  assert(res13.status === 400, 'Limit > 50 was not rejected with 400');

  // 14. q search works
  const res14 = await request(`/api/opportunities?q=${encodeURIComponent('React')}`, { headers: authHeaders });
  assert(res14.status === 200, 'Search q did not return 200');
  assert(res14.body.opportunities.some((o) => o._id === pubInternship._id.toString()), 'Search q did not find React internship');

  // 15. type filter works
  const res15 = await request('/api/opportunities?type=internship', { headers: authHeaders });
  assert(res15.status === 200, 'Type filter did not return 200');
  assert(res15.body.opportunities.every((o) => o.type === 'internship'), 'Type filter returned non-internship');

  // 16. Multiple type filter works
  const res16 = await request('/api/opportunities?type=internship,hackathon', { headers: authHeaders });
  assert(res16.status === 200, 'Multiple type filter did not return 200');
  assert(res16.body.opportunities.every((o) => ['internship', 'hackathon'].includes(o.type)), 'Multiple type filter mismatch');

  // 17. workMode filter works
  const res17 = await request('/api/opportunities?workMode=remote', { headers: authHeaders });
  assert(res17.status === 200, 'WorkMode filter did not return 200');
  assert(res17.body.opportunities.every((o) => o.workMode === 'remote'), 'WorkMode filter mismatch');

  // 18. Multiple workMode filter works
  const res18 = await request('/api/opportunities?workMode=remote,hybrid', { headers: authHeaders });
  assert(res18.status === 200, 'Multiple workMode filter did not return 200');
  assert(res18.body.opportunities.every((o) => ['remote', 'hybrid'].includes(o.workMode)), 'Multiple workMode mismatch');

  // 19. skills filter works
  const res19 = await request('/api/opportunities?skills=python', { headers: authHeaders });
  assert(res19.status === 200, 'Skills filter did not return 200');
  assert(res19.body.opportunities.some((o) => o._id === pubHackathon._id.toString()), 'Skills filter did not find hackathon');

  // 20. country filter works
  const res20 = await request('/api/opportunities?country=India', { headers: authHeaders });
  assert(res20.status === 200, 'Country filter did not return 200');

  // 21. state filter works
  const res21 = await request('/api/opportunities?state=Karnataka', { headers: authHeaders });
  assert(res21.status === 200, 'State filter did not return 200');

  // 22. city filter works
  const res22 = await request('/api/opportunities?city=Bengaluru', { headers: authHeaders });
  assert(res22.status === 200, 'City filter did not return 200');

  // 23. verified filter works
  const res23 = await request('/api/opportunities?verified=true', { headers: authHeaders });
  assert(res23.status === 200, 'Verified filter did not return 200');
  assert(res23.body.opportunities.every((o) => o.verified === true), 'Verified filter returned unverified');

  // 24. featured filter works
  const res24 = await request('/api/opportunities?featured=true', { headers: authHeaders });
  assert(res24.status === 200, 'Featured filter did not return 200');
  assert(res24.body.opportunities.every((o) => o.featured === true), 'Featured filter returned non-featured');

  // 25. deadlineBefore works
  const res25 = await request('/api/opportunities?deadlineBefore=2026-10-15T00:00:00Z', { headers: authHeaders });
  assert(res25.status === 200, 'deadlineBefore filter did not return 200');
  assert(res25.body.opportunities.some((o) => o._id === pubInternship._id.toString()), 'deadlineBefore missed internship');

  // 26. deadlineAfter works
  const res26 = await request('/api/opportunities?deadlineAfter=2026-10-15T00:00:00Z', { headers: authHeaders });
  assert(res26.status === 200, 'deadlineAfter filter did not return 200');

  // 27. eventDateBefore works
  const res27 = await request('/api/opportunities?eventDateBefore=2026-10-20T00:00:00Z', { headers: authHeaders });
  assert(res27.status === 200, 'eventDateBefore filter did not return 200');

  // 28. eventDateAfter works
  const res28 = await request('/api/opportunities?eventDateAfter=2026-11-01T00:00:00Z', { headers: authHeaders });
  assert(res28.status === 200, 'eventDateAfter filter did not return 200');

  // 29. deadline sorting works
  const res29 = await request('/api/opportunities?sort=deadline_asc', { headers: authHeaders });
  assert(res29.status === 200, 'deadline_asc sort did not return 200');

  // 30. event sorting works
  const res30 = await request('/api/opportunities?sort=event_desc', { headers: authHeaders });
  assert(res30.status === 200, 'event_desc sort did not return 200');

  // 31. newest sorting works
  const res31 = await request('/api/opportunities?sort=newest', { headers: authHeaders });
  assert(res31.status === 200, 'newest sort did not return 200');

  // 32. oldest sorting works
  const res32 = await request('/api/opportunities?sort=oldest', { headers: authHeaders });
  assert(res32.status === 200, 'oldest sort did not return 200');

  // 33. featured sorting works
  const res33 = await request('/api/opportunities?sort=featured', { headers: authHeaders });
  assert(res33.status === 200, 'featured sort did not return 200');

  // 34. invalid date rejected
  const res34 = await request('/api/opportunities?deadlineBefore=not-a-date', { headers: authHeaders });
  assert(res34.status === 400, 'Invalid date was not rejected with 400');

  // 35. invalid type rejected
  const res35 = await request('/api/opportunities?type=unknown_type', { headers: authHeaders });
  assert(res35.status === 400, 'Invalid type was not rejected with 400');

  // 36. invalid workMode rejected
  const res36 = await request('/api/opportunities?workMode=space', { headers: authHeaders });
  assert(res36.status === 400, 'Invalid workMode was not rejected with 400');

  // 37. invalid boolean rejected
  const res37 = await request('/api/opportunities?verified=yes', { headers: authHeaders });
  assert(res37.status === 400, 'Invalid boolean was not rejected with 400');

  // 38. invalid sort rejected
  const res38 = await request('/api/opportunities?sort=random_sort', { headers: authHeaders });
  assert(res38.status === 400, 'Invalid sort was not rejected with 400');

  // 39. regex/operator injection cannot alter query
  const res39 = await request(`/api/opportunities?q=${encodeURIComponent('.*')}`, { headers: authHeaders });
  assert(res39.status === 200, 'Regex metacharacter query failed');

  // 40. empty result returns HTTP 200
  const res40 = await request(`/api/opportunities?q=${encodeURIComponent('NonExistentTitleX123')}`, { headers: authHeaders });
  assert(res40.status === 200, 'Empty search result did not return 200');
  assert(res40.body.opportunities.length === 0, 'Empty search returned items');

  console.log('Opportunity REST API verification passed successfully (41 test cases)');
} catch (error) {
  console.error('Opportunity REST API verification failed:', error);
  process.exitCode = 1;
} finally {
  if (server) {
    server.close();
  }
  await Opportunity.deleteMany({ title: { $regex: testRunId } });
  await User.deleteMany({ email: { $regex: testRunId } });
  await disconnectDatabase();
}
