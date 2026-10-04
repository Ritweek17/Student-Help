import { Goal } from '../models/Goal.js';

export async function createGoal(userId, data = {}) {
  let status = data.status || 'active';
  if (data.currentValue >= data.targetValue && status === 'active') {
    status = 'completed';
  }

  const doc = await Goal.create({
    userId,
    title: data.title,
    description: data.description || '',
    category: data.category,
    targetValue: data.targetValue,
    currentValue: data.currentValue || 0,
    unit: data.unit || 'items',
    deadline: data.deadline,
    status,
    priority: data.priority,
  });

  return {
    status: 201,
    data: {
      success: true,
      goal: doc.toObject(),
    },
  };
}

export async function getGoal(userId, goalId) {
  const doc = await Goal.findOne({
    _id: goalId,
    userId,
  }).lean();

  if (!doc) {
    return {
      status: 404,
      message: 'Goal not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      goal: doc,
    },
  };
}

export async function listGoals(userId, params = {}) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;

  const query = { userId };

  if (params.status) {
    query.status = params.status;
  }

  if (params.category) {
    query.category = params.category;
  }

  if (params.priority) {
    query.priority = params.priority;
  }

  if (params.deadline) {
    const d = new Date(params.deadline);
    const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    query.deadline = { $gte: startOfDay, $lte: endOfDay };
  } else if (params.startDate || params.endDate) {
    query.deadline = {};
    if (params.startDate) query.deadline.$gte = params.startDate;
    if (params.endDate) query.deadline.$lte = params.endDate;
  }

  const total = await Goal.countDocuments(query);

  const goals = await Goal.find(query)
    .sort({ status: 1, deadline: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  // Compute summary stats across all goals for this user
  const userGoals = await Goal.find({ userId })
    .select('status deadline currentValue targetValue')
    .lean();

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  const totalGoals = userGoals.length;
  const activeGoals = userGoals.filter((g) => g.status === 'active').length;
  const completedGoals = userGoals.filter((g) => g.status === 'completed').length;
  const pausedGoals = userGoals.filter((g) => g.status === 'paused').length;

  const overdueGoals = userGoals.filter((g) => {
    if (g.status !== 'active' || !g.deadline) return false;
    return new Date(g.deadline) < startOfToday;
  }).length;

  let averageProgress = 0;
  if (userGoals.length > 0) {
    const totalProgress = userGoals.reduce((sum, g) => {
      const pct = g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0;
      return sum + Math.min(100, Math.max(0, pct));
    }, 0);
    averageProgress = Math.round((totalProgress / userGoals.length) * 10) / 10;
  }

  return {
    status: 200,
    data: {
      success: true,
      goals,
      summary: {
        total: totalGoals,
        active: activeGoals,
        completed: completedGoals,
        paused: pausedGoals,
        overdue: overdueGoals,
        averageProgress,
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

export async function updateGoal(userId, goalId, data = {}) {
  const doc = await Goal.findOne({
    _id: goalId,
    userId,
  });

  if (!doc) {
    return {
      status: 404,
      message: 'Goal not found',
    };
  }

  if (data.title !== undefined) doc.title = data.title;
  if (data.description !== undefined) doc.description = data.description;
  if (data.category !== undefined) doc.category = data.category;
  if (data.targetValue !== undefined) doc.targetValue = data.targetValue;
  if (data.currentValue !== undefined) doc.currentValue = data.currentValue;
  if (data.unit !== undefined) doc.unit = data.unit;
  if (data.deadline !== undefined) doc.deadline = data.deadline;
  if (data.priority !== undefined) doc.priority = data.priority;

  // Status transitions
  if (data.status !== undefined) {
    doc.status = data.status;
  } else {
    // If currentValue >= targetValue and active, transition to completed
    if (doc.currentValue >= doc.targetValue && doc.status === 'active') {
      doc.status = 'completed';
    } else if (doc.currentValue < doc.targetValue && doc.status === 'completed') {
      doc.status = 'active';
    }
  }

  await doc.save();

  return {
    status: 200,
    data: {
      success: true,
      goal: doc.toObject(),
    },
  };
}

export async function deleteGoal(userId, goalId) {
  const res = await Goal.deleteOne({
    _id: goalId,
    userId,
  });

  if (res.deletedCount === 0) {
    return {
      status: 404,
      message: 'Goal not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      message: 'Goal deleted successfully',
    },
  };
}
