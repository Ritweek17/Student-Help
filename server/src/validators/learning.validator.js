import mongoose from 'mongoose';
import { LEARNING_STATUSES } from '../models/UserLearningProgress.js';

export function validateObjectId(id, fieldName = 'ID') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    console.error(`validateObjectId failed for ${fieldName}:`, id);
    const error = new Error(`Invalid ${fieldName} format`);
    error.statusCode = 400;
    throw error;
  }
  return id;
}

export function validateProgressUpdate(data) {
  const { itemId, trackId, status } = data;

  validateObjectId(itemId, 'Item ID');
  validateObjectId(trackId, 'Track ID');

  if (!status || !LEARNING_STATUSES.includes(status)) {
    const error = new Error('Invalid learning status');
    error.statusCode = 400;
    throw error;
  }

  return { itemId, trackId, status };
}
