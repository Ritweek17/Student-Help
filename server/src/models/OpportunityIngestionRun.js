import mongoose from 'mongoose';

export const INGESTION_RUN_STATUSES = ['running', 'completed', 'failed', 'partial'];
export const INGESTION_TRIGGER_TYPES = ['scheduled', 'manual', 'webhook'];

const opportunityIngestionRunSchema = new mongoose.Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OpportunitySource',
    required: [true, 'Source ID is required'],
    index: true,
  },
  status: {
    type: String,
    enum: {
      values: INGESTION_RUN_STATUSES,
      message: 'Invalid run status',
    },
    default: 'running',
    index: true,
  },
  startedAt: {
    type: Date,
    required: [true, 'startedAt is required'],
  },
  completedAt: {
    type: Date,
  },
  fetchedCount: {
    type: Number,
    default: 0,
    min: [0, 'fetchedCount cannot be negative'],
  },
  createdCount: {
    type: Number,
    default: 0,
    min: [0, 'createdCount cannot be negative'],
  },
  updatedCount: {
    type: Number,
    default: 0,
    min: [0, 'updatedCount cannot be negative'],
  },
  skippedCount: {
    type: Number,
    default: 0,
    min: [0, 'skippedCount cannot be negative'],
  },
  failedCount: {
    type: Number,
    default: 0,
    min: [0, 'failedCount cannot be negative'],
  },
  duplicateCount: {
    type: Number,
    default: 0,
    min: [0, 'duplicateCount cannot be negative'],
  },
  invalidCount: {
    type: Number,
    default: 0,
    min: [0, 'invalidCount cannot be negative'],
  },
  durationMs: {
    type: Number,
    default: 0,
    min: [0, 'durationMs cannot be negative'],
  },
  triggeredBy: {
    type: String,
    enum: {
      values: INGESTION_TRIGGER_TYPES,
      message: 'Invalid trigger type',
    },
    default: 'scheduled',
  },
  errorMessage: {
    type: String,
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Enforce completedAt >= startedAt
opportunityIngestionRunSchema.pre('validate', function () {
  if (this.completedAt && this.startedAt && this.completedAt < this.startedAt) {
    this.invalidate('completedAt', 'completedAt cannot be earlier than startedAt');
  }
});

opportunityIngestionRunSchema.index({ sourceId: 1, startedAt: -1 });
opportunityIngestionRunSchema.index({ status: 1, startedAt: -1 });

export const OpportunityIngestionRun =
  mongoose.models.OpportunityIngestionRun ||
  mongoose.model('OpportunityIngestionRun', opportunityIngestionRunSchema);
