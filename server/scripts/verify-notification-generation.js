import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { Application } from '../src/models/Application.js';
import { CalendarEvent } from '../src/models/CalendarEvent.js';
import { Notification } from '../src/models/Notification.js';
import {
  createApplication,
  updateApplication,
  deleteApplication,
} from '../src/services/application.service.js';
import {
  createNotification,
} from '../src/services/notification.service.js';
import {
  safeCreateNotification,
  generateNotificationsForApplication,
  generateNotificationsForApplicationStatusUpdate,
} from '../src/services/notificationGeneration.service.js';
import { validateNotificationCreate } from '../src/validators/notification.validator.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 4.7.3 AUTOMATIC NOTIFICATION GENERATION VERIFICATION ---');

  await connectDatabase();
  await Notification.syncIndexes();

  let userA, userB;
  let internshipOpp, hackathonOpp, noDeadlineOpp, noEventOpp;
  let createdUserIds = [];
  let createdOppIds = [];
  let createdAppIds = [];
  let createdEventIds = [];
  let createdNotifIds = [];

  try {
    const timestamp = Date.now();

    // Setup Test Users
    userA = await User.create({
      email: `notif.gen.userA.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'User A NotifGen',
      role: 'student',
    });
    createdUserIds.push(userA._id);

    userB = await User.create({
      email: `notif.gen.userB.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'User B NotifGen',
      role: 'student',
    });
    createdUserIds.push(userB._id);

    // Setup Opportunities
    const now = new Date();
    const eventDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const deadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    internshipOpp = await Opportunity.create({
      title: 'Gen Frontend Internship',
      organization: 'Dev Corp',
      description: 'Internship with deadline',
      type: 'internship',
      status: 'published',
      deadline,
      workMode: 'remote',
    });
    createdOppIds.push(internshipOpp._id);

    hackathonOpp = await Opportunity.create({
      title: 'Gen Code Sprint Hackathon',
      organization: 'Tech Hub',
      description: 'Hackathon with eventDate and deadline',
      type: 'hackathon',
      status: 'published',
      deadline,
      eventDate,
      endDate,
      workMode: 'online',
    });
    createdOppIds.push(hackathonOpp._id);

    noDeadlineOpp = await Opportunity.create({
      title: 'Gen Open Program No Deadline',
      organization: 'Open Org',
      description: 'No deadline opportunity',
      type: 'fellowship',
      status: 'published',
      workMode: 'online',
    });
    createdOppIds.push(noDeadlineOpp._id);

    noEventOpp = await Opportunity.create({
      title: 'Gen Workshop No Event Date',
      organization: 'Workshop Org',
      description: 'Registration opportunity without event date',
      type: 'workshop',
      status: 'published',
      workMode: 'online',
    });
    createdOppIds.push(noEventOpp._id);

    console.log('✅ Test setup completed');

    // ----------------------------------------------------
    // TEST 1: Application creation generates deadline notification
    // ----------------------------------------------------
    console.log('\n--- Test 1: Application creation generates deadline notification ---');
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    assert(appRes.status === 201, 'Application creation should return 201');
    const appA = appRes.data.application;
    createdAppIds.push(appA._id);

    const deadlineNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });
    assert(deadlineNotif, 'Deadline notification must exist');
    assert(deadlineNotif.type === 'application_deadline', 'Type must be application_deadline');
    assert(deadlineNotif.title === 'Application deadline', 'Title must be Application deadline');
    assert(deadlineNotif.message.includes(internshipOpp.title), 'Message must include opportunity title');
    createdNotifIds.push(deadlineNotif._id);
    console.log('✅ Test 1 passed');

    // ----------------------------------------------------
    // TEST 2: Repeated generation does not duplicate deadline notification
    // ----------------------------------------------------
    console.log('\n--- Test 2: Repeated generation does not duplicate deadline notification ---');
    await generateNotificationsForApplication(userA._id, appA._id);
    await generateNotificationsForApplication(userA._id, appA._id);
    const deadlineNotifCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });
    assert(deadlineNotifCount === 1, 'Deadline notification count must strictly be 1');
    console.log('✅ Test 2 passed');

    // ----------------------------------------------------
    // TEST 3: Registration creation generates registration-event notification
    // ----------------------------------------------------
    console.log('\n--- Test 3: Registration creation generates registration-event notification ---');
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    assert(regRes.status === 201, 'Registration creation should return 201');
    const regA = regRes.data.application;
    createdAppIds.push(regA._id);

    const regEventNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:event`,
    });
    assert(regEventNotif, 'Registration event notification must exist');
    assert(regEventNotif.type === 'registration_event', 'Type must be registration_event');
    assert(regEventNotif.title === 'Upcoming registration event', 'Title must match');
    assert(regEventNotif.message.includes(hackathonOpp.title), 'Message must include hackathon title');
    createdNotifIds.push(regEventNotif._id);
    console.log('✅ Test 3 passed');

    // ----------------------------------------------------
    // TEST 4: Repeated generation does not duplicate registration event
    // ----------------------------------------------------
    console.log('\n--- Test 4: Repeated generation does not duplicate registration event ---');
    await generateNotificationsForApplication(userA._id, regA._id);
    await generateNotificationsForApplication(userA._id, regA._id);
    const regEventCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:event`,
    });
    assert(regEventCount === 1, 'Registration event notification count must strictly be 1');
    console.log('✅ Test 4 passed');

    // ----------------------------------------------------
    // TEST 5: Application status transition generates notification
    // ----------------------------------------------------
    console.log('\n--- Test 5: Application status transition generates notification ---');
    const updateAppRes = await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });
    assert(updateAppRes.status === 200, 'Update application status must return 200');

    const appStatusNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:status:interview`,
    });
    assert(appStatusNotif, 'Status update notification must exist');
    assert(appStatusNotif.type === 'application_update', 'Type must be application_update');
    assert(appStatusNotif.title === 'Application status updated', 'Title must match');
    assert(appStatusNotif.message.includes(internshipOpp.title), 'Message must include opportunity title');
    assert(appStatusNotif.message.includes('Interview'), 'Message must include Interview');
    createdNotifIds.push(appStatusNotif._id);
    console.log('✅ Test 5 passed');

    // ----------------------------------------------------
    // TEST 6: Repeated same status does not duplicate
    // ----------------------------------------------------
    console.log('\n--- Test 6: Repeated same status does not duplicate ---');
    // Call update with same status 'interview'
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });
    // Call coordinator directly to test idempotency
    await generateNotificationsForApplicationStatusUpdate(userA._id, appA._id, 'interview', 'interview');
    const appStatusCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `application:${appA._id}:status:interview`,
    });
    assert(appStatusCount === 1, 'Status notification count for interview must be strictly 1');
    console.log('✅ Test 6 passed');

    // ----------------------------------------------------
    // TEST 7: Registration status transition generates notification
    // ----------------------------------------------------
    console.log('\n--- Test 7: Registration status transition generates notification ---');
    const updateRegRes = await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'attended',
    });
    assert(updateRegRes.status === 200, 'Update registration status must return 200');

    const regStatusNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:status:attended`,
    });
    assert(regStatusNotif, 'Registration status notification must exist');
    assert(regStatusNotif.type === 'registration_update', 'Type must be registration_update');
    assert(regStatusNotif.title === 'Registration status updated', 'Title must match');
    assert(regStatusNotif.message.includes(hackathonOpp.title), 'Message must include hackathon title');
    assert(regStatusNotif.message.includes('Attended'), 'Message must include Attended');
    createdNotifIds.push(regStatusNotif._id);
    console.log('✅ Test 7 passed');

    // ----------------------------------------------------
    // TEST 8: Repeated same registration status does not duplicate
    // ----------------------------------------------------
    console.log('\n--- Test 8: Repeated same registration status does not duplicate ---');
    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'attended',
    });
    await generateNotificationsForApplicationStatusUpdate(userA._id, regA._id, 'attended', 'attended');
    const regStatusCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:status:attended`,
    });
    assert(regStatusCount === 1, 'Registration status notification count for attended must be strictly 1');
    console.log('✅ Test 8 passed');

    // ----------------------------------------------------
    // TEST 9: Notes-only update generates no notification
    // ----------------------------------------------------
    console.log('\n--- Test 9: Notes-only update generates no notification ---');
    const notifCountBeforeNotes = await Notification.countDocuments({ userId: userA._id });
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      notes: 'Notes updated without status change',
    });
    const notifCountAfterNotes = await Notification.countDocuments({ userId: userA._id });
    assert(notifCountBeforeNotes === notifCountAfterNotes, 'Notes-only update must not create notifications');
    console.log('✅ Test 9 passed');

    // ----------------------------------------------------
    // TEST 10: URL-only update generates no notification
    // ----------------------------------------------------
    console.log('\n--- Test 10: URL-only update generates no notification ---');
    const notifCountBeforeUrl = await Notification.countDocuments({ userId: userA._id });
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      externalUrl: 'https://example.com/updated-app',
    });
    const notifCountAfterUrl = await Notification.countDocuments({ userId: userA._id });
    assert(notifCountBeforeUrl === notifCountAfterUrl, 'URL-only update must not create notifications');
    console.log('✅ Test 10 passed');

    // ----------------------------------------------------
    // TEST 11: Application with no deadline generates no deadline notification
    // ----------------------------------------------------
    console.log('\n--- Test 11: Application with no deadline generates no deadline notification ---');
    const noDeadRes = await createApplication(userA._id, noDeadlineOpp._id, {
      type: 'application',
      status: 'applied',
    });
    assert(noDeadRes.status === 201, 'Should create application successfully');
    const noDeadApp = noDeadRes.data.application;
    createdAppIds.push(noDeadApp._id);

    const noDeadNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${noDeadApp._id}:deadline`,
    });
    assert(!noDeadNotif, 'No deadline notification should be created when deadline is missing');
    console.log('✅ Test 11 passed');

    // ----------------------------------------------------
    // TEST 12: Registration with no eventDate generates no event notification
    // ----------------------------------------------------
    console.log('\n--- Test 12: Registration with no eventDate generates no event notification ---');
    const noEvRes = await createApplication(userA._id, noEventOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    assert(noEvRes.status === 201, 'Should create registration successfully');
    const noEvReg = noEvRes.data.application;
    createdAppIds.push(noEvReg._id);

    const noEvNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${noEvReg._id}:event`,
    });
    assert(!noEvNotif, 'No registration event notification should be created when eventDate is missing');
    console.log('✅ Test 12 passed');

    // ----------------------------------------------------
    // TEST 13: notificationKey is deterministic
    // ----------------------------------------------------
    console.log('\n--- Test 13: notificationKey is deterministic ---');
    assert(deadlineNotif.notificationKey === `application:${appA._id}:deadline`, 'Application deadline key format');
    assert(regEventNotif.notificationKey === `registration:${regA._id}:event`, 'Registration event key format');
    assert(appStatusNotif.notificationKey === `application:${appA._id}:status:interview`, 'Application status key format');
    assert(regStatusNotif.notificationKey === `registration:${regA._id}:status:attended`, 'Registration status key format');
    console.log('✅ Test 13 passed');

    // ----------------------------------------------------
    // TEST 14: Unique userId + notificationKey prevents duplicates
    // ----------------------------------------------------
    console.log('\n--- Test 14: Unique userId + notificationKey prevents duplicates ---');
    let duplicateCaught = false;
    try {
      await Notification.create({
        userId: userA._id,
        notificationKey: `application:${appA._id}:deadline`,
        type: 'application_deadline',
        title: 'Duplicate attempt',
        message: 'Should fail with E11000',
      });
    } catch (err) {
      if (err.code === 11000) {
        duplicateCaught = true;
      }
    }
    assert(duplicateCaught, 'Direct duplicate insertion must trigger E11000');
    console.log('✅ Test 14 passed');

    // ----------------------------------------------------
    // TEST 15: Duplicate-key race resolves to winning notification
    // ----------------------------------------------------
    console.log('\n--- Test 15: Duplicate-key race resolves to winning notification ---');
    const safeResult = await safeCreateNotification({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
      type: 'application_deadline',
      title: 'Race attempt',
      message: 'Safe create should return existing without throwing',
    });
    assert(safeResult, 'safeCreateNotification must return a notification');
    assert(safeResult._id.toString() === deadlineNotif._id.toString(), 'Must return the existing winner document');
    console.log('✅ Test 15 passed');

    // ----------------------------------------------------
    // TEST 16: User A notifications remain owned by User A
    // ----------------------------------------------------
    console.log('\n--- Test 16: User A notifications remain owned by User A ---');
    const userANotifs = await Notification.find({ userId: userA._id });
    for (const n of userANotifs) {
      assert(n.userId.toString() === userA._id.toString(), 'All User A notifications must belong to User A');
    }
    console.log('✅ Test 16 passed');

    // ----------------------------------------------------
    // TEST 17: User A notification never references User B's entities
    // ----------------------------------------------------
    console.log("\n--- Test 17: User A notification never references User B's entities ---");
    const userBAppRes = await createApplication(userB._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appB = userBAppRes.data.application;
    createdAppIds.push(appB._id);

    const notifsReferencingB = await Notification.find({
      userId: userA._id,
      applicationId: appB._id,
    });
    assert(notifsReferencingB.length === 0, "User A must not have notifications referencing User B's application");

    const userBNotif = await Notification.findOne({
      userId: userB._id,
      notificationKey: `application:${appB._id}:deadline`,
    });
    assert(userBNotif, "User B's own deadline notification must exist");
    assert(userBNotif.userId.toString() === userB._id.toString(), "User B notification belongs to User B");
    createdNotifIds.push(userBNotif._id);
    console.log('✅ Test 17 passed');

    // ----------------------------------------------------
    // TEST 18: Related opportunity/application IDs are correct
    // ----------------------------------------------------
    console.log('\n--- Test 18: Related opportunity/application IDs are correct ---');
    assert(deadlineNotif.opportunityId.toString() === internshipOpp._id.toString(), 'opportunityId matches');
    assert(deadlineNotif.applicationId.toString() === appA._id.toString(), 'applicationId matches');
    assert(regEventNotif.opportunityId.toString() === hackathonOpp._id.toString(), 'opportunityId matches');
    assert(regEventNotif.applicationId.toString() === regA._id.toString(), 'applicationId matches');
    console.log('✅ Test 18 passed');

    // ----------------------------------------------------
    // TEST 19: CalendarEventId linking is correct when generated event exists
    // ----------------------------------------------------
    console.log('\n--- Test 19: CalendarEventId linking is correct when generated event exists ---');
    const deadlineCalEvent = await CalendarEvent.findOne({
      userId: userA._id,
      applicationId: appA._id,
      syncKey: `application:${appA._id}:deadline`,
    });
    assert(deadlineCalEvent, 'Generated deadline calendar event should exist');
    createdEventIds.push(deadlineCalEvent._id);
    assert(
      deadlineNotif.calendarEventId &&
      deadlineNotif.calendarEventId.toString() === deadlineCalEvent._id.toString(),
      'deadlineNotif calendarEventId must link to generated calendar event'
    );

    const regCalEvent = await CalendarEvent.findOne({
      userId: userA._id,
      applicationId: regA._id,
      syncKey: `registration:${regA._id}:event`,
    });
    assert(regCalEvent, 'Generated registration calendar event should exist');
    createdEventIds.push(regCalEvent._id);
    assert(
      regEventNotif.calendarEventId &&
      regEventNotif.calendarEventId.toString() === regCalEvent._id.toString(),
      'regEventNotif calendarEventId must link to generated calendar event'
    );
    console.log('✅ Test 19 passed');

    // ----------------------------------------------------
    // TEST 20: Manual notification is not overwritten
    // ----------------------------------------------------
    console.log('\n--- Test 20: Manual notification is not overwritten ---');
    const manualRes = await createNotification(userA._id, {
      title: 'Manual Alert Title',
      message: 'This is a manual system notification without notificationKey',
      type: 'system',
    });
    assert(manualRes.status === 201, 'Manual notification created');
    const manualDoc = manualRes.data.notification;
    createdNotifIds.push(manualDoc._id);
    assert(!manualDoc.notificationKey, 'Manual notification must have no notificationKey');

    // Run sync / generation again
    await generateNotificationsForApplication(userA._id, appA._id);
    await generateNotificationsForApplication(userA._id, regA._id);

    const manualCheck = await Notification.findById(manualDoc._id);
    assert(manualCheck, 'Manual notification must still exist');
    assert(manualCheck.title === 'Manual Alert Title', 'Manual notification content unchanged');
    assert(!manualCheck.notificationKey, 'Manual notification notificationKey still undefined');

    // Validator check: client cannot supply notificationKey
    const valRes = validateNotificationCreate({
      title: 'Hacked',
      message: 'Attempting to inject notificationKey',
      type: 'system',
      notificationKey: 'custom:key',
    });
    assert(valRes.error && valRes.error.includes('notificationKey'), 'Validator rejects client notificationKey');
    console.log('✅ Test 20 passed');

    // ----------------------------------------------------
    // TEST 21: Deleting Application does not delete Notification
    // ----------------------------------------------------
    console.log('\n--- Test 21: Deleting Application does not delete Notification ---');
    await deleteApplication(userA._id, internshipOpp._id, 'application');

    const appCheck = await Application.findById(appA._id);
    assert(!appCheck, 'Application should be deleted');

    const notifAfterDel = await Notification.findById(deadlineNotif._id);
    assert(notifAfterDel, 'Notification must remain preserved after application deletion');
    const statusNotifAfterDel = await Notification.findById(appStatusNotif._id);
    assert(statusNotifAfterDel, 'Status notification must remain preserved after application deletion');
    console.log('✅ Test 21 passed');

    // ----------------------------------------------------
    // TEST 22: No interview notification is created without interviewAt
    // ----------------------------------------------------
    console.log('\n--- Test 22: No interview notification is created without interviewAt ---');
    // Verify that all notifications for userA with 'interview' in key are type 'application_update', never reminder/scheduler
    const interviewNotifs = await Notification.find({
      userId: userA._id,
      notificationKey: /status:interview/,
    });
    for (const n of interviewNotifs) {
      assert(n.type === 'application_update', 'Notification must only be application_update');
      assert(!n.reminderMinutes, 'No reminderMinutes on notification');
    }
    console.log('✅ Test 22 passed');

    // ----------------------------------------------------
    // TEST 23: Cleanup succeeds
    // ----------------------------------------------------
    console.log('\n--- Test 23: Cleanup succeeds ---');
    await Notification.deleteMany({ _id: { $in: createdNotifIds } });
    await Notification.deleteMany({ userId: { $in: createdUserIds } });
    await CalendarEvent.deleteMany({ userId: { $in: createdUserIds } });
    await Application.deleteMany({ userId: { $in: createdUserIds } });
    await Opportunity.deleteMany({ _id: { $in: createdOppIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✅ Test 23 passed: Temporary test data cleaned up');

    console.log('\n🎉 ALL 23 TESTS PASSED SUCCESSFULLY!');
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
