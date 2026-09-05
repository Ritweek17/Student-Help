import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { Application } from '../src/models/Application.js';
import { CalendarEvent } from '../src/models/CalendarEvent.js';
import { Notification } from '../src/models/Notification.js';
import {
  findDueCalendarEvents,
  processDueReminders,
} from '../src/services/reminder.service.js';
import { getPollInterval } from '../src/workers/reminder.worker.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 4.7.4 CALENDAR REMINDER WORKER VERIFICATION ---');

  await connectDatabase();
  await Notification.syncIndexes();
  await CalendarEvent.syncIndexes();

  let userA, userB;
  let testOpp, testApp;
  let createdUserIds = [];
  let createdOppIds = [];
  let createdAppIds = [];
  let createdEventIds = [];
  let createdNotifIds = [];

  try {
    const timestamp = Date.now();

    // 1. Setup Users
    userA = await User.create({
      email: `reminder.userA.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'User A Reminder',
      role: 'student',
    });
    createdUserIds.push(userA._id);

    userB = await User.create({
      email: `reminder.userB.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'User B Reminder',
      role: 'student',
    });
    createdUserIds.push(userB._id);

    // Setup Opportunity & Application
    testOpp = await Opportunity.create({
      title: 'Worker Verification Hackathon',
      organization: 'Tech Labs',
      description: 'Hackathon description',
      type: 'hackathon',
      status: 'published',
      workMode: 'online',
    });
    createdOppIds.push(testOpp._id);

    testApp = await Application.create({
      userId: userA._id,
      opportunityId: testOpp._id,
      type: 'registration',
      status: 'registered',
    });
    createdAppIds.push(testApp._id);

    console.log('✅ Test setup completed');

    const baseTime = new Date('2026-10-15T12:00:00.000Z');

    // ----------------------------------------------------
    // TEST 1: Future event before due -> no notification
    // ----------------------------------------------------
    console.log('\n--- Test 1: Future event before due -> no notification ---');
    // Event at 14:00 (120 mins in future), reminder 30 mins -> due at 13:30.
    // At baseTime (12:00), not due yet.
    const futureEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Future Workshop',
      type: 'event',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(futureEvent._id);

    const res1 = await processDueReminders(baseTime);
    const notif1 = await Notification.findOne({
      userId: userA._id,
      calendarEventId: futureEvent._id,
    });
    assert(!notif1, 'No notification should be created for event before due time');
    console.log('✅ Test 1 passed');

    // ----------------------------------------------------
    // TEST 2: Due event -> notification created
    // ----------------------------------------------------
    console.log('\n--- Test 2: Due event -> notification created ---');
    // Advance simulated time to 13:35 (past the 13:30 trigger time, but before 14:00 start)
    const dueTime = new Date('2026-10-15T13:35:00.000Z');
    const res2 = await processDueReminders(dueTime);
    assert(res2.processed >= 1, 'Should have processed at least 1 event');
    assert(res2.notificationsCreated >= 1, 'Should have created at least 1 notification');

    const notif2 = await Notification.findOne({
      userId: userA._id,
      calendarEventId: futureEvent._id,
    });
    assert(notif2, 'Notification must be created when reminder is due');
    createdNotifIds.push(notif2._id);
    console.log('✅ Test 2 passed');

    // ----------------------------------------------------
    // TEST 3: Repeated processing -> no duplicate
    // ----------------------------------------------------
    console.log('\n--- Test 3: Repeated processing -> no duplicate ---');
    const res3 = await processDueReminders(dueTime);
    assert(res3.notificationsCreated === 0, 'Repeated processing must create 0 new notifications');
    const count3 = await Notification.countDocuments({
      userId: userA._id,
      calendarEventId: futureEvent._id,
    });
    assert(count3 === 1, 'Notification count must strictly remain 1');
    console.log('✅ Test 3 passed');

    // ----------------------------------------------------
    // TEST 4: Concurrent processing -> one notification
    // ----------------------------------------------------
    console.log('\n--- Test 4: Concurrent processing -> one notification ---');
    const raceEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Race Condition Event',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(raceEvent._id);

    const [raceRes1, raceRes2] = await Promise.all([
      processDueReminders(dueTime),
      processDueReminders(dueTime),
    ]);
    const raceCount = await Notification.countDocuments({
      userId: userA._id,
      calendarEventId: raceEvent._id,
    });
    assert(raceCount === 1, 'Concurrent cycles must produce exactly one notification');
    const totalCreatedInRace = raceRes1.notificationsCreated + raceRes2.notificationsCreated;
    assert(totalCreatedInRace === 1, 'Total notificationsCreated across concurrent cycles must equal 1');
    console.log('✅ Test 4 passed');

    // ----------------------------------------------------
    // TEST 5: Type = calendar_reminder
    // ----------------------------------------------------
    console.log('\n--- Test 5: Type = calendar_reminder ---');
    assert(notif2.type === 'calendar_reminder', 'Notification type must be calendar_reminder');
    console.log('✅ Test 5 passed');

    // ----------------------------------------------------
    // TEST 6: Deterministic notificationKey
    // ----------------------------------------------------
    console.log('\n--- Test 6: Deterministic notificationKey ---');
    const expectedKey = `calendar:${futureEvent._id}:reminder:30`;
    assert(notif2.notificationKey === expectedKey, `Key must be ${expectedKey}, got ${notif2.notificationKey}`);
    console.log('✅ Test 6 passed');

    // ----------------------------------------------------
    // TEST 7: calendarEventId linked
    // ----------------------------------------------------
    console.log('\n--- Test 7: calendarEventId linked ---');
    assert(
      notif2.calendarEventId.toString() === futureEvent._id.toString(),
      'calendarEventId must match CalendarEvent._id'
    );
    console.log('✅ Test 7 passed');

    // ----------------------------------------------------
    // TEST 8 & 9: opportunityId & applicationId preserved
    // ----------------------------------------------------
    console.log('\n--- Test 8 & 9: opportunityId & applicationId preserved ---');
    const linkedEvent = await CalendarEvent.create({
      userId: userA._id,
      opportunityId: testOpp._id,
      applicationId: testApp._id,
      title: 'Linked Hackathon Event',
      type: 'registration',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(linkedEvent._id);

    await processDueReminders(dueTime);
    const linkedNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: linkedEvent._id,
    });
    assert(linkedNotif, 'Notification for linked event must exist');
    assert(
      linkedNotif.opportunityId &&
      linkedNotif.opportunityId.toString() === testOpp._id.toString(),
      'opportunityId must be preserved'
    );
    assert(
      linkedNotif.applicationId &&
      linkedNotif.applicationId.toString() === testApp._id.toString(),
      'applicationId must be preserved'
    );
    createdNotifIds.push(linkedNotif._id);
    console.log('✅ Test 8 & 9 passed');

    // ----------------------------------------------------
    // TEST 10: Cancelled event -> no notification
    // ----------------------------------------------------
    console.log('\n--- Test 10: Cancelled event -> no notification ---');
    const cancelledEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Cancelled Meeting',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'cancelled',
      reminderMinutes: 30,
    });
    createdEventIds.push(cancelledEvent._id);

    await processDueReminders(dueTime);
    const cancelledNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: cancelledEvent._id,
    });
    assert(!cancelledNotif, 'Cancelled event must produce no notification');
    console.log('✅ Test 10 passed');

    // ----------------------------------------------------
    // TEST 11: Completed event -> no notification
    // ----------------------------------------------------
    console.log('\n--- Test 11: Completed event -> no notification ---');
    const completedEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Completed Meeting',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'completed',
      reminderMinutes: 30,
    });
    createdEventIds.push(completedEvent._id);

    await processDueReminders(dueTime);
    const completedNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: completedEvent._id,
    });
    assert(!completedNotif, 'Completed event must produce no notification');
    console.log('✅ Test 11 passed');

    // ----------------------------------------------------
    // TEST 12: No reminder -> no notification
    // ----------------------------------------------------
    console.log('\n--- Test 12: No reminder -> no notification ---');
    const noReminderEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'No Reminder Event',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
    });
    createdEventIds.push(noReminderEvent._id);

    await processDueReminders(dueTime);
    const noReminderNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: noReminderEvent._id,
    });
    assert(!noReminderNotif, 'Event with missing reminderMinutes must produce no notification');
    console.log('✅ Test 12 passed');

    // ----------------------------------------------------
    // TEST 13: reminderMinutes = 0 -> no notification
    // ----------------------------------------------------
    console.log('\n--- Test 13: reminderMinutes = 0 -> no notification ---');
    const zeroReminderEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Zero Reminder Event',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 0,
    });
    createdEventIds.push(zeroReminderEvent._id);

    await processDueReminders(dueTime);
    const zeroReminderNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: zeroReminderEvent._id,
    });
    assert(!zeroReminderNotif, 'Event with reminderMinutes = 0 must produce no notification');
    console.log('✅ Test 13 passed');

    // ----------------------------------------------------
    // TEST 14: Past event -> no notification
    // ----------------------------------------------------
    console.log('\n--- Test 14: Past event -> no notification ---');
    const pastEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Past Event',
      type: 'personal',
      startAt: new Date('2026-10-15T11:00:00.000Z'), // Started 2.5 hours before dueTime (13:35)
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(pastEvent._id);

    await processDueReminders(dueTime);
    const pastNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: pastEvent._id,
    });
    assert(!pastNotif, 'Past/already started event must produce no notification');
    console.log('✅ Test 14 passed');

    // ----------------------------------------------------
    // TEST 15: Changed startAt uses latest value
    // ----------------------------------------------------
    console.log('\n--- Test 15: Changed startAt uses latest value ---');
    // Originally at 18:00 (reminder at 17:30, not due at 13:35)
    const rescheduleEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Rescheduled Event',
      type: 'personal',
      startAt: new Date('2026-10-15T18:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(rescheduleEvent._id);

    await processDueReminders(dueTime);
    let reschedNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: rescheduleEvent._id,
    });
    assert(!reschedNotif, 'Should not be due prior to rescheduling');

    // Reschedule to 14:00 (reminder at 13:30, so due at 13:35!)
    rescheduleEvent.startAt = new Date('2026-10-15T14:00:00.000Z');
    await rescheduleEvent.save();

    await processDueReminders(dueTime);
    reschedNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: rescheduleEvent._id,
    });
    assert(reschedNotif, 'Notification must be created using updated startAt');
    createdNotifIds.push(reschedNotif._id);
    console.log('✅ Test 15 passed');

    // ----------------------------------------------------
    // TEST 16: Changed reminderMinutes uses latest value
    // ----------------------------------------------------
    console.log('\n--- Test 16: Changed reminderMinutes uses latest value ---');
    // Event at 15:00. Originally reminderMinutes = 15 -> due at 14:45. At 13:35, not due!
    const configEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Config Change Event',
      type: 'personal',
      startAt: new Date('2026-10-15T15:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 15,
    });
    createdEventIds.push(configEvent._id);

    await processDueReminders(dueTime);
    let configNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: configEvent._id,
    });
    assert(!configNotif, 'Should not be due with 15 mins reminder at 13:35');

    // User changes reminderMinutes to 90 -> due at 13:30, so due at 13:35!
    configEvent.reminderMinutes = 90;
    await configEvent.save();

    await processDueReminders(dueTime);
    configNotif = await Notification.findOne({
      userId: userA._id,
      calendarEventId: configEvent._id,
    });
    assert(configNotif, 'Notification must be created using updated reminderMinutes');
    assert(
      configNotif.notificationKey === `calendar:${configEvent._id}:reminder:90`,
      'NotificationKey must reflect updated reminderMinutes'
    );
    assert(configNotif.message.includes('90 minutes'), 'Message must reflect 90 minutes');
    createdNotifIds.push(configNotif._id);
    console.log('✅ Test 16 passed');

    // ----------------------------------------------------
    // TEST 17: User A notification remains User A
    // ----------------------------------------------------
    console.log('\n--- Test 17: User A notification remains User A ---');
    const userBEvent = await CalendarEvent.create({
      userId: userB._id,
      title: 'User B Event',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(userBEvent._id);

    await processDueReminders(dueTime);
    const userBNotif = await Notification.findOne({
      userId: userB._id,
      calendarEventId: userBEvent._id,
    });
    assert(userBNotif, 'User B notification should be created');
    assert(userBNotif.userId.toString() === userB._id.toString(), 'Belongs to User B');

    const crossCheck = await Notification.findOne({
      userId: userA._id,
      calendarEventId: userBEvent._id,
    });
    assert(!crossCheck, 'User A must not own User B event notification');
    createdNotifIds.push(userBNotif._id);
    console.log('✅ Test 17 passed');

    // ----------------------------------------------------
    // TEST 18: One failing event does not stop others
    // ----------------------------------------------------
    console.log('\n--- Test 18: One failing event does not stop others ---');
    const validEvent1 = await CalendarEvent.create({
      userId: userA._id,
      title: 'Valid Event 1',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(validEvent1._id);

    // Event with invalid userId (non-existent or broken structure if manipulated)
    const brokenEvent = await CalendarEvent.create({
      userId: new mongoose.Types.ObjectId(), // Unassociated user ID
      title: 'Broken User Event',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(brokenEvent._id);

    const validEvent2 = await CalendarEvent.create({
      userId: userA._id,
      title: 'Valid Event 2',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 30,
    });
    createdEventIds.push(validEvent2._id);

    const failBatchRes = await processDueReminders(dueTime);
    assert(failBatchRes.processed >= 2, 'Should process other events in batch');

    const notifV1 = await Notification.findOne({
      userId: userA._id,
      calendarEventId: validEvent1._id,
    });
    const notifV2 = await Notification.findOne({
      userId: userA._id,
      calendarEventId: validEvent2._id,
    });
    assert(notifV1, 'Valid event 1 notification must exist');
    assert(notifV2, 'Valid event 2 notification must exist');
    if (notifV1) createdNotifIds.push(notifV1._id);
    if (notifV2) createdNotifIds.push(notifV2._id);
    console.log('✅ Test 18 passed');

    // ----------------------------------------------------
    // TEST 19: Bounded batch processing works
    // ----------------------------------------------------
    console.log('\n--- Test 19: Bounded batch processing works ---');
    // Test that passing batchSize: 2 only returns at most 2 events
    const batchEvents = await findDueCalendarEvents(dueTime, { batchSize: 2 });
    assert(batchEvents.length <= 2, `Bounded query returned ${batchEvents.length} <= 2`);
    console.log('✅ Test 19 passed');

    // ----------------------------------------------------
    // TEST 20 & 21: Special Idempotency Test (Step 24)
    // ----------------------------------------------------
    console.log('\n--- Test 20: Special Idempotency Test (Step 24) ---');
    const idemEvent = await CalendarEvent.create({
      userId: userA._id,
      title: 'Idempotency Verification Event',
      type: 'personal',
      startAt: new Date('2026-10-15T14:00:00.000Z'),
      status: 'scheduled',
      reminderMinutes: 25,
    });
    createdEventIds.push(idemEvent._id);

    // Run cycle 1
    const cycle1 = await processDueReminders(dueTime);
    assert(cycle1.notificationsCreated >= 1, 'Cycle 1 created notification');

    // Run cycle 2
    const cycle2 = await processDueReminders(dueTime);

    // Run cycle 3
    const cycle3 = await processDueReminders(dueTime);

    const idemNotifs = await Notification.find({
      userId: userA._id,
      notificationKey: `calendar:${idemEvent._id}:reminder:25`,
    });
    assert(idemNotifs.length === 1, 'Exactly ONE calendar_reminder notification exists after 3 cycles');
    createdNotifIds.push(idemNotifs[0]._id);
    console.log('✅ Test 20 (Special Idempotency) passed');

    // ----------------------------------------------------
    // TEST 21: Configuration Tests (Step 25)
    // ----------------------------------------------------
    console.log('\n--- Test 21: Configuration Tests (Step 25) ---');
    // Default works
    assert(getPollInterval(undefined) === 60000, 'Default poll interval should be 60000');
    assert(getPollInterval('') === 60000, 'Empty string poll interval should be 60000');

    // Custom value works
    assert(getPollInterval('5000') === 5000, 'Custom valid poll interval works');
    assert(getPollInterval(10000) === 10000, 'Numeric poll interval works');

    // Below 1000 is clamped to 1000
    assert(getPollInterval('500') === 1000, '500 clamped to 1000');
    assert(getPollInterval('0') === 1000, '0 clamped to 1000');
    assert(getPollInterval('-5000') === 1000, '-5000 clamped to 1000');

    // Invalid value falls back safely
    assert(getPollInterval('invalid_string') === 60000, 'NaN string falls back to 60000');
    assert(getPollInterval('NaN') === 60000, 'NaN falls back to 60000');
    assert(getPollInterval(Infinity) === 60000, 'Infinity falls back to 60000');
    console.log('✅ Test 21 (Configuration) passed');

    // ----------------------------------------------------
    // TEST 22: Cleanup succeeds
    // ----------------------------------------------------
    console.log('\n--- Test 22: Cleanup succeeds ---');
    await Notification.deleteMany({ _id: { $in: createdNotifIds } });
    await Notification.deleteMany({ userId: { $in: createdUserIds } });
    await CalendarEvent.deleteMany({ _id: { $in: createdEventIds } });
    await CalendarEvent.deleteMany({ userId: { $in: createdUserIds } });
    await Application.deleteMany({ _id: { $in: createdAppIds } });
    await Opportunity.deleteMany({ _id: { $in: createdOppIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✅ Test 22 passed: Temporary test data cleaned up');

    console.log('\n🎉 ALL CALENDAR REMINDER WORKER TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILURE:', err);
    throw err;
  } finally {
    try {
      await Notification.deleteMany({ userId: { $in: createdUserIds } });
      await CalendarEvent.deleteMany({ userId: { $in: createdUserIds } });
      await Application.deleteMany({ userId: { $in: createdUserIds } });
      await Opportunity.deleteMany({ _id: { $in: createdOppIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
    } catch (cleanupErr) {
      console.error('Cleanup in finally block error:', cleanupErr);
    }
    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
