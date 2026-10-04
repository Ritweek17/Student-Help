import mongoose from 'mongoose';

export const TODO_PRIORITIES = ['Low', 'Medium', 'High'];

export const TODO_CATEGORIES = [
  'DSA',
  'Development',
  'Learning',
  'Application',
  'Hackathon',
  'Backend',
  'Project',
  'College',
  'General',
  'Other',
];

const todoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Todo title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    priority: {
      type: String,
      enum: {
        values: TODO_PRIORITIES,
        message: 'Invalid priority level',
      },
      default: 'Medium',
    },
    category: {
      type: String,
      enum: {
        values: TODO_CATEGORIES,
        message: 'Invalid category',
      },
      default: 'General',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user queries
todoSchema.index({ userId: 1, dueDate: 1 });
todoSchema.index({ userId: 1, completed: 1 });
todoSchema.index({ userId: 1, createdAt: -1 });

export const Todo = mongoose.models.Todo || mongoose.model('Todo', todoSchema);
