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

export const APPLICATION_TYPES = ['application', 'registration'];

export const APPLICATION_STATUSES = [
  'applied',
  'interview',
  'waiting',
  'selected',
  'rejected',
  'withdrawn',
];

export const REGISTRATION_STATUSES = [
  'registered',
  'attended',
  'completed',
  'cancelled',
];

export const ALL_TRACKING_STATUSES = [
  ...APPLICATION_STATUSES,
  ...REGISTRATION_STATUSES,
];

const applicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  opportunityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Opportunity',
    required: [true, 'Opportunity ID is required'],
    index: true,
  },
  type: {
    type: String,
    required: [true, 'Type is required'],
    enum: {
      values: APPLICATION_TYPES,
      message: 'Invalid tracking type',
    },
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ALL_TRACKING_STATUSES,
      message: 'Invalid tracking status',
    },
  },
  appliedAt: {
    type: Date,
  },
  registeredAt: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
  externalUrl: {
    type: String,
    trim: true,
    validate: {
      validator: isValidHttpUrl,
      message: 'URL must be a valid HTTP or HTTPS URL',
    },
  },
}, {
  timestamps: true,
});

// Compound unique index enforcing one tracking record per (userId, opportunityId, type)
applicationSchema.index({ userId: 1, opportunityId: 1, type: 1 }, { unique: true });

// Schema validation ensuring status matches type
applicationSchema.pre('validate', function (next) {
  if (this.type === 'application' && !APPLICATION_STATUSES.includes(this.status)) {
    this.invalidate('status', `Status '${this.status}' is not valid for type 'application'`);
  } else if (this.type === 'registration' && !REGISTRATION_STATUSES.includes(this.status)) {
    this.invalidate('status', `Status '${this.status}' is not valid for type 'registration'`);
  }
  next();
});

export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);
