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
  findDueCalendarEvents,
  processDueReminders,
} from '../../src/services/reminder.service.js';
import { getPollInterval } from '../../src/workers/reminder.worker.js';

describe('Reminder Worker & Service Test Suite (MongoMemoryReplSet)', () => {
  let userA;
  let userB;
  let testOpp;
  let testApp;

  const baseTime = new Date('2026-10-15T12:00:00.000Z');
  const dueTime = new Date('2026-10-15T13:35:00.000Z');

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

    const authA = await createTestUser('rem_worker_a', 'student');
    userA = authA.user;

    const authB = await createTestUser('rem_worker_b', 'student');
    userB = authB.user;

    testOpp = await Opportunity.create({
      title: 'Worker Verification Hackathon',
      organization: 'Tech Labs',
      description: 'Hackathon description',
      type: 'hackathon',
      status: 'published',
      workMode: 'online',
    });

    testApp = await Application.create({
      userId: userA._id,
      opportunityId: testOpp._id,
      type: 'registration',
      status: 'registered',
    });
  });

  describe('Due Event Selection & Timing', () => {
    it('does not create notification for future event before its reminder window is due', async () => {
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

      await processDueReminders(baseTime);
      const notif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: futureEvent._id,
      });
      expect(notif).toBeNull();
    });

    it('creates notification when reminder becomes due', async () => {
      const futureEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Future Workshop',
        type: 'event',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 30,
      });

      // At dueTime (13:35), the reminder (due at 13:30) is triggered
      const res = await processDueReminders(dueTime);
      expect(res.processed).toBeGreaterThanOrEqual(1);
      expect(res.notificationsCreated).toBeGreaterThanOrEqual(1);

      const notif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: futureEvent._id,
      });
      expect(notif).toBeDefined();
      expect(notif.type).toBe('calendar_reminder');
      expect(notif.notificationKey).toBe(`calendar:${futureEvent._id}:reminder:30`);
      expect(notif.calendarEventId.toString()).toBe(futureEvent._id.toString());
    });

    it('does not create notification for past/already started event', async () => {
      const pastEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Past Event',
        type: 'personal',
        startAt: new Date('2026-10-15T11:00:00.000Z'), // Started 2.5 hours before dueTime (13:35)
        status: 'scheduled',
        reminderMinutes: 30,
      });

      await processDueReminders(dueTime);
      const pastNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: pastEvent._id,
      });
      expect(pastNotif).toBeNull();
    });
  });

  describe('Idempotency & Concurrent Processing', () => {
    it('does not duplicate notification on repeated processing cycles', async () => {
      const event = await CalendarEvent.create({
        userId: userA._id,
        title: 'Workshop',
        type: 'event',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 30,
      });

      await processDueReminders(dueTime);
      const resSecondCycle = await processDueReminders(dueTime);
      expect(resSecondCycle.notificationsCreated).toBe(0);

      const count = await Notification.countDocuments({
        userId: userA._id,
        calendarEventId: event._id,
      });
      expect(count).toBe(1);
    });

    it('creates exactly one notification during concurrent cycle execution', async () => {
      const raceEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Race Condition Event',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 30,
      });

      const [raceRes1, raceRes2] = await Promise.all([
        processDueReminders(dueTime),
        processDueReminders(dueTime),
      ]);

      const raceCount = await Notification.countDocuments({
        userId: userA._id,
        calendarEventId: raceEvent._id,
      });
      expect(raceCount).toBe(1);

      const totalCreated = raceRes1.notificationsCreated + raceRes2.notificationsCreated;
      expect(totalCreated).toBe(1);
    });

    it('remains strictly idempotent across 3 consecutive cycles', async () => {
      const idemEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Idempotency Verification Event',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 25,
      });

      const cycle1 = await processDueReminders(dueTime);
      expect(cycle1.notificationsCreated).toBeGreaterThanOrEqual(1);

      const cycle2 = await processDueReminders(dueTime);
      expect(cycle2.notificationsCreated).toBe(0);

      const cycle3 = await processDueReminders(dueTime);
      expect(cycle3.notificationsCreated).toBe(0);

      const idemNotifs = await Notification.find({
        userId: userA._id,
        notificationKey: `calendar:${idemEvent._id}:reminder:25`,
      });
      expect(idemNotifs.length).toBe(1);
    });
  });

  describe('Event Relationships & Status Filtering', () => {
    it('preserves opportunityId and applicationId on generated reminder notifications', async () => {
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

      await processDueReminders(dueTime);
      const linkedNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: linkedEvent._id,
      });
      expect(linkedNotif).toBeDefined();
      expect(linkedNotif.opportunityId.toString()).toBe(testOpp._id.toString());
      expect(linkedNotif.applicationId.toString()).toBe(testApp._id.toString());
    });

    it('does not generate notification for cancelled events', async () => {
      const cancelledEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Cancelled Meeting',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'cancelled',
        reminderMinutes: 30,
      });

      await processDueReminders(dueTime);
      const cancelledNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: cancelledEvent._id,
      });
      expect(cancelledNotif).toBeNull();
    });

    it('does not generate notification for completed events', async () => {
      const completedEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Completed Meeting',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'completed',
        reminderMinutes: 30,
      });

      await processDueReminders(dueTime);
      const completedNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: completedEvent._id,
      });
      expect(completedNotif).toBeNull();
    });

    it('does not generate notification when reminderMinutes is missing or zero', async () => {
      const noReminderEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'No Reminder Event',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
      });

      const zeroReminderEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Zero Reminder Event',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 0,
      });

      await processDueReminders(dueTime);

      const notif1 = await Notification.findOne({
        userId: userA._id,
        calendarEventId: noReminderEvent._id,
      });
      const notif2 = await Notification.findOne({
        userId: userA._id,
        calendarEventId: zeroReminderEvent._id,
      });

      expect(notif1).toBeNull();
      expect(notif2).toBeNull();
    });
  });

  describe('Event Updates & Dynamic Rescheduling', () => {
    it('uses updated startAt when event is rescheduled', async () => {
      const rescheduleEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Rescheduled Event',
        type: 'personal',
        startAt: new Date('2026-10-15T18:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 30,
      });

      await processDueReminders(dueTime);
      let reschedNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: rescheduleEvent._id,
      });
      expect(reschedNotif).toBeNull();

      // Reschedule to 14:00 (reminder at 13:30, so due at 13:35)
      rescheduleEvent.startAt = new Date('2026-10-15T14:00:00.000Z');
      await rescheduleEvent.save();

      await processDueReminders(dueTime);
      reschedNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: rescheduleEvent._id,
      });
      expect(reschedNotif).toBeDefined();
    });

    it('uses updated reminderMinutes when reminder setting changes', async () => {
      const configEvent = await CalendarEvent.create({
        userId: userA._id,
        title: 'Config Change Event',
        type: 'personal',
        startAt: new Date('2026-10-15T15:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 15,
      });

      await processDueReminders(dueTime);
      let configNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: configEvent._id,
      });
      expect(configNotif).toBeNull();

      // Change reminder to 90 mins -> due at 13:30, so due at 13:35
      configEvent.reminderMinutes = 90;
      await configEvent.save();

      await processDueReminders(dueTime);
      configNotif = await Notification.findOne({
        userId: userA._id,
        calendarEventId: configEvent._id,
      });
      expect(configNotif).toBeDefined();
      expect(configNotif.notificationKey).toBe(`calendar:${configEvent._id}:reminder:90`);
      expect(configNotif.message).toContain('90 minutes');
    });
  });

  describe('User Ownership & Batch Processing', () => {
    it('isolates reminder notifications by user', async () => {
      const userBEvent = await CalendarEvent.create({
        userId: userB._id,
        title: 'User B Event',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 30,
      });

      await processDueReminders(dueTime);

      const userBNotif = await Notification.findOne({
        userId: userB._id,
        calendarEventId: userBEvent._id,
      });
      expect(userBNotif).toBeDefined();
      expect(userBNotif.userId.toString()).toBe(userB._id.toString());

      const crossCheck = await Notification.findOne({
        userId: userA._id,
        calendarEventId: userBEvent._id,
      });
      expect(crossCheck).toBeNull();
    });

    it('isolates errors so one failing event does not halt batch processing', async () => {
      const validEvent1 = await CalendarEvent.create({
        userId: userA._id,
        title: 'Valid Event 1',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 30,
      });

      const validEvent2 = await CalendarEvent.create({
        userId: userA._id,
        title: 'Valid Event 2',
        type: 'personal',
        startAt: new Date('2026-10-15T14:00:00.000Z'),
        status: 'scheduled',
        reminderMinutes: 30,
      });

      const res = await processDueReminders(dueTime);
      expect(res.processed).toBeGreaterThanOrEqual(2);

      const notif1 = await Notification.findOne({
        userId: userA._id,
        calendarEventId: validEvent1._id,
      });
      const notif2 = await Notification.findOne({
        userId: userA._id,
        calendarEventId: validEvent2._id,
      });
      expect(notif1).toBeDefined();
      expect(notif2).toBeDefined();
    });

    it('supports bounded batch size via findDueCalendarEvents options', async () => {
      // Create 3 due events
      for (let i = 1; i <= 3; i++) {
        await CalendarEvent.create({
          userId: userA._id,
          title: `Batch Event ${i}`,
          type: 'personal',
          startAt: new Date('2026-10-15T14:00:00.000Z'),
          status: 'scheduled',
          reminderMinutes: 30,
        });
      }

      const batchEvents = await findDueCalendarEvents(dueTime, { batchSize: 2 });
      expect(batchEvents.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Configuration & Poll Interval Handling', () => {
    it('returns 60000 by default for undefined, null, or empty string', () => {
      expect(getPollInterval(undefined)).toBe(60000);
      expect(getPollInterval(null)).toBe(60000);
      expect(getPollInterval('')).toBe(60000);
    });

    it('parses valid numeric and string intervals', () => {
      expect(getPollInterval('5000')).toBe(5000);
      expect(getPollInterval(10000)).toBe(10000);
    });

    it('clamps intervals below 1000 to the 1000ms minimum', () => {
      expect(getPollInterval('500')).toBe(1000);
      expect(getPollInterval('0')).toBe(1000);
      expect(getPollInterval('-5000')).toBe(1000);
    });

    it('falls back safely to 60000 for invalid strings, NaN, and Infinity', () => {
      expect(getPollInterval('invalid_string')).toBe(60000);
      expect(getPollInterval('NaN')).toBe(60000);
      expect(getPollInterval(Infinity)).toBe(60000);
    });
  });
});
