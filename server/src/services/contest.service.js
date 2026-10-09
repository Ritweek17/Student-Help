import { Contest } from '../models/Contest.js';

function notFoundError() {
  const error = new Error('Contest not found');
  error.statusCode = 404;
  return error;
}

export async function listContests(params = {}) {
  const query = {};
  if (params.platform && params.platform !== 'All') {
    query.platform = params.platform;
  }

  const limit = params.limit || 20;
  const skip = ((params.page || 1) - 1) * limit;

  const [contests, total] = await Promise.all([
    Contest.find(query).sort({ eventDate: 1 }).skip(skip).limit(limit),
    Contest.countDocuments(query),
  ]);

  return {
    contests,
    pagination: {
      total,
      page: params.page || 1,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getContest(contestId) {
  const contest = await Contest.findById(contestId);
  if (!contest) {
    throw notFoundError();
  }
  return contest;
}
