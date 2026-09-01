import mongoose from 'mongoose';

function isValidUrl(value) {
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

const urlField = {
  type: String,
  trim: true,
  validate: {
    validator: isValidUrl,
    message: 'URL must be a valid HTTP or HTTPS URL',
  },
};

export const OPPORTUNITY_TYPES = [
  'internship',
  'hackathon',
  'workshop',
  'meetup',
  'conference',
  'expo',
  'open_source',
  'competition',
  'fellowship',
  'scholarship',
  'tech_talk',
  'student_program',
];

export const WORK_MODES = ['remote', 'onsite', 'hybrid', 'online'];
export const OPPORTUNITY_STATUSES = ['draft', 'published', 'expired', 'archived'];

const opportunitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Opportunity title is required'],
    trim: true,
    index: true,
  },
  organization: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    index: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  shortDescription: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Opportunity type is required'],
    enum: {
      values: OPPORTUNITY_TYPES,
      message: 'Invalid opportunity type',
    },
    index: true,
  },
  eligibility: {
    minAge: {
      type: Number,
      min: [0, 'Minimum age cannot be negative'],
    },
    maxAge: {
      type: Number,
      min: [0, 'Maximum age cannot be negative'],
    },
    educationLevels: [{ type: String, trim: true }],
    branches: [{ type: String, trim: true }],
    graduationYears: [{ type: Number }],
    locations: [{ type: String, trim: true }],
  },
  skills: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  tags: [{
    type: String,
    trim: true,
  }],
  location: {
    country: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
  },
  workMode: {
    type: String,
    enum: {
      values: WORK_MODES,
      message: 'Invalid work mode',
    },
  },
  stipend: {
    amount: {
      type: Number,
      min: [0, 'Stipend amount cannot be negative'],
    },
    currency: { type: String, trim: true },
    period: { type: String, trim: true },
  },
  prize: {
    amount: {
      type: Number,
      min: [0, 'Prize amount cannot be negative'],
    },
    currency: { type: String, trim: true },
  },
  applicationUrl: urlField,
  registrationUrl: urlField,
  organizationLogo: urlField,
  organizationWebsite: urlField,
  deadline: {
    type: Date,
    index: true,
  },
  eventDate: {
    type: Date,
    index: true,
  },
  endDate: {
    type: Date,
    validate: {
      validator: function (value) {
        if (!value || !this.eventDate) {
          return true;
        }
        return value >= this.eventDate;
      },
      message: 'End date must be greater than or equal to event date',
    },
  },
  duration: {
    type: String,
    trim: true,
  },
  source: {
    name: { type: String, trim: true },
    url: urlField,
  },
  sourceId: {
    type: String,
    trim: true,
  },
  sourceType: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: {
      values: OPPORTUNITY_STATUSES,
      message: 'Invalid opportunity status',
    },
    default: 'draft',
    index: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  featured: {
    type: Boolean,
    default: false,
    index: true,
  },
}, {
  timestamps: true,
});

opportunitySchema.index({ status: 1, deadline: 1 });

export const Opportunity = mongoose.models.Opportunity || mongoose.model('Opportunity', opportunitySchema);
