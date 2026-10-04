import mongoose from 'mongoose';

export const GOAL_CATEGORIES = [
  'DSA',
  'Development',
  'Project',
  'Learning',
  'Career',
  'Open Source',
  'Placement',
  'Other',
];

export const GOAL_STATUSES = ['active', 'completed', 'paused', 'cancelled'];

export const GOAL_PRIORITIES = ['Low', 'Medium', 'High'];

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Goal title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    category: {
      type: String,
      enum: {
        values: GOAL_CATEGORIES,
        message: 'Invalid goal category',
      },
      default: 'Career',
      index: true,
    },
    targetValue: {
      type: Number,
      required: [true, 'Target value is required'],
      min: [1, 'Target value must be at least 1'],
    },
    currentValue: {
      type: Number,
      default: 0,
      min: [0, 'Current value cannot be negative'],
    },
    unit: {
      type: String,
      trim: true,
      maxlength: [50, 'Unit cannot exceed 50 characters'],
      default: 'items',
    },
    deadline: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: GOAL_STATUSES,
        message: 'Invalid goal status',
      },
      default: 'active',
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: GOAL_PRIORITIES,
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
goalSchema.index({ userId: 1, status: 1 });
goalSchema.index({ userId: 1, deadline: 1 });
goalSchema.index({ userId: 1, createdAt: -1 });

export const Goal = mongoose.models.Goal || mongoose.model('Goal', goalSchema);
