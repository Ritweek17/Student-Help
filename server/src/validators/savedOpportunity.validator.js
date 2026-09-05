import mongoose from 'mongoose';

export function validateOpportunityId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateSavedQuery(query = {}) {
  let page = 1;
  let limit = 20;

  if (query.page !== undefined) {
    const parsedPage = Number(query.page);
    if (isNaN(parsedPage) || !Number.isInteger(parsedPage) || parsedPage < 1) {
      return { error: 'Page must be an integer greater than or equal to 1' };
    }
    page = parsedPage;
  }

  if (query.limit !== undefined) {
    const parsedLimit = Number(query.limit);
    if (isNaN(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return { error: 'Limit must be an integer between 1 and 50' };
    }
    limit = parsedLimit;
  }

  return {
    error: null,
    value: {
      page,
      limit,
    },
  };
}
