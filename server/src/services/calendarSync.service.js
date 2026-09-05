import { Application } from '../models/Application.js';
import { Opportunity } from '../models/Opportunity.js';
import { CalendarEvent } from '../models/CalendarEvent.js';

export async function syncRegistrationEvent(userId, application, opportunity) {
  if (application.type !== 'registration' || !opportunity.eventDate) {
    return;
  }

  const syncKey = `registration:${application._id}:event`;
  let eventStatus = 'scheduled';
  if (application.status === 'cancelled') {
    eventStatus = 'cancelled';
  }

  const title = `${opportunity.title} — Registration`;

  const existing = await CalendarEvent.findOne({ userId, syncKey });

  if (existing) {
    // Only modify if source is generated (not manual)
    if (existing.source !== 'manual') {
      existing.title = title;
      existing.type = 'registration';
      existing.startAt = opportunity.eventDate;
      existing.endAt = opportunity.endDate || undefined;
      existing.allDay = false;
      existing.source = 'registration';
      existing.opportunityId = opportunity._id;
      existing.applicationId = application._id;

      // Handle status update: if application is registered, restore scheduled if it was cancelled
      if (application.status === 'registered') {
        existing.status = 'scheduled';
      } else if (application.status === 'cancelled') {
        existing.status = 'cancelled';
      }
      // If status is attended or completed, preserve existing event status historically

      await existing.save();
    }
  } else {
    try {
      await CalendarEvent.create({
        userId,
        opportunityId: opportunity._id,
        applicationId: application._id,
        title,
        type: 'registration',
        startAt: opportunity.eventDate,
        endAt: opportunity.endDate || undefined,
        allDay: false,
        source: 'registration',
        status: eventStatus,
        syncKey,
      });
    } catch (error) {
      if (error.code === 11000) {
        // Race condition: existing record created concurrently
        const raceDoc = await CalendarEvent.findOne({ userId, syncKey });
        if (raceDoc && raceDoc.source !== 'manual') {
          raceDoc.title = title;
          raceDoc.startAt = opportunity.eventDate;
          raceDoc.endAt = opportunity.endDate || undefined;
          if (application.status === 'registered') {
            raceDoc.status = 'scheduled';
          } else if (application.status === 'cancelled') {
            raceDoc.status = 'cancelled';
          }
          await raceDoc.save();
        }
      } else {
        throw error;
      }
    }
  }
}

export async function syncDeadlineEvent(userId, application, opportunity) {
  const syncKey = `${application.type}:${application._id}:deadline`;
  const prefix = application.type === 'registration' ? 'Registration deadline' : 'Application deadline';
  const title = `${prefix} — ${opportunity.title}`;
  const source = application.type;

  const existing = await CalendarEvent.findOne({ userId, syncKey });

  if (opportunity.deadline) {
    if (existing) {
      if (existing.source !== 'manual') {
        existing.title = title;
        existing.type = 'deadline';
        existing.startAt = opportunity.deadline;
        existing.allDay = true;
        existing.source = source;
        existing.opportunityId = opportunity._id;
        existing.applicationId = application._id;
        existing.status = 'scheduled';
        await existing.save();
      }
    } else {
      try {
        await CalendarEvent.create({
          userId,
          opportunityId: opportunity._id,
          applicationId: application._id,
          title,
          type: 'deadline',
          startAt: opportunity.deadline,
          allDay: true,
          source,
          status: 'scheduled',
          syncKey,
        });
      } catch (error) {
        if (error.code === 11000) {
          const raceDoc = await CalendarEvent.findOne({ userId, syncKey });
          if (raceDoc && raceDoc.source !== 'manual') {
            raceDoc.title = title;
            raceDoc.startAt = opportunity.deadline;
            raceDoc.status = 'scheduled';
            await raceDoc.save();
          }
        } else {
          throw error;
        }
      }
    }
  } else {
    // Opportunity deadline was removed
    if (existing && existing.source !== 'manual') {
      existing.status = 'cancelled';
      await existing.save();
    }
  }
}

export async function syncApplicationCalendarEvents(userId, applicationId) {
  const application = await Application.findOne({
    _id: applicationId,
    userId,
  }).lean();

  if (!application) {
    return;
  }

  const opportunity = await Opportunity.findById(application.opportunityId).lean();
  if (!opportunity) {
    return;
  }

  await syncRegistrationEvent(userId, application, opportunity);
  await syncDeadlineEvent(userId, application, opportunity);
}

export async function handleApplicationDeletion(userId, applicationId) {
  // Mark generated calendar events linked to this application as cancelled
  // Do NOT hard delete generated events. Do NOT modify source = 'manual' events.
  await CalendarEvent.updateMany(
    {
      userId,
      applicationId,
      source: { $in: ['application', 'registration'] },
    },
    {
      $set: { status: 'cancelled' },
    }
  );
}
