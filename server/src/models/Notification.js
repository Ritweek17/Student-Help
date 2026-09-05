import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'application_deadline',
  'registration_event',
  'calendar_reminder',
  'opportunity_deadline',
  'application_update',
  'registration_update',
  'system',
];

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: {
      values: NOTIFICATION_TYPES,
      message: 'Invalid notification type',
    },
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
  },
  dismissed: {
    type: Boolean,
    default: false,
    index: true,
  },
  dismissedAt: {
    type: Date,
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
  calendarEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarEvent',
    index: true,
  },
  notificationKey: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, dismissed: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index(
  { userId: 1, notificationKey: 1 },
  {
    unique: true,
    partialFilterExpression: { notificationKey: { $type: 'string' } },
  }
);

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
