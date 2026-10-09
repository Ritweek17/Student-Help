import mongoose from 'mongoose';

const learningResourceSchema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningTrack',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      trim: true,
    },
    provider: {
      type: String,
      trim: true,
    },
    author: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true,
    },
    itemCount: {
      type: Number,
    },
    description: {
      type: String,
      trim: true,
    }
  },
  { timestamps: true }
);

export const LearningResource = mongoose.models.LearningResource || mongoose.model('LearningResource', learningResourceSchema);
