import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Opportunity } from '../src/models/Opportunity.js';

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

const verificationId = `phase41-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testTitlePrefix = `Test Opportunity ${verificationId}`;

try {
  await connectDatabase();
  await Opportunity.init();

  // 1. Valid internship creation
  const internship = await Opportunity.create({
    title: `${testTitlePrefix} - Software Engineering Intern`,
    organization: 'Tech Corp',
    description: 'Build scalable services and API endpoints.',
    shortDescription: 'Software Engineering Summer Internship',
    type: 'internship',
    workMode: 'hybrid',
    location: { country: 'India', state: 'Karnataka', city: 'Bengaluru' },
    stipend: { amount: 35000, currency: 'INR', period: 'monthly' },
    duration: '3 months',
    applicationUrl: 'https://techcorp.example.com/apply/123',
    organizationWebsite: 'https://techcorp.example.com',
    skills: ['JavaScript', 'Node.js', 'React'],
    tags: ['FullStack', 'WebDev'],
    status: 'published',
    featured: true,
  });

  assert(internship._id, 'Internship not created');
  assert(internship.status === 'published', 'Status mismatch');
  assert(internship.featured === true, 'Featured mismatch');
  assert(internship.createdAt && internship.updatedAt, 'Timestamps missing');
  assert(internship.skills.includes('javascript'), 'Skill not lowercased');

  // 2. Valid hackathon creation
  const hackathon = await Opportunity.create({
    title: `${testTitlePrefix} - AI Innovation Hackathon`,
    organization: 'AI Foundation',
    description: '48-hour global AI challenge.',
    type: 'hackathon',
    workMode: 'onsite',
    prize: { amount: 500000, currency: 'INR' },
    eventDate: new Date('2026-10-15T09:00:00Z'),
    endDate: new Date('2026-10-17T18:00:00Z'),
    deadline: new Date('2026-10-10T23:59:59Z'),
    registrationUrl: 'https://aifoundation.example.com/hackathon',
  });
  assert(hackathon._id, 'Hackathon not created');
  assert(hackathon.status === 'draft', 'Status default mismatch');
  assert(hackathon.verified === false, 'Verified default mismatch');

  // 3. Valid workshop creation
  const workshop = await Opportunity.create({
    title: `${testTitlePrefix} - Cloud Architecture Workshop`,
    organization: 'Cloud Alliance',
    description: 'Hands-on AWS and Docker session.',
    type: 'workshop',
    workMode: 'online',
    eventDate: new Date('2026-11-01T10:00:00Z'),
  });
  assert(workshop._id, 'Workshop not created');

  // 4. Valid online event creation
  const onlineEvent = await Opportunity.create({
    title: `${testTitlePrefix} - Global Tech Expo`,
    organization: 'TechExpo International',
    description: 'Virtual tech conference and expo.',
    type: 'expo',
    workMode: 'online',
    source: { name: 'Devfolio', url: 'https://devfolio.example.com' },
  });
  assert(onlineEvent._id, 'Online event not created');

  // 5. Valid remote opportunity creation
  const remoteOpp = await Opportunity.create({
    title: `${testTitlePrefix} - Open Source Contributor`,
    organization: 'OpenSource Labs',
    description: 'Contribute to core repository.',
    type: 'open_source',
    workMode: 'remote',
  });
  assert(remoteOpp._id, 'Remote opp not created');

  // 6. Missing title rejection
  await expectValidationError(
    new Opportunity({ organization: 'Tech Corp', description: 'Desc', type: 'internship' }),
    'Missing title was not rejected',
  );

  // 7. Missing organization rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', description: 'Desc', type: 'internship' }),
    'Missing organization was not rejected',
  );

  // 8. Invalid type rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'invalid_type' }),
    'Invalid type was not rejected',
  );

  // 9. Invalid workMode rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'internship', workMode: 'invalid_mode' }),
    'Invalid workMode was not rejected',
  );

  // 10. Invalid status rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'internship', status: 'invalid_status' }),
    'Invalid status was not rejected',
  );

  // 11. Invalid applicationUrl scheme rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'internship', applicationUrl: 'ftp://example.com' }),
    'Invalid applicationUrl scheme was not rejected',
  );

  // 12. Invalid registrationUrl scheme rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'internship', registrationUrl: 'javascript:alert(1)' }),
    'Invalid registrationUrl scheme was not rejected',
  );

  // 13. Invalid organizationWebsite scheme rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'internship', organizationWebsite: 'file:///etc/passwd' }),
    'Invalid organizationWebsite scheme was not rejected',
  );

  // 14. Negative stipend amount rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'internship', stipend: { amount: -500 } }),
    'Negative stipend amount was not rejected',
  );

  // 15. Negative prize amount rejection
  await expectValidationError(
    new Opportunity({ title: 'Test Opp', organization: 'Tech Corp', description: 'Desc', type: 'hackathon', prize: { amount: -1000 } }),
    'Negative prize amount was not rejected',
  );

  // 16. endDate before eventDate rejection
  await expectValidationError(
    new Opportunity({
      title: 'Test Opp',
      organization: 'Tech Corp',
      description: 'Desc',
      type: 'hackathon',
      eventDate: new Date('2026-10-15T00:00:00Z'),
      endDate: new Date('2026-10-14T00:00:00Z'),
    }),
    'endDate before eventDate was not rejected',
  );

  // 17. Indexes check
  const indexes = await Opportunity.collection.indexes();
  assert(indexes.some((idx) => idx.key.title === 1), 'Index on title missing');
  assert(indexes.some((idx) => idx.key.organization === 1), 'Index on organization missing');
  assert(indexes.some((idx) => idx.key.type === 1), 'Index on type missing');
  assert(indexes.some((idx) => idx.key.status === 1), 'Index on status missing');
  assert(indexes.some((idx) => idx.key.featured === 1), 'Index on featured missing');

  console.log('Opportunity model verification passed successfully');
} catch (error) {
  console.error('Opportunity model verification failed:', error);
  process.exitCode = 1;
} finally {
  await Opportunity.deleteMany({ title: { $regex: testTitlePrefix } });
  await disconnectDatabase();
}
