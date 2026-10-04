import mongoose from 'mongoose';

export const TRACKER_CATEGORIES = [
  'DSA',
  'Development',
  'Project',
  'Open Source',
  'Learning',
  'College',
  'Coding',
  'Application',
  'Other',
];

export const TRACKER_PRIORITIES = ['Low', 'Medium', 'High'];

const trackerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Activity title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: TRACKER_CATEGORIES,
        message: 'Invalid activity category',
      },
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Activity date is required'],
      index: true,
    },
    durationMinutes: {
      type: Number,
      min: [0, 'Duration minutes cannot be negative'],
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: TRACKER_PRIORITIES,
        message: 'Invalid priority level',
      },
      default: 'Medium',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user queries
trackerSchema.index({ userId: 1, date: -1 });
trackerSchema.index({ userId: 1, category: 1 });
trackerSchema.index({ userId: 1, completed: 1 });

export const Tracker = mongoose.models.Tracker || mongoose.model('Tracker', trackerSchema);
