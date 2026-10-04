import mongoose from 'mongoose';
import { TODO_CATEGORIES, TODO_PRIORITIES } from '../models/Todo.js';

export function validateTodoId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateTodoCreate(data = {}) {
  const {
    title,
    description,
    priority,
    category,
    dueDate,
    completed,
    userId,
    _id,
    createdAt,
    updatedAt,
    completedAt,
  } = data;

  if (userId !== undefined) {
    return { error: 'userId cannot be supplied in request body' };
  }
  if (_id !== undefined) {
    return { error: '_id cannot be supplied in request body' };
  }
  if (createdAt !== undefined || updatedAt !== undefined || completedAt !== undefined) {
    return { error: 'System timestamp fields cannot be supplied in request body' };
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'Todo title is required' };
  }
  if (title.trim().length > 200) {
    return { error: 'Todo title cannot exceed 200 characters' };
  }

  let cleanDescription = '';
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return { error: 'Description must be a string' };
    }
    if (description.trim().length > 2000) {
      return { error: 'Description cannot exceed 2000 characters' };
    }
    cleanDescription = description.trim();
  }

  let cleanPriority = 'Medium';
  if (priority !== undefined && priority !== null && priority !== '') {
    const p = String(priority).trim();
    if (!TODO_PRIORITIES.includes(p)) {
      return { error: `Priority must be one of: ${TODO_PRIORITIES.join(', ')}` };
    }
    cleanPriority = p;
  }

  let cleanCategory = 'General';
  if (category !== undefined && category !== null && category !== '') {
    const c = String(category).trim();
    if (!TODO_CATEGORIES.includes(c)) {
      return { error: `Category must be one of: ${TODO_CATEGORIES.join(', ')}` };
    }
    cleanCategory = c;
  }

  let cleanDueDate = null;
  if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) {
      return { error: 'Invalid due date format' };
    }
    cleanDueDate = parsed;
  }

  return {
    error: null,
    value: {
      title: title.trim(),
      description: cleanDescription,
      priority: cleanPriority,
      category: cleanCategory,
      dueDate: cleanDueDate,
      completed: Boolean(completed),
    },
  };
}

export function validateTodoUpdate(data = {}) {
  const {
    title,
    description,
    priority,
    category,
    dueDate,
    completed,
    userId,
    _id,
    createdAt,
    updatedAt,
    completedAt,
  } = data;

  if (
    userId !== undefined ||
    _id !== undefined ||
    createdAt !== undefined ||
    updatedAt !== undefined ||
    completedAt !== undefined
  ) {
    return { error: 'Immutable or system fields cannot be modified' };
  }

  let cleanTitle = undefined;
  if (title !== undefined) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      return { error: 'Todo title cannot be empty' };
    }
    if (title.trim().length > 200) {
      return { error: 'Todo title cannot exceed 200 characters' };
    }
    cleanTitle = title.trim();
  }

  let cleanDescription = undefined;
  if (description !== undefined) {
    if (description === null) {
      cleanDescription = '';
    } else if (typeof description !== 'string') {
      return { error: 'Description must be a string' };
    } else if (description.trim().length > 2000) {
      return { error: 'Description cannot exceed 2000 characters' };
    } else {
      cleanDescription = description.trim();
    }
  }

  let cleanPriority = undefined;
  if (priority !== undefined) {
    if (!priority || typeof priority !== 'string' || !TODO_PRIORITIES.includes(priority.trim())) {
      return { error: `Priority must be one of: ${TODO_PRIORITIES.join(', ')}` };
    }
    cleanPriority = priority.trim();
  }

  let cleanCategory = undefined;
  if (category !== undefined) {
    if (!category || typeof category !== 'string' || !TODO_CATEGORIES.includes(category.trim())) {
      return { error: `Category must be one of: ${TODO_CATEGORIES.join(', ')}` };
    }
    cleanCategory = category.trim();
  }

  let cleanDueDate = undefined;
  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === '') {
      cleanDueDate = null;
    } else {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        return { error: 'Invalid due date format' };
      }
      cleanDueDate = parsed;
    }
  }

  let cleanCompleted = undefined;
  if (completed !== undefined) {
    cleanCompleted = Boolean(completed);
  }

  return {
    error: null,
    value: {
      title: cleanTitle,
      description: cleanDescription,
      priority: cleanPriority,
      category: cleanCategory,
      dueDate: cleanDueDate,
      completed: cleanCompleted,
    },
  };
}

export function validateTodoQuery(query = {}) {
  let page = 1;
  let limit = 50;

  if (query.page !== undefined) {
    const p = Number(query.page);
    if (isNaN(p) || !Number.isInteger(p) || p < 1) {
      return { error: 'Page must be an integer >= 1' };
    }
    page = p;
  }

  if (query.limit !== undefined) {
    const l = Number(query.limit);
    if (isNaN(l) || !Number.isInteger(l) || l < 1 || l > 100) {
      return { error: 'Limit must be an integer between 1 and 100' };
    }
    limit = l;
  }

  let completed = undefined;
  if (query.completed !== undefined && query.completed !== null && query.completed !== '') {
    if (query.completed === 'true') {
      completed = true;
    } else if (query.completed === 'false') {
      completed = false;
    } else {
      return { error: 'completed must be true or false' };
    }
  }

  let priority = undefined;
  if (query.priority !== undefined && query.priority !== null && query.priority !== '') {
    const p = String(query.priority).trim();
    if (!TODO_PRIORITIES.includes(p)) {
      return { error: `Invalid priority filter '${p}'` };
    }
    priority = p;
  }

  let category = undefined;
  if (query.category !== undefined && query.category !== null && query.category !== '') {
    const c = String(query.category).trim();
    if (!TODO_CATEGORIES.includes(c)) {
      return { error: `Invalid category filter '${c}'` };
    }
    category = c;
  }

  let dueDate = undefined;
  if (query.dueDate !== undefined && query.dueDate !== null && query.dueDate !== '') {
    const d = new Date(query.dueDate);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid dueDate query parameter' };
    }
    dueDate = d;
  }

  let startDate = undefined;
  if (query.startDate !== undefined && query.startDate !== null && query.startDate !== '') {
    const d = new Date(query.startDate);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid startDate query parameter' };
    }
    startDate = d;
  }

  let endDate = undefined;
  if (query.endDate !== undefined && query.endDate !== null && query.endDate !== '') {
    const d = new Date(query.endDate);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid endDate query parameter' };
    }
    endDate = d;
  }

  if (startDate && endDate && endDate < startDate) {
    return { error: 'endDate cannot be before startDate' };
  }

  let status = undefined;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const validStatuses = ['today', 'upcoming', 'overdue', 'completed', 'all'];
    const s = String(query.status).trim().toLowerCase();
    if (!validStatuses.includes(s)) {
      return { error: `status must be one of: ${validStatuses.join(', ')}` };
    }
    status = s;
  }

  return {
    error: null,
    value: {
      page,
      limit,
      completed,
      priority,
      category,
      dueDate,
      startDate,
      endDate,
      status,
    },
  };
}
