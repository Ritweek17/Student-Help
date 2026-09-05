import mongoose from 'mongoose';
import { Opportunity } from '../models/Opportunity.js';
import { SavedOpportunity } from '../models/SavedOpportunity.js';

export async function saveOpportunity(userId, opportunityId) {
  // Check if opportunity exists and is published
  const opportunity = await Opportunity.findOne({
    _id: opportunityId,
    status: 'published',
  }).lean();

  if (!opportunity) {
    return {
      status: 404,
      message: 'Opportunity not found',
    };
  }

  try {
    await SavedOpportunity.create({
      userId,
      opportunityId,
    });
    return {
      status: 201,
      data: {
        success: true,
        saved: true,
        opportunityId,
      },
    };
  } catch (error) {
    // E11000 duplicate key error -> idempotent 200 response
    if (error.code === 11000) {
      return {
        status: 200,
        data: {
          success: true,
          saved: true,
          opportunityId,
        },
      };
    }
    throw error;
  }
}

export async function unsaveOpportunity(userId, opportunityId) {
  await SavedOpportunity.deleteOne({
    userId,
    opportunityId,
  });

  return {
    status: 200,
    data: {
      success: true,
      saved: false,
    },
  };
}

export async function listSavedOpportunities(userId, params = {}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const userObjId = new mongoose.Types.ObjectId(userId);

  const basePipeline = [
    { $match: { userId: userObjId } },
    {
      $lookup: {
        from: 'opportunities',
        localField: 'opportunityId',
        foreignField: '_id',
        as: 'opportunityDoc',
      },
    },
    { $unwind: '$opportunityDoc' },
    { $match: { 'opportunityDoc.status': 'published' } },
  ];

  // Count total published saved opportunities
  const totalPipeline = [...basePipeline, { $count: 'total' }];
  const totalResult = await SavedOpportunity.aggregate(totalPipeline);
  const total = totalResult[0]?.total || 0;

  // Fetch paginated docs sorted by savedAt (createdAt) descending
  const docsPipeline = [
    ...basePipeline,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        opportunity: '$opportunityDoc',
      },
    },
  ];

  const docs = await SavedOpportunity.aggregate(docsPipeline);
  const pages = Math.ceil(total / limit);

  const savedOpportunities = docs.map((doc) => ({
    savedAt: doc.createdAt,
    opportunity: doc.opportunity,
  }));

  return {
    savedOpportunities,
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  };
}

export async function isOpportunitySaved(userId, opportunityId) {
  if (!userId || !opportunityId) return false;
  const record = await SavedOpportunity.findOne({
    userId,
    opportunityId,
  }).lean();

  return Boolean(record);
}
