import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Application } from '../../src/models/Application.js';
import { CalendarEvent } from '../../src/models/CalendarEvent.js';
import {
  createApplication,
  updateApplication,
  deleteApplication,
} from '../../src/services/application.service.js';
import { createCalendarEvent } from '../../src/services/calendar.service.js';

describe('Calendar Sync Service Test Suite (MongoMemoryReplSet)', () => {
  let userA;
  let userB;
  let internshipOpp;
  let hackathonOpp;
  let noDeadlineOpp;
  let eventStartDate;
  let eventEndDate;
  let deadlineDate;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
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

    const authA = await createTestUser('cal_sync_a', 'student');
    userA = authA.user;

    const authB = await createTestUser('cal_sync_b', 'student');
    userB = authB.user;

    const now = new Date();
    eventStartDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    eventEndDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    deadlineDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

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

    internshipOpp = await Opportunity.create({
      title: 'Sync Frontend Internship',
      organization: 'Dev Corp',
      description: 'Summer Internship',
      type: 'internship',
      status: 'published',
      deadline: deadlineDate,
      workMode: 'remote',
    });

    noDeadlineOpp = await Opportunity.create({
      title: 'No Deadline Opportunity',
      organization: 'Open Org',
      description: 'Open ended program',
      type: 'fellowship',
      status: 'published',
      workMode: 'online',
    });
  });

  it('creates registration calendar event on registration application creation', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    expect(regRes.status).toBe(201);
    const regApp = regRes.data.application;

    const regEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: regApp._id,
      type: 'registration',
    }).lean();

    expect(regEvents.length).toBe(1);
    const regEvent = regEvents[0];
    expect(new Date(regEvent.startAt).getTime()).toBe(eventStartDate.getTime());
    expect(new Date(regEvent.endAt).getTime()).toBe(eventEndDate.getTime());
    expect(regEvent.source).toBe('registration');
    expect(regEvent.applicationId.toString()).toBe(regApp._id.toString());
    expect(regEvent.opportunityId.toString()).toBe(hackathonOpp._id.toString());
  });

  it('is idempotent on repeated registration creation and updates', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regApp = regRes.data.application;

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
    expect(regEventsAfter.length).toBe(1);
  });

  it('marks calendar event cancelled when registration status changes to cancelled', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regApp = regRes.data.application;

    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'cancelled',
    });

    const cancelledRegEvent = await CalendarEvent.findOne({
      userId: userA._id,
      applicationId: regApp._id,
      type: 'registration',
    }).lean();
    expect(cancelledRegEvent.status).toBe('cancelled');
  });

  it('preserves scheduled status when registration status transitions to completed', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regApp = regRes.data.application;

    await updateApplication(userA._id, hackathonOpp._id, 'registration', {
      status: 'completed',
    });

    const completedRegEvent = await CalendarEvent.findOne({
      userId: userA._id,
      applicationId: regApp._id,
      type: 'registration',
    }).lean();
    expect(completedRegEvent.status).toBe('scheduled');
  });

  it('creates deadline event when application is created for opportunity with deadline', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    expect(appRes.status).toBe(201);
    const appRecord = appRes.data.application;

    const deadlineEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: appRecord._id,
      type: 'deadline',
    }).lean();

    expect(deadlineEvents.length).toBe(1);
    const deadlineEvent = deadlineEvents[0];
    expect(deadlineEvent.source).toBe('application');
    expect(new Date(deadlineEvent.startAt).getTime()).toBe(deadlineDate.getTime());
    expect(deadlineEvent.syncKey).toBe(`application:${appRecord._id}:deadline`);
  });

  it('creates deadline event for registration when opportunity has deadline', async () => {
    const regRes = await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });
    const regApp = regRes.data.application;

    const regDeadlineEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: regApp._id,
      type: 'deadline',
    }).lean();
    expect(regDeadlineEvents.length).toBe(1);
  });

  it('does not duplicate deadline event on application status updates', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appRecord = appRes.data.application;

    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'waiting',
    });

    const deadlineEventsAfter = await CalendarEvent.find({
      userId: userA._id,
      applicationId: appRecord._id,
      type: 'deadline',
    }).lean();
    expect(deadlineEventsAfter.length).toBe(1);
  });

  it('maintains strict user isolation during calendar event sync', async () => {
    await createApplication(userA._id, hackathonOpp._id, {
      type: 'registration',
      status: 'registered',
    });

    const userBEvents = await CalendarEvent.find({ userId: userB._id }).lean();
    expect(userBEvents.length).toBe(0);
  });

  it('protects manual calendar events from being overwritten by sync triggers', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appRecord = appRes.data.application;

    const manualEventRes = await createCalendarEvent(userA._id, {
      title: 'Manual Interview Prep',
      type: 'personal',
      startAt: new Date(),
      source: 'manual',
      applicationId: appRecord._id,
      opportunityId: internshipOpp._id,
    });
    expect(manualEventRes.status).toBe(201);
    const manualEvent = manualEventRes.data.event;

    // Trigger sync on update
    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });

    const refreshedManualEvent = await CalendarEvent.findById(manualEvent._id).lean();
    expect(refreshedManualEvent.title).toBe('Manual Interview Prep');
    expect(refreshedManualEvent.source).toBe('manual');
  });

  it('cancels generated events upon application deletion while keeping manual events intact', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });
    const appRecord = appRes.data.application;

    const manualEventRes = await createCalendarEvent(userA._id, {
      title: 'Manual Prep',
      type: 'personal',
      startAt: new Date(),
      source: 'manual',
      applicationId: appRecord._id,
      opportunityId: internshipOpp._id,
    });
    const manualEvent = manualEventRes.data.event;

    // Delete application
    await deleteApplication(userA._id, internshipOpp._id, 'application');

    const cancelledAppEvents = await CalendarEvent.find({
      userId: userA._id,
      applicationId: appRecord._id,
      source: 'application',
    }).lean();
    expect(cancelledAppEvents.length).toBeGreaterThan(0);
    for (const ev of cancelledAppEvents) {
      expect(ev.status).toBe('cancelled');
    }

    const postDeleteManual = await CalendarEvent.findById(manualEvent._id).lean();
    expect(postDeleteManual).not.toBeNull();
    expect(postDeleteManual.status).not.toBe('cancelled');
  });

  it('does not generate interview event without interviewAt timestamp', async () => {
    const appRes = await createApplication(userA._id, internshipOpp._id, {
      type: 'application',
      status: 'applied',
    });

    await updateApplication(userA._id, internshipOpp._id, 'application', {
      status: 'interview',
    });

    const interviewEvents = await CalendarEvent.find({
      userId: userA._id,
      type: 'interview',
    }).lean();
    expect(interviewEvents.length).toBe(0);
  });
});
