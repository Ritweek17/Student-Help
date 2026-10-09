import mongoose from 'mongoose';

export const LEARNING_STATUSES = ['Not Started', 'Learning', 'Completed', 'Practiced', 'Mastered'];

const userLearningProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningTrack',
      required: [true, 'Track ID is required'],
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningItem',
      required: [true, 'Item ID is required'],
    },
    status: {
      type: String,
      enum: {
        values: LEARNING_STATUSES,
        message: 'Invalid learning status',
      },
      default: 'Not Started',
    },
  },
  { timestamps: true }
);

userLearningProgressSchema.index({ userId: 1, itemId: 1 }, { unique: true });
userLearningProgressSchema.index({ userId: 1, trackId: 1 });

export const UserLearningProgress = mongoose.models.UserLearningProgress || mongoose.model('UserLearningProgress', userLearningProgressSchema);
