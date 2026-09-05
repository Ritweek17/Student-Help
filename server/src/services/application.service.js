import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Opportunity } from '../models/Opportunity.js';

export async function createApplication(userId, opportunityId, data = {}) {
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

  const { type, status, notes, externalUrl, appliedAt, registeredAt } = data;

  // Check for existing tracking record (Idempotency check)
  const existing = await Application.findOne({
    userId,
    opportunityId,
    type,
  }).lean();

  if (existing) {
    return {
      status: 200,
      data: {
        success: true,
        application: existing,
      },
    };
  }

  // Set default dates
  let finalAppliedAt = appliedAt;
  if (type === 'application' && !finalAppliedAt && status === 'applied') {
    finalAppliedAt = new Date();
  }

  let finalRegisteredAt = registeredAt;
  if (type === 'registration' && !finalRegisteredAt && status === 'registered') {
    finalRegisteredAt = new Date();
  }

  try {
    const doc = await Application.create({
      userId,
      opportunityId,
      type,
      status,
      notes,
      externalUrl,
      appliedAt: finalAppliedAt,
      registeredAt: finalRegisteredAt,
    });

    return {
      status: 201,
      data: {
        success: true,
        application: doc.toObject(),
      },
    };
  } catch (error) {
    // E11000 duplicate key error -> race condition safety
    if (error.code === 11000) {
      const raceExisting = await Application.findOne({
        userId,
        opportunityId,
        type,
      }).lean();
      return {
        status: 200,
        data: {
          success: true,
          application: raceExisting,
        },
      };
    }
    throw error;
  }
}

export async function getApplication(userId, opportunityId, type) {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const oppObjId = new mongoose.Types.ObjectId(opportunityId);

  const pipeline = [
    {
      $match: {
        userId: userObjId,
        opportunityId: oppObjId,
        type,
      },
    },
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

  const results = await Application.aggregate(pipeline);

  if (!results || results.length === 0) {
    // Check if opportunity exists at all or is unpublished
    const opp = await Opportunity.findById(opportunityId).lean();
    if (!opp || opp.status !== 'published') {
      return {
        status: 404,
        message: 'Opportunity not found',
      };
    }
    return {
      status: 404,
      message: 'Application tracking record not found',
    };
  }

  const doc = results[0];
  const opportunity = doc.opportunityDoc;
  delete doc.opportunityDoc;

  return {
    status: 200,
    data: {
      success: true,
      application: {
        ...doc,
        opportunity,
      },
    },
  };
}

export async function listApplications(userId, params = {}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const userObjId = new mongoose.Types.ObjectId(userId);

  const matchStage = { userId: userObjId };
  if (params.type) matchStage.type = params.type;
  if (params.status) matchStage.status = params.status;

  const basePipeline = [
    { $match: matchStage },
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

  // Count total matching published records
  const totalPipeline = [...basePipeline, { $count: 'total' }];
  const totalResult = await Application.aggregate(totalPipeline);
  const total = totalResult[0]?.total || 0;

  // Fetch paginated docs sorted by createdAt descending
  const docsPipeline = [
    ...basePipeline,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const docs = await Application.aggregate(docsPipeline);
  const pages = Math.ceil(total / limit);

  const applications = docs.map((doc) => {
    const opportunity = doc.opportunityDoc;
    const item = { ...doc };
    delete item.opportunityDoc;
    return {
      ...item,
      opportunity,
    };
  });

  return {
    status: 200,
    data: {
      success: true,
      applications,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    },
  };
}

export async function updateApplication(userId, opportunityId, type, data = {}) {
  const appDoc = await Application.findOne({
    userId,
    opportunityId,
    type,
  });

  if (!appDoc) {
    const opp = await Opportunity.findById(opportunityId).lean();
    if (!opp || opp.status !== 'published') {
      return {
        status: 404,
        message: 'Opportunity not found',
      };
    }
    return {
      status: 404,
      message: 'Application tracking record not found',
    };
  }

  if (data.status !== undefined) appDoc.status = data.status;
  if (data.notes !== undefined) appDoc.notes = data.notes;
  if (data.externalUrl !== undefined) appDoc.externalUrl = data.externalUrl;
  if (data.appliedAt !== undefined) appDoc.appliedAt = data.appliedAt;
  if (data.registeredAt !== undefined) appDoc.registeredAt = data.registeredAt;

  await appDoc.save();

  return {
    status: 200,
    data: {
      success: true,
      application: appDoc.toObject(),
    },
  };
}

export async function deleteApplication(userId, opportunityId, type) {
  await Application.deleteOne({
    userId,
    opportunityId,
    type,
  });

  return {
    status: 200,
    data: {
      success: true,
      message: 'Tracking record deleted successfully',
    },
  };
}
