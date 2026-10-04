import mongoose from 'mongoose';
import { TRACKER_CATEGORIES, TRACKER_PRIORITIES } from '../models/Tracker.js';

export function validateTrackerId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateTrackerCreate(data = {}) {
  const {
    title,
    category,
    date,
    durationMinutes,
    notes,
    completed,
    priority,
    userId,
    _id,
    createdAt,
    updatedAt,
  } = data;

  if (userId !== undefined) {
    return { error: 'userId cannot be supplied in request body' };
  }
  if (_id !== undefined) {
    return { error: '_id cannot be supplied in request body' };
  }
  if (createdAt !== undefined || updatedAt !== undefined) {
    return { error: 'Timestamps cannot be supplied in request body' };
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'Activity title is required' };
  }

  if (!category || typeof category !== 'string' || !TRACKER_CATEGORIES.includes(category.trim())) {
    return { error: `Category must be one of: ${TRACKER_CATEGORIES.join(', ')}` };
  }

  if (!date) {
    return { error: 'Activity date is required' };
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return { error: 'Invalid date format' };
  }

  let cleanDuration = 0;
  if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== '') {
    const num = Number(durationMinutes);
    if (isNaN(num) || num < 0) {
      return { error: 'durationMinutes must be a non-negative number' };
    }
    cleanDuration = Math.round(num);
  }

  let cleanPriority = 'Medium';
  if (priority !== undefined && priority !== null && priority !== '') {
    const p = String(priority).trim();
    if (!TRACKER_PRIORITIES.includes(p)) {
      return { error: `Priority must be one of: ${TRACKER_PRIORITIES.join(', ')}` };
    }
    cleanPriority = p;
  }

  return {
    error: null,
    value: {
      title: title.trim(),
      category: category.trim(),
      date: parsedDate,
      durationMinutes: cleanDuration,
      notes: notes !== undefined && notes !== null ? String(notes).trim() : undefined,
      completed: Boolean(completed),
      priority: cleanPriority,
    },
  };
}

export function validateTrackerUpdate(data = {}) {
  const {
    title,
    category,
    date,
    durationMinutes,
    notes,
    completed,
    priority,
    userId,
    _id,
    createdAt,
    updatedAt,
  } = data;

  if (userId !== undefined || _id !== undefined || createdAt !== undefined || updatedAt !== undefined) {
    return { error: 'Immutable fields (userId, _id, timestamps) cannot be modified' };
  }

  let cleanTitle = undefined;
  if (title !== undefined) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      return { error: 'Activity title cannot be empty' };
    }
    cleanTitle = title.trim();
  }

  let cleanCategory = undefined;
  if (category !== undefined) {
    if (!category || typeof category !== 'string' || !TRACKER_CATEGORIES.includes(category.trim())) {
      return { error: `Category must be one of: ${TRACKER_CATEGORIES.join(', ')}` };
    }
    cleanCategory = category.trim();
  }

  let parsedDate = undefined;
  if (date !== undefined) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid date format' };
    }
    parsedDate = d;
  }

  let cleanDuration = undefined;
  if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== '') {
    const num = Number(durationMinutes);
    if (isNaN(num) || num < 0) {
      return { error: 'durationMinutes must be a non-negative number' };
    }
    cleanDuration = Math.round(num);
  }

  let cleanPriority = undefined;
  if (priority !== undefined && priority !== null && priority !== '') {
    const p = String(priority).trim();
    if (!TRACKER_PRIORITIES.includes(p)) {
      return { error: `Priority must be one of: ${TRACKER_PRIORITIES.join(', ')}` };
    }
    cleanPriority = p;
  }

  return {
    error: null,
    value: {
      title: cleanTitle,
      category: cleanCategory,
      date: parsedDate,
      durationMinutes: cleanDuration,
      notes: notes !== undefined && notes !== null ? String(notes).trim() : undefined,
      completed: completed !== undefined ? Boolean(completed) : undefined,
      priority: cleanPriority,
    },
  };
}

export function validateTrackerQuery(query = {}) {
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

  let dateFilter = undefined;
  if (query.date !== undefined && query.date !== null && query.date !== '') {
    const d = new Date(query.date);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid date query parameter' };
    }
    dateFilter = d;
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

  let category = undefined;
  if (query.category !== undefined && query.category !== null && query.category !== '') {
    const c = String(query.category).trim();
    if (!TRACKER_CATEGORIES.includes(c)) {
      return { error: `Invalid category filter '${c}'` };
    }
    category = c;
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

  return {
    error: null,
    value: {
      page,
      limit,
      date: dateFilter,
      startDate,
      endDate,
      category,
      completed,
    },
  };
}
