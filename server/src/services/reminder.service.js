import { CalendarEvent } from '../models/CalendarEvent.js';
import { generateCalendarReminderNotification } from './notificationGeneration.service.js';

/**
 * Find scheduled future calendar events where the reminder time is due.
 *
 * Requirements:
 * - status: 'scheduled'
 * - reminderMinutes: > 0
 * - startAt: > now (strictly future events)
 * - startAt - reminderMinutes <= now
 */
export async function findDueCalendarEvents(now = new Date(), { batchSize = 100 } = {}) {
  const effectiveNow = now instanceof Date ? now : new Date(now);

  return CalendarEvent.find({
    status: 'scheduled',
    reminderMinutes: { $gt: 0 },
    startAt: { $gt: effectiveNow },
    $expr: {
      $lte: [
        { $subtract: ['$startAt', { $multiply: ['$reminderMinutes', 60000] }] },
        effectiveNow,
      ],
    },
  })
    .limit(batchSize)
    .lean();
}

/**
 * Process due reminders up to a bounded batch size.
 *
 * Distinguishes newly created notifications from existing ones.
 * Catches per-event failures to avoid blocking other events.
 *
 * @param {Date|string|number} now - Target timestamp for evaluation
 * @param {Object} options - Configuration options (e.g. batchSize)
 * @returns {Promise<{ processed: number, notificationsCreated: number, errors: Array }>}
 */
export async function processDueReminders(now = new Date(), options = {}) {
  const batchSize = options.batchSize || 100;
  const effectiveNow = now instanceof Date ? now : new Date(now);

  const dueEvents = await findDueCalendarEvents(effectiveNow, { batchSize });

  let processed = 0;
  let notificationsCreated = 0;
  const errors = [];

  for (const event of dueEvents) {
    processed++;
    try {
      const doc = await generateCalendarReminderNotification(event.userId, event);
      if (doc && doc._wasCreated) {
        notificationsCreated++;
      }
    } catch (err) {
      errors.push({
        eventId: event._id,
        message: err.message || 'Error processing calendar reminder',
      });
    }
  }

  return {
    processed,
    notificationsCreated,
    errors,
  };
}
