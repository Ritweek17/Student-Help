import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Application } from '../../src/models/Application.js';
import { CalendarEvent } from '../../src/models/CalendarEvent.js';
import { Notification } from '../../src/models/Notification.js';
import {
  createApplication,
  updateApplication,
  deleteApplication,
} from '../../src/services/application.service.js';
import { createNotification } from '../../src/services/notification.service.js';
import {
  safeCreateNotification,
  generateNotificationsForApplication,
  generateNotificationsForApplicationStatusUpdate,
} from '../../src/services/notificationGeneration.service.js';
import { validateNotificationCreate } from '../../src/validators/notification.validator.js';

describe('Notification Generation Service Test Suite (MongoMemoryReplSet)', () => {
  let userA;
  let userB;
  let internshipOpp;
  let hackathonOpp;
  let noDeadlineOpp;
  let noEventOpp;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      Notification.init(),
      CalendarEvent.init(),
      Application.init(),
      Opportunity.init(),
      User.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('notif_gen_a', 'student');
    userA = authA.user;

    const authB = await createTestUser('notif_gen_b', 'student');
    userB = authB.user;

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

    noDeadlineOpp = await Opportunity.create({
      title: 'Gen Open Program No Deadline',
      organization: 'Open Org',
      description: 'No deadline opportunity',
      type: 'fellowship',
      status: 'published',
      workMode: 'online',
    });

    noEventOpp = await Opportunity.create({
      title: 'Gen Workshop No Event Date',
      organization: 'Workshop Org',
      description: 'Registration opportunity without event date',
      type: 'workshop',
      status: 'published',
      workMode: 'online',
    });
  });

  it('generates application deadline notification on application creation', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    expect(appRes.status).toBe(201);
    const appA = appRes.data.application;

    const deadlineNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });
    expect(deadlineNotif).toBeDefined();
    expect(deadlineNotif.type).toBe('application_deadline');
    expect(deadlineNotif.title).toBe('Application deadline');
    expect(deadlineNotif.message).toContain(internshipOpp.title);
  });

  it('does not duplicate deadline notification on repeated generation calls', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

    await generateNotificationsForApplication(userA._id, appA._id);
    await generateNotificationsForApplication(userA._id, appA._id);

    const deadlineNotifCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });
    expect(deadlineNotifCount).toBe(1);
  });

  it('generates registration-event notification on registration application creation', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    expect(regRes.status).toBe(201);
    const regA = regRes.data.application;

    const regEventNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:event`,
    });
    expect(regEventNotif).toBeDefined();
    expect(regEventNotif.type).toBe('registration_event');
    expect(regEventNotif.title).toBe('Upcoming registration event');
    expect(regEventNotif.message).toContain(hackathonOpp.title);
  });

  it('does not duplicate registration event notification on repeated generation calls', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regA = regRes.data.application;

    await generateNotificationsForApplication(userA._id, regA._id);
    await generateNotificationsForApplication(userA._id, regA._id);

    const regEventCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:event`,
    });
    expect(regEventCount).toBe(1);
  });

  it('generates status update notification on application status transition', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

    const updateRes = await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });
    expect(updateRes.status).toBe(200);

    const appStatusNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:status:interview`,
    });
    expect(appStatusNotif).toBeDefined();
    expect(appStatusNotif.type).toBe('application_update');
    expect(appStatusNotif.title).toBe('Application status updated');
    expect(appStatusNotif.message).toContain(internshipOpp.title);
    expect(appStatusNotif.message).toContain('Interview');
  });

  it('does not duplicate notification when status transition is repeated', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });
    await generateNotificationsForApplicationStatusUpdate(userA._id, appA._id, 'interview', 'interview');

    const appStatusCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `application:${appA._id}:status:interview`,
    });
    expect(appStatusCount).toBe(1);
  });

  it('generates status update notification on registration status transition', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regA = regRes.data.application;

    const updateRegRes = await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'attended',
    });
    expect(updateRegRes.status).toBe(200);

    const regStatusNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:status:attended`,
    });
    expect(regStatusNotif).toBeDefined();
    expect(regStatusNotif.type).toBe('registration_update');
    expect(regStatusNotif.title).toBe('Registration status updated');
    expect(regStatusNotif.message).toContain(hackathonOpp.title);
    expect(regStatusNotif.message).toContain('Attended');
  });

  it('does not duplicate notification on repeated registration status update', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regA = regRes.data.application;

    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'attended',
    });
    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'attended',
    });
    await generateNotificationsForApplicationStatusUpdate(userA._id, regA._id, 'attended', 'attended');

    const regStatusCount = await Notification.countDocuments({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:status:attended`,
    });
    expect(regStatusCount).toBe(1);
  });

  it('does not generate notification on notes-only update', async () => {
    await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });

    const notifCountBeforeNotes = await Notification.countDocuments({ userId: userA._id });
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      notes: 'Notes updated without status change',
    });
    const notifCountAfterNotes = await Notification.countDocuments({ userId: userA._id });
    expect(notifCountAfterNotes).toBe(notifCountBeforeNotes);
  });

  it('does not generate notification on externalUrl-only update', async () => {
    await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });

    const notifCountBeforeUrl = await Notification.countDocuments({ userId: userA._id });
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      externalUrl: 'https://example.com/updated-app',
    });
    const notifCountAfterUrl = await Notification.countDocuments({ userId: userA._id });
    expect(notifCountAfterUrl).toBe(notifCountBeforeUrl);
  });

  it('does not generate deadline notification when opportunity has no deadline', async () => {
    const res = await createApplication(userA._id, noDeadlineOpp._id, {
      type: 'application',
      status: 'applied',
    });
    expect(res.status).toBe(201);
    const noDeadApp = res.data.application;

    const noDeadNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${noDeadApp._id}:deadline`,
    });
    expect(noDeadNotif).toBeNull();
  });

  it('does not generate registration event notification when opportunity has no eventDate', async () => {
    const res = await createApplication(userA._id, noEventOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    expect(res.status).toBe(201);
    const noEvReg = res.data.application;

    const noEvNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${noEvReg._id}:event`,
    });
    expect(noEvNotif).toBeNull();
  });

  it('ensures deterministic notificationKey formats across notification types', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regA = regRes.data.application;

    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });
    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'attended',
    });

    const deadlineNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });
    const regEventNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:event`,
    });
    const appStatusNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:status:interview`,
    });
    const regStatusNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `registration:${regA._id}:status:attended`,
    });

    expect(deadlineNotif.notificationKey).toBe(`application:${appA._id}:deadline`);
    expect(regEventNotif.notificationKey).toBe(`registration:${regA._id}:event`);
    expect(appStatusNotif.notificationKey).toBe(`application:${appA._id}:status:interview`);
    expect(regStatusNotif.notificationKey).toBe(`registration:${regA._id}:status:attended`);
  });

  it('prevents direct duplicate creation via compound unique index (E11000)', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

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
    expect(duplicateCaught).toBe(true);
  });

  it('safely handles duplicate-key race in safeCreateNotification and returns winner doc', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

    const existingNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });

    const safeResult = await safeCreateNotification({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
      type: 'application_deadline',
      title: 'Race attempt',
      message: 'Safe create should return existing without throwing',
    });

    expect(safeResult).toBeDefined();
    expect(safeResult._id.toString()).toBe(existingNotif._id.toString());
    expect(safeResult._wasCreated).toBe(false);
  });

  it('maintains strict user ownership and avoids cross-user entity references', async () => {
    await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });

    const userBAppRes = await createApplication(userB._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appB = userBAppRes.data.application;

    // All User A notifications must belong to User A
    const userANotifs = await Notification.find({ userId: userA._id });
    for (const n of userANotifs) {
      expect(n.userId.toString()).toBe(userA._id.toString());
    }

    // User A must not have notifications referencing User B's application
    const notifsReferencingB = await Notification.find({
      userId: userA._id,
      applicationId: appB._id,
    });
    expect(notifsReferencingB.length).toBe(0);

    // User B's own deadline notification belongs to User B
    const userBNotif = await Notification.findOne({
      userId: userB._id,
      notificationKey: `application:${appB._id}:deadline`,
    });
    expect(userBNotif).toBeDefined();
    expect(userBNotif.userId.toString()).toBe(userB._id.toString());
  });

  it('links calendarEventId correctly when generated calendar event exists', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

    const deadlineCalEvent = await CalendarEvent.findOne({
      userId: userA._id,
      applicationId: appA._id,
      syncKey: `application:${appA._id}:deadline`,
    });
    expect(deadlineCalEvent).toBeDefined();

    const deadlineNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });
    expect(deadlineNotif.calendarEventId).toBeDefined();
    expect(deadlineNotif.calendarEventId.toString()).toBe(deadlineCalEvent._id.toString());
  });

  it('preserves manual notifications and forbids client notificationKey injection', async () => {
    const manualRes = await createNotification(userA._id, {
      title: 'Manual Alert Title',
      message: 'This is a manual system notification without notificationKey',
      type: 'system',
    });
    expect(manualRes.status).toBe(201);
    const manualDoc = manualRes.data.notification;
    expect(manualDoc.notificationKey).toBeUndefined();

    // Re-running generation for applications does not alter manual notification
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    await generateNotificationsForApplication(userA._id, appRes.data.application._id);

    const manualCheck = await Notification.findById(manualDoc._id);
    expect(manualCheck).toBeDefined();
    expect(manualCheck.title).toBe('Manual Alert Title');
    expect(manualCheck.notificationKey).toBeUndefined();

    // Client cannot supply notificationKey
    const valRes = validateNotificationCreate({
      title: 'Hacked',
      message: 'Attempting to inject notificationKey',
      type: 'system',
      notificationKey: 'custom:key',
    });
    expect(valRes.error).toContain('notificationKey');
  });

  it('preserves notifications when application tracking record is deleted', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appA = appRes.data.application;

    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });

    const deadlineNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:deadline`,
    });
    const statusNotif = await Notification.findOne({
      userId: userA._id,
      notificationKey: `application:${appA._id}:status:interview`,
    });
    expect(deadlineNotif).toBeDefined();
    expect(statusNotif).toBeDefined();

    // Delete application
    await deleteApplication(userA._id, internshipOpp._id, 'application');
    const appCheck = await Application.findById(appA._id);
    expect(appCheck).toBeNull();

    // Notifications remain preserved
    const deadlineAfter = await Notification.findById(deadlineNotif._id);
    const statusAfter = await Notification.findById(statusNotif._id);
    expect(deadlineAfter).toBeDefined();
    expect(statusAfter).toBeDefined();
  });

  it('creates application_update notification for interview status without reminder fields', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });

    const interviewNotifs = await Notification.find({
      userId: userA._id,
      notificationKey: /status:interview/,
    });
    expect(interviewNotifs.length).toBeGreaterThan(0);
    for (const n of interviewNotifs) {
      expect(n.type).toBe('application_update');
      expect(n.reminderMinutes).toBeUndefined();
    }
  });
});
