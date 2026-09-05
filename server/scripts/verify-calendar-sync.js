import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { Application } from '../src/models/Application.js';
import { CalendarEvent } from '../src/models/CalendarEvent.js';
import {
  createApplication,
  updateApplication,
  deleteApplication,
} from '../src/services/application.service.js';
import {
  createCalendarEvent,
} from '../src/services/calendar.service.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 4.6.3 AUTOMATIC CALENDAR SYNC VERIFICATION ---');

  await connectDatabase();
  try {
    await CalendarEvent.collection.dropIndex('userId_1_syncKey_1');
  } catch (e) {
    // Index may not exist or already dropped
  }
  await CalendarEvent.syncIndexes();

  let userA, userB, tokenA, tokenB;
  let internshipOpp, hackathonOpp, noDeadlineOpp;
  let createdEventIds = [];
  let createdAppIds = [];
  let createdOppIds = [];
  let createdUserIds = [];

  try {
    // 1. Setup isolated test users
    const timestamp = Date.now();
    userA = await User.create({
      email: `sync.userA.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'User A Sync',
      role: 'student',
    });
    createdUserIds.push(userA._id);

    userB = await User.create({
      email: `sync.userB.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'User B Sync',
      role: 'student',
    });
    createdUserIds.push(userB._id);

    tokenA = jwt.sign({ userId: userA._id, role: userA.role }, env.jwtSecret);
    tokenB = jwt.sign({ userId: userB._id, role: userB.role }, env.jwtSecret);

    // 2. Create test opportunities
    const now = new Date();
    const eventStartDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eventEndDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const deadlineDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    hackathonOpp = await Opportunity.create({
      title: 'Sync Hackathon 2026',
      organization: 'Tech Hub',
      description: 'Hackathon for students',
      type: 'hackathon',
      status: 'published',
      eventDate: eventStartDate,
      endDate: eventEndDate,
      deadline: deadlineDate,
      workMode: 'online',
    });
    createdOppIds.push(hackathonOpp._id);

    internshipOpp = await Opportunity.create({
      title: 'Sync Frontend Internship',
      organization: 'Dev Corp',
      description: 'Summer Internship',
      type: 'internship',
      status: 'published',
      deadline: deadlineDate,
      workMode: 'remote',
    });
    createdOppIds.push(internshipOpp._id);

    noDeadlineOpp = await Opportunity.create({
      title: 'No Deadline Opportunity',
      organization: 'Open Org',
      description: 'Open ended program',
      type: 'fellowship',
      status: 'published',
      workMode: 'online',
    });
    createdOppIds.push(noDeadlineOpp._id);

    // TEST 1: Registration creates registration event
    console.log('Running Test 1: Registration creates registration event...');
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    assert(regRes.status === 201, 'Registration application failed to create');
    const regApp = regRes.data.application;
    createdAppIds.push(regApp._id);

    const regEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: regApp._id,
      type: 'registration',
    }).lean();

    assert(regEvents.length === 1, `Expected 1 registration event, found ${regEvents.length}`);
    const regEvent = regEvents[0];
    createdEventIds.push(regEvent._id);

    // TEST 2 & 3: eventDate maps to startAt, endDate maps to endAt
    console.log('Running Test 2 & 3: Date mapping...');
    assert(new Date(regEvent.startAt).getTime() === eventStartDate.getTime(), 'startAt date does not match eventDate');
    assert(new Date(regEvent.endAt).getTime() === eventEndDate.getTime(), 'endAt date does not match endDate');

    // TEST 4, 5, 6: source, links
    console.log('Running Test 4, 5, 6: Source and links...');
    assert(regEvent.source === 'registration', `Source should be 'registration', got ${regEvent.source}`);
    assert(regEvent.applicationId.toString() === regApp._id.toString(), 'Application ID link mismatch');
    assert(regEvent.opportunityId.toString() === hackathonOpp._id.toString(), 'Opportunity ID link mismatch');

    // TEST 7 & 8: Repeated sync / update does not create duplicate (idempotency)
    console.log('Running Test 7 & 8: Repeated sync / update idempotency...');
    await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      notes: 'Updated registration notes',
    });

    const regEventsAfter = await CalendarEvent.find({
      userId: userA._id,
      applicationId: regApp._id,
      type: 'registration',
    }).lean();
    assert(regEventsAfter.length === 1, `Repeated update created duplicate events! Found ${regEventsAfter.length}`);

    // TEST 9: Registration cancellation marks event cancelled
    console.log('Running Test 9: Registration cancellation status sync...');
    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'cancelled',
    });
    const cancelledRegEvent = await CalendarEvent.findById(regEvent._id).lean();
    assert(cancelledRegEvent.status === 'cancelled', `Event status should be 'cancelled', got ${cancelledRegEvent.status}`);

    // TEST 10: Completed / attended preserves event
    console.log('Running Test 10: Registration completion status sync...');
    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'registered',
    });
    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'completed',
    });
    const completedRegEvent = await CalendarEvent.findById(regEvent._id).lean();
    assert(completedRegEvent.status === 'scheduled', `Historical event should remain scheduled/available, got ${completedRegEvent.status}`);

    // TEST 11: Application deadline creates deadline event
    console.log('Running Test 11: Application deadline creates deadline event...');
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    assert(appRes.status === 201, 'Application tracking failed to create');
    const appRecord = appRes.data.application;
    createdAppIds.push(appRecord._id);

    const deadlineEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: appRecord._id,
      type: 'deadline',
    }).lean();

    assert(deadlineEvents.length === 1, `Expected 1 deadline event, found ${deadlineEvents.length}`);
    const deadlineEvent = deadlineEvents[0];
    createdEventIds.push(deadlineEvent._id);
    assert(deadlineEvent.source === 'application', `Deadline event source should be 'application', got ${deadlineEvent.source}`);
    assert(new Date(deadlineEvent.startAt).getTime() === deadlineDate.getTime(), 'Deadline startAt does not match opportunity deadline');

    // TEST 12: Registration deadline also creates deadline event
    console.log('Running Test 12: Registration deadline event...');
    const regDeadlineEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: regApp._id,
      type: 'deadline',
    }).lean();
    assert(regDeadlineEvents.length === 1, `Expected 1 registration deadline event, found ${regDeadlineEvents.length}`);
    createdEventIds.push(regDeadlineEvents[0]._id);

    // TEST 13, 14, 15: Application update deadline handling
    console.log('Running Test 13, 14, 15: Deadline updates...');
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'waiting',
    });
    const deadlineEventsAfter = await CalendarEvent.find({
      userId: userA._id,
      applicationId: appRecord._id,
      type: 'deadline',
    }).lean();
    assert(deadlineEventsAfter.length === 1, `Duplicate deadline event created on application update!`);

    // TEST 16: Generated syncKey format is stable
    console.log('Running Test 16: Sync key stability...');
    assert(deadlineEvent.syncKey === `application:${appRecord._id}:deadline`, `Unexpected syncKey: ${deadlineEvent.syncKey}`);

    // TEST 17: User isolation
    console.log('Running Test 17: User isolation...');
    const userBEvents = await CalendarEvent.find({ userId: userB._id }).lean();
    assert(userBEvents.length === 0, `User B should have 0 events, found ${userBEvents.length}`);

    // TEST 18: Manual event protection
    console.log('Running Test 18: Manual event protection...');
    const manualEventRes = await createCalendarEvent(userA._id, {
      title: 'Manual Interview Prep',
      type: 'personal',
      startAt: new Date(),
      source: 'manual',
      applicationId: appRecord._id,
      opportunityId: internshipOpp._id,
    });
    assert(manualEventRes.status === 201, 'Failed to create manual event');
    const manualEvent = manualEventRes.data.event;
    createdEventIds.push(manualEvent._id);

    // Trigger sync on update
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });
    const refreshedManualEvent = await CalendarEvent.findById(manualEvent._id).lean();
    assert(refreshedManualEvent.title === 'Manual Interview Prep', 'Manual event title was modified!');
    assert(refreshedManualEvent.source === 'manual', 'Manual event source was changed!');

    // TEST 19 & 20: Deleting tracking record cancels generated events without affecting manual events
    console.log('Running Test 19 & 20: Application deletion behavior...');
    await deleteApplication(userA._id, internshipOpp._id, 'application');

    const cancelledAppEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: appRecord._id,
      source: 'application',
    }).lean();
    assert(cancelledAppEvents.length > 0, 'Generated application events missing after deletion!');
    for (const ev of cancelledAppEvents) {
      assert(ev.status === 'cancelled', `Generated event status should be 'cancelled', got ${ev.status}`);
    }

    const postDeleteManual = await CalendarEvent.findById(manualEvent._id).lean();
    assert(postDeleteManual !== null, 'Manual event was accidentally deleted!');
    assert(postDeleteManual.status !== 'cancelled', `Manual event status should NOT be cancelled, got ${postDeleteManual.status}`);

    // TEST 21: No interview event without interviewAt
    console.log('Running Test 21: No interview event generated without interviewAt field...');
    const interviewEvents = await CalendarEvent.find({
      userId: userA._id,
      type: 'interview',
    }).lean();
    assert(interviewEvents.length === 0, `No interview events should be generated, found ${interviewEvents.length}`);

    console.log('All 21 assertion tests PASSED successfully!');
  } finally {
    // TEST 22: Clean up temporary data
    console.log('Running Test 22: Cleaning up temporary test data...');
    if (createdEventIds.length > 0) {
      await CalendarEvent.deleteMany({ _id: { $in: createdEventIds } });
    }
    await CalendarEvent.deleteMany({ userId: { $in: createdUserIds } });
    if (createdAppIds.length > 0) {
      await Application.deleteMany({ _id: { $in: createdAppIds } });
    }
    await Application.deleteMany({ userId: { $in: createdUserIds } });
    if (createdOppIds.length > 0) {
      await Opportunity.deleteMany({ _id: { $in: createdOppIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await disconnectDatabase();
    console.log('Cleanup completed cleanly.');
  }

  console.log('--- PHASE 4.6.3 VERIFICATION COMPLETE ---');
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
