import mongoose from 'mongoose';

export function validateContestId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid Contest ID format');
    error.statusCode = 400;
    throw error;
  }
  return id;
}

export function validateContestQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  const platform = query.platform && typeof query.platform === 'string' ? query.platform.trim() : null;

  return { page, limit, platform };
}
