import mongoose from 'mongoose';

const learningItemSchema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningTrack',
      required: [true, 'Track ID is required'],
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningResource',
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },
    order: {
      type: Number,
      required: [true, 'Order is required'],
    }
  },
  { timestamps: true }
);

learningItemSchema.index({ trackId: 1, order: 1 });

export const LearningItem = mongoose.models.LearningItem || mongoose.model('LearningItem', learningItemSchema);
