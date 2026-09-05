import mongoose from 'mongoose';

const savedOpportunitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  opportunityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Opportunity',
    required: [true, 'Opportunity ID is required'],
    index: true,
  },
}, {
  timestamps: true,
});

savedOpportunitySchema.index({ userId: 1, opportunityId: 1 }, { unique: true });

export const SavedOpportunity = mongoose.models.SavedOpportunity || mongoose.model('SavedOpportunity', savedOpportunitySchema);
