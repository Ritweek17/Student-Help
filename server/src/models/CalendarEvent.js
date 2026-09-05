import mongoose from 'mongoose';

function isValidHttpUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export const CALENDAR_EVENT_TYPES = [
  'personal',
  'deadline',
  'event',
  'interview',
  'application',
  'registration',
  'reminder',
];

export const CALENDAR_EVENT_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
];

export const CALENDAR_EVENT_SOURCES = [
  'manual',
  'opportunity',
  'application',
  'registration',
];

const calendarEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  opportunityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Opportunity',
    index: true,
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: CALENDAR_EVENT_TYPES,
      message: 'Invalid event type',
    },
  },
  startAt: {
    type: Date,
    required: [true, 'Start date/time is required'],
    index: true,
  },
  endAt: {
    type: Date,
    validate: {
      validator: function (value) {
        if (!value || !this.startAt) {
          return true;
        }
        return value >= this.startAt;
      },
      message: 'End date must be greater than or equal to start date',
    },
  },
  allDay: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    trim: true,
  },
  url: {
    type: String,
    trim: true,
    validate: {
      validator: isValidHttpUrl,
      message: 'URL must be a valid HTTP or HTTPS URL',
    },
  },
  status: {
    type: String,
    enum: {
      values: CALENDAR_EVENT_STATUSES,
      message: 'Invalid event status',
    },
    default: 'scheduled',
  },
  reminderMinutes: {
    type: Number,
    min: [0, 'Reminder minutes cannot be negative'],
  },
  source: {
    type: String,
    enum: {
      values: CALENDAR_EVENT_SOURCES,
      message: 'Invalid event source',
    },
    default: 'manual',
  },
  syncKey: {
    type: String,
    trim: true,
    index: true,
  },
}, {
  timestamps: true,
});

calendarEventSchema.index({ userId: 1, startAt: 1 });
calendarEventSchema.index({ userId: 1, opportunityId: 1 });
calendarEventSchema.index({ userId: 1, applicationId: 1 });
calendarEventSchema.index(
  { userId: 1, syncKey: 1 },
  { unique: true, partialFilterExpression: { syncKey: { $type: 'string' } } }
);

export const CalendarEvent = mongoose.models.CalendarEvent || mongoose.model('CalendarEvent', calendarEventSchema);
