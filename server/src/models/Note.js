import mongoose from 'mongoose';

export const NOTE_CATEGORIES = [
  'React',
  'DSA',
  'Backend',
  'AI',
  'Cloud',
  'Career',
  'Interview',
  'General'
];

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
      maxlength: [10000, 'Content cannot exceed 10000 characters'],
    },
    category: {
      type: String,
      enum: {
        values: NOTE_CATEGORIES,
        message: 'Invalid category',
      },
      default: 'General',
    },
    tags: {
      type: [String],
      default: [],
      validate: [
        function (val) {
          return val.length <= 10;
        },
        'Cannot exceed 10 tags',
      ]
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user queries
noteSchema.index({ userId: 1, updatedAt: -1 });
noteSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });

export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
