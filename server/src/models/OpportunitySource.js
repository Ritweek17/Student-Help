import mongoose from 'mongoose';

export const SOURCE_TYPES = ['api', 'rss', 'feed', 'scraper'];

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

const opportunitySourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Source name is required'],
    trim: true,
  },
  slug: {
    type: String,
    required: [true, 'Source slug is required'],
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'],
  },
  type: {
    type: String,
    required: [true, 'Source type is required'],
    enum: {
      values: SOURCE_TYPES,
      message: 'Invalid source type',
    },
  },
  baseUrl: {
    type: String,
    trim: true,
    validate: {
      validator: isValidHttpUrl,
      message: 'Base URL must be a valid HTTP or HTTPS URL',
    },
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true,
  },
  priority: {
    type: Number,
    default: 0,
    min: [0, 'Priority cannot be negative'],
  },
  lastRunAt: {
    type: Date,
  },
  lastSuccessAt: {
    type: Date,
  },
  lastFailureAt: {
    type: Date,
  },
  lastError: {
    type: String,
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Concurrency locking fields (Phase 8B)
  isLocked: {
    type: Boolean,
    default: false,
  },
  lockedAt: {
    type: Date,
    default: null,
  },
  lockedBy: {
    type: String,
    default: null,
    trim: true,
  },
}, {
  timestamps: true,
});

opportunitySourceSchema.index({ slug: 1 }, { unique: true });
opportunitySourceSchema.index({ enabled: 1, priority: -1 });

export const OpportunitySource =
  mongoose.models.OpportunitySource ||
  mongoose.model('OpportunitySource', opportunitySourceSchema);
