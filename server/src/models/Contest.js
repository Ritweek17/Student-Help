import mongoose from 'mongoose';

export const CONTEST_STATUSES = ['Open', 'Upcoming', 'Closed'];

const contestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Contest name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    platform: {
      type: String,
      required: [true, 'Platform is required'],
      trim: true,
      maxlength: [50, 'Platform cannot exceed 50 characters'],
    },
    platformLogo: {
      type: String,
      trim: true,
      maxlength: [10, 'Logo must be a short string or emoji'],
    },
    contestUrl: {
      type: String,
      required: [true, 'Contest URL is required'],
      trim: true,
      match: [/^https?:\/\/.+/, 'Valid HTTP/HTTPS URL is required'],
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    duration: {
      type: String,
      required: [true, 'Duration string is required for display'],
      trim: true,
    },
    difficulty: {
      type: String,
      trim: true,
      maxlength: [50, 'Difficulty cannot exceed 50 characters'],
    },
    registrationStatus: {
      type: String,
      enum: {
        values: CONTEST_STATUSES,
        message: 'Invalid registration status',
      },
      default: 'Upcoming',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for querying contests by date and platform
contestSchema.index({ eventDate: 1 });
contestSchema.index({ platform: 1, eventDate: 1 });

export const Contest = mongoose.models.Contest || mongoose.model('Contest', contestSchema);
