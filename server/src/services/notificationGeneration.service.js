import { Notification } from '../models/Notification.js';
import { Application } from '../models/Application.js';
import { Opportunity } from '../models/Opportunity.js';
import { CalendarEvent } from '../models/CalendarEvent.js';

function formatStatus(status) {
  if (!status || typeof status !== 'string') return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Idempotently create or retrieve a notification identified by userId + notificationKey.
 * Handles duplicate-key races (E11000) safely without throwing.
 */
export async function safeCreateNotification({
  userId,
  notificationKey,
  type,
  title,
  message,
  opportunityId,
  applicationId,
  calendarEventId,
}) {
  const existing = await Notification.findOne({ userId, notificationKey });
  if (existing) {
    existing._wasCreated = false;
    return existing;
  }

  try {
    const doc = await Notification.create({
      userId,
      notificationKey,
      type,
      title,
      message,
      opportunityId: opportunityId || undefined,
      applicationId: applicationId || undefined,
      calendarEventId: calendarEventId || undefined,
      read: false,
      dismissed: false,
    });
    doc._wasCreated = true;
    return doc;
  } catch (error) {
    if (error.code === 11000) {
      const raceDoc = await Notification.findOne({ userId, notificationKey });
      if (raceDoc) {
        raceDoc._wasCreated = false;
        return raceDoc;
      }
    }
    throw error;
  }
}

/**
 * Generate an application deadline notification for application tracking records.
 */
export async function generateApplicationDeadlineNotification(userId, application, opportunity) {
  if (application.type !== 'application' || !opportunity.deadline) {
    return null;
  }

  const notificationKey = `application:${application._id}:deadline`;
  const title = 'Application deadline';
  const message = `Application deadline — ${opportunity.title}`;

  // Link matching generated calendar event if one exists
  const calEvent = await CalendarEvent.findOne({
    userId,
    applicationId: application._id,
    syncKey: `application:${application._id}:deadline`,
  }).lean();

  return safeCreateNotification({
    userId,
    notificationKey,
    type: 'application_deadline',
    title,
    message,
    opportunityId: opportunity._id,
    applicationId: application._id,
    calendarEventId: calEvent?._id,
  });
}

/**
 * Generate a registration event notification for registration tracking records.
 */
export async function generateRegistrationEventNotification(userId, application, opportunity) {
  if (application.type !== 'registration' || !opportunity.eventDate) {
    return null;
  }

  const notificationKey = `registration:${application._id}:event`;
  const title = 'Upcoming registration event';
  const message = `Upcoming registration event — ${opportunity.title}`;

  // Link matching generated calendar event if one exists
  const calEvent = await CalendarEvent.findOne({
    userId,
    applicationId: application._id,
    syncKey: `registration:${application._id}:event`,
  }).lean();

  return safeCreateNotification({
    userId,
    notificationKey,
    type: 'registration_event',
    title,
    message,
    opportunityId: opportunity._id,
    applicationId: application._id,
    calendarEventId: calEvent?._id,
  });
}

/**
 * Generate an application status update notification.
 */
export async function generateApplicationUpdateNotification(
  userId,
  application,
  opportunity,
  newStatus,
  oldStatus
) {
  if (newStatus === oldStatus) {
    return null;
  }

  const notificationKey = `application:${application._id}:status:${newStatus}`;
  const title = 'Application status updated';
  const message = `Your application for ${opportunity.title} is now ${formatStatus(newStatus)}.`;

  return safeCreateNotification({
    userId,
    notificationKey,
    type: 'application_update',
    title,
    message,
    opportunityId: opportunity._id,
    applicationId: application._id,
  });
}

/**
 * Generate a registration status update notification.
 */
export async function generateRegistrationUpdateNotification(
  userId,
  application,
  opportunity,
  newStatus,
  oldStatus
) {
  if (newStatus === oldStatus) {
    return null;
  }

  const notificationKey = `registration:${application._id}:status:${newStatus}`;
  const title = 'Registration status updated';
  const message = `Your registration for ${opportunity.title} is now ${formatStatus(newStatus)}.`;

  return safeCreateNotification({
    userId,
    notificationKey,
    type: 'registration_update',
    title,
    message,
    opportunityId: opportunity._id,
    applicationId: application._id,
  });
}

/**
 * Coordinator: Generate relevant notifications for a newly created or synchronized application record.
 */
export async function generateNotificationsForApplication(userId, applicationId) {
  const application = await Application.findOne({
    _id: applicationId,
    userId,
  }).lean();

  if (!application) {
    return null;
  }

  const opportunity = await Opportunity.findById(application.opportunityId).lean();
  if (!opportunity) {
    return null;
  }

  if (application.type === 'application') {
    if (opportunity.deadline) {
      return generateApplicationDeadlineNotification(userId, application, opportunity);
    }
  } else if (application.type === 'registration') {
    if (opportunity.eventDate) {
      return generateRegistrationEventNotification(userId, application, opportunity);
    }
  }

  return null;
}

/**
 * Coordinator: Generate relevant notifications when an application/registration status changes.
 */
export async function generateNotificationsForApplicationStatusUpdate(
  userId,
  applicationId,
  newStatus,
  oldStatus
) {
  if (!newStatus || newStatus === oldStatus) {
    return null;
  }

  const application = await Application.findOne({
    _id: applicationId,
    userId,
  }).lean();

  if (!application) {
    return null;
  }

  const opportunity = await Opportunity.findById(application.opportunityId).lean();
  if (!opportunity) {
    return null;
  }

  if (application.type === 'application') {
    return generateApplicationUpdateNotification(
      userId,
      application,
      opportunity,
      newStatus,
      oldStatus
    );
  } else if (application.type === 'registration') {
    return generateRegistrationUpdateNotification(
      userId,
      application,
      opportunity,
      newStatus,
      oldStatus
    );
  }

  return null;
}

/**
 * Generate a calendar reminder notification for a due calendar event.
 */
export async function generateCalendarReminderNotification(userId, event) {
  if (!event || !event.reminderMinutes || event.reminderMinutes <= 0 || event.status !== 'scheduled') {
    return null;
  }

  const notificationKey = `calendar:${event._id}:reminder:${event.reminderMinutes}`;
  const title = 'Calendar reminder';
  const message = `${event.title} starts in ${event.reminderMinutes} minutes.`;

  return safeCreateNotification({
    userId,
    notificationKey,
    type: 'calendar_reminder',
    title,
    message,
    opportunityId: event.opportunityId || undefined,
    applicationId: event.applicationId || undefined,
    calendarEventId: event._id,
  });
}
