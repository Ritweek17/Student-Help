import mongoose from 'mongoose';

function isValidUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

const urlField = {
  type: String,
  trim: true,
  validate: {
    validator: isValidUrl,
    message: 'URL must be a valid HTTP or HTTPS URL',
  },
};

const educationSchema = new mongoose.Schema({
  institution: { type: String, trim: true },
  degree: { type: String, trim: true },
  fieldOfStudy: { type: String, trim: true },
  startYear: { type: Number, min: 1900, max: 2100 },
  endYear: { type: Number, min: 1900, max: 2100 },
  current: { type: Boolean, default: false },
  cgpa: { type: Number, min: 0, max: 10 },
}, { _id: false });

const skillSchema = new mongoose.Schema({
  name: { type: String, trim: true, lowercase: true },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true,
  },
}, { _id: false });

const projectSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  description: { type: String, trim: true },
  technologies: [{ type: String, trim: true }],
  githubUrl: urlField,
  liveUrl: urlField,
  startDate: Date,
  endDate: Date,
}, { _id: false });

const experienceSchema = new mongoose.Schema({
  organization: { type: String, trim: true },
  role: { type: String, trim: true },
  startDate: Date,
  endDate: Date,
  current: { type: Boolean, default: false },
  description: { type: String, trim: true },
}, { _id: false });

const certificationSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  issuer: { type: String, trim: true },
  issueDate: Date,
  credentialUrl: urlField,
}, { _id: false });

const achievementSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  description: { type: String, trim: true },
  date: Date,
  url: urlField,
}, { _id: false });

const documentSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  type: { type: String, enum: ['resume', 'certificate', 'other'], default: 'other' },
  url: urlField,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  personal: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    phone: { type: String, trim: true },
    dateOfBirth: Date,
    gender: { type: String, trim: true },
    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
    },
  },
  education: [educationSchema],
  skills: [skillSchema],
  interests: [{ type: String, trim: true }],
  projects: [projectSchema],
  experience: [experienceSchema],
  certifications: [certificationSchema],
  achievements: [achievementSchema],
  professionalLinks: {
    github: urlField,
    linkedin: urlField,
    portfolio: urlField,
    leetcode: urlField,
    codechef: urlField,
    codeforces: urlField,
  },
  documents: [documentSchema],
  careerPreferences: {
    opportunityTypes: [{ type: String, trim: true }],
    preferredWorkModes: [{ type: String, trim: true }],
    preferredLocations: [{ type: String, trim: true }],
    preferredDomains: [{ type: String, trim: true }],
  },
  careerGoal: {
    title: { type: String, trim: true },
  },
}, {
  timestamps: true,
});

export const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
