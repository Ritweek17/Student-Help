import { Tracker } from '../models/Tracker.js';

export async function createActivity(userId, data = {}) {
  const doc = await Tracker.create({
    userId,
    title: data.title,
    category: data.category,
    date: data.date,
    durationMinutes: data.durationMinutes,
    notes: data.notes,
    completed: Boolean(data.completed),
    priority: data.priority,
  });

  return {
    status: 201,
    data: {
      success: true,
      activity: doc.toObject(),
    },
  };
}

export async function getActivity(userId, activityId) {
  const doc = await Tracker.findOne({
    _id: activityId,
    userId,
  }).lean();

  if (!doc) {
    return {
      status: 404,
      message: 'Tracker activity not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      activity: doc,
    },
  };
}

export async function listActivities(userId, params = {}) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;

  const query = { userId };

  if (params.date) {
    const d = new Date(params.date);
    const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    query.date = { $gte: startOfDay, $lte: endOfDay };
  } else if (params.startDate || params.endDate) {
    query.date = {};
    if (params.startDate) query.date.$gte = params.startDate;
    if (params.endDate) query.date.$lte = params.endDate;
  }

  if (params.category) {
    query.category = params.category;
  }

  if (params.completed !== undefined) {
    query.completed = params.completed;
  }

  const total = await Tracker.countDocuments(query);

  const activities = await Tracker.find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  // Compute summary stats for current query
  const summaryActivities = await Tracker.find(query).select('durationMinutes completed').lean();
  const totalActivities = summaryActivities.length;
  const completedActivities = summaryActivities.filter((a) => a.completed).length;
  const totalDurationMinutes = summaryActivities
    .filter((a) => a.completed)
    .reduce((sum, a) => sum + (Number(a.durationMinutes) || 0), 0);

  return {
    status: 200,
    data: {
      success: true,
      activities,
      summary: {
        totalActivities,
        completedActivities,
        totalDurationMinutes,
      },
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    },
  };
}

export async function updateActivity(userId, activityId, data = {}) {
  const doc = await Tracker.findOne({
    _id: activityId,
    userId,
  });

  if (!doc) {
    return {
      status: 404,
      message: 'Tracker activity not found',
    };
  }

  if (data.title !== undefined) doc.title = data.title;
  if (data.category !== undefined) doc.category = data.category;
  if (data.date !== undefined) doc.date = data.date;
  if (data.durationMinutes !== undefined) doc.durationMinutes = data.durationMinutes;
  if (data.notes !== undefined) doc.notes = data.notes;
  if (data.completed !== undefined) doc.completed = data.completed;
  if (data.priority !== undefined) doc.priority = data.priority;

  await doc.save();

  return {
    status: 200,
    data: {
      success: true,
      activity: doc.toObject(),
    },
  };
}

export async function deleteActivity(userId, activityId) {
  const res = await Tracker.deleteOne({
    _id: activityId,
    userId,
  });

  if (res.deletedCount === 0) {
    return {
      status: 404,
      message: 'Tracker activity not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      message: 'Activity deleted successfully',
    },
  };
}
