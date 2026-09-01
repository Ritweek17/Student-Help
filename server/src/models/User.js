import mongoose from 'mongoose';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    index: true,
    validate: {
      validator: (value) => emailPattern.test(value),
      message: 'Email must be a valid email address',
    },
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student',
  },
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
