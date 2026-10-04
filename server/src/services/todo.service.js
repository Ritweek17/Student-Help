import { Todo } from '../models/Todo.js';

export async function createTodo(userId, data = {}) {
  const completed = Boolean(data.completed);
  const completedAt = completed ? new Date() : null;

  const doc = await Todo.create({
    userId,
    title: data.title,
    description: data.description || '',
    priority: data.priority,
    category: data.category,
    dueDate: data.dueDate,
    completed,
    completedAt,
  });

  return {
    status: 201,
    data: {
      success: true,
      todo: doc.toObject(),
    },
  };
}

export async function getTodo(userId, todoId) {
  const doc = await Todo.findOne({
    _id: todoId,
    userId,
  }).lean();

  if (!doc) {
    return {
      status: 404,
      message: 'Todo not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      todo: doc,
    },
  };
}

export async function listTodos(userId, params = {}) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;

  const query = { userId };

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  if (params.status) {
    if (params.status === 'today') {
      query.completed = false;
      query.dueDate = { $gte: startOfToday, $lte: endOfToday };
    } else if (params.status === 'upcoming') {
      query.completed = false;
      query.dueDate = { $gt: endOfToday };
    } else if (params.status === 'overdue') {
      query.completed = false;
      query.dueDate = { $lt: startOfToday, $ne: null };
    } else if (params.status === 'completed') {
      query.completed = true;
    }
  } else {
    if (params.completed !== undefined) {
      query.completed = params.completed;
    }

    if (params.dueDate) {
      const d = new Date(params.dueDate);
      const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
      query.dueDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (params.startDate || params.endDate) {
      query.dueDate = {};
      if (params.startDate) query.dueDate.$gte = params.startDate;
      if (params.endDate) query.dueDate.$lte = params.endDate;
    }
  }

  if (params.priority) {
    query.priority = params.priority;
  }

  if (params.category) {
    query.category = params.category;
  }

  const total = await Todo.countDocuments(query);

  const todos = await Todo.find(query)
    .sort({ completed: 1, dueDate: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  // Compute summary stats across all todos for this user
  const userTodos = await Todo.find({ userId }).select('completed dueDate').lean();
  const totalCount = userTodos.length;
  const completedCount = userTodos.filter((t) => t.completed).length;
  const pendingCount = totalCount - completedCount;

  const todayCount = userTodos.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= startOfToday && d <= endOfToday;
  }).length;

  const upcomingCount = userTodos.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d > endOfToday;
  }).length;

  const overdueCount = userTodos.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d < startOfToday;
  }).length;

  return {
    status: 200,
    data: {
      success: true,
      todos,
      summary: {
        total: totalCount,
        completed: completedCount,
        pending: pendingCount,
        today: todayCount,
        upcoming: upcomingCount,
        overdue: overdueCount,
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

export async function updateTodo(userId, todoId, data = {}) {
  const doc = await Todo.findOne({
    _id: todoId,
    userId,
  });

  if (!doc) {
    return {
      status: 404,
      message: 'Todo not found',
    };
  }

  if (data.title !== undefined) doc.title = data.title;
  if (data.description !== undefined) doc.description = data.description;
  if (data.priority !== undefined) doc.priority = data.priority;
  if (data.category !== undefined) doc.category = data.category;
  if (data.dueDate !== undefined) doc.dueDate = data.dueDate;

  if (data.completed !== undefined) {
    doc.completed = data.completed;
    doc.completedAt = data.completed ? new Date() : null;
  }

  await doc.save();

  return {
    status: 200,
    data: {
      success: true,
      todo: doc.toObject(),
    },
  };
}

export async function deleteTodo(userId, todoId) {
  const res = await Todo.deleteOne({
    _id: todoId,
    userId,
  });

  if (res.deletedCount === 0) {
    return {
      status: 404,
      message: 'Todo not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      message: 'Todo deleted successfully',
    },
  };
}
