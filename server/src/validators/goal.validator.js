import mongoose from 'mongoose';
import { GOAL_CATEGORIES, GOAL_PRIORITIES, GOAL_STATUSES } from '../models/Goal.js';

export function validateGoalId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateGoalCreate(data = {}) {
  const {
    title,
    description,
    category,
    targetValue,
    currentValue,
    unit,
    deadline,
    status,
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
    return { error: 'Goal title is required' };
  }
  if (title.trim().length > 200) {
    return { error: 'Goal title cannot exceed 200 characters' };
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

  let cleanCategory = 'Career';
  if (category !== undefined && category !== null && category !== '') {
    const c = String(category).trim();
    if (!GOAL_CATEGORIES.includes(c)) {
      return { error: `Category must be one of: ${GOAL_CATEGORIES.join(', ')}` };
    }
    cleanCategory = c;
  }

  if (targetValue === undefined || targetValue === null || targetValue === '') {
    return { error: 'Target value is required' };
  }
  const cleanTarget = Number(targetValue);
  if (isNaN(cleanTarget) || cleanTarget <= 0) {
    return { error: 'Target value must be a positive number greater than 0' };
  }

  let cleanCurrent = 0;
  if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
    const num = Number(currentValue);
    if (isNaN(num) || num < 0) {
      return { error: 'Current value cannot be negative' };
    }
    cleanCurrent = num;
  }

  let cleanUnit = 'items';
  if (unit !== undefined && unit !== null && unit !== '') {
    if (typeof unit !== 'string') {
      return { error: 'Unit must be a string' };
    }
    if (unit.trim().length > 50) {
      return { error: 'Unit cannot exceed 50 characters' };
    }
    cleanUnit = unit.trim();
  }

  let cleanDeadline = null;
  if (deadline !== undefined && deadline !== null && deadline !== '') {
    const parsed = new Date(deadline);
    if (isNaN(parsed.getTime())) {
      return { error: 'Invalid deadline date format' };
    }
    cleanDeadline = parsed;
  }

  let cleanStatus = 'active';
  if (status !== undefined && status !== null && status !== '') {
    const s = String(status).trim().toLowerCase();
    if (!GOAL_STATUSES.includes(s)) {
      return { error: `Status must be one of: ${GOAL_STATUSES.join(', ')}` };
    }
    cleanStatus = s;
  } else if (cleanCurrent >= cleanTarget) {
    cleanStatus = 'completed';
  }

  let cleanPriority = 'Medium';
  if (priority !== undefined && priority !== null && priority !== '') {
    const p = String(priority).trim();
    if (!GOAL_PRIORITIES.includes(p)) {
      return { error: `Priority must be one of: ${GOAL_PRIORITIES.join(', ')}` };
    }
    cleanPriority = p;
  }

  return {
    error: null,
    value: {
      title: title.trim(),
      description: cleanDescription,
      category: cleanCategory,
      targetValue: cleanTarget,
      currentValue: cleanCurrent,
      unit: cleanUnit,
      deadline: cleanDeadline,
      status: cleanStatus,
      priority: cleanPriority,
    },
  };
}

export function validateGoalUpdate(data = {}) {
  const {
    title,
    description,
    category,
    targetValue,
    currentValue,
    unit,
    deadline,
    status,
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
      return { error: 'Goal title cannot be empty' };
    }
    if (title.trim().length > 200) {
      return { error: 'Goal title cannot exceed 200 characters' };
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

  let cleanCategory = undefined;
  if (category !== undefined) {
    if (!category || typeof category !== 'string' || !GOAL_CATEGORIES.includes(category.trim())) {
      return { error: `Category must be one of: ${GOAL_CATEGORIES.join(', ')}` };
    }
    cleanCategory = category.trim();
  }

  let cleanTarget = undefined;
  if (targetValue !== undefined) {
    const num = Number(targetValue);
    if (isNaN(num) || num <= 0) {
      return { error: 'Target value must be a positive number greater than 0' };
    }
    cleanTarget = num;
  }

  let cleanCurrent = undefined;
  if (currentValue !== undefined) {
    const num = Number(currentValue);
    if (isNaN(num) || num < 0) {
      return { error: 'Current value cannot be negative' };
    }
    cleanCurrent = num;
  }

  let cleanUnit = undefined;
  if (unit !== undefined) {
    if (unit === null || unit === '') {
      cleanUnit = 'items';
    } else if (typeof unit !== 'string') {
      return { error: 'Unit must be a string' };
    } else if (unit.trim().length > 50) {
      return { error: 'Unit cannot exceed 50 characters' };
    } else {
      cleanUnit = unit.trim();
    }
  }

  let cleanDeadline = undefined;
  if (deadline !== undefined) {
    if (deadline === null || deadline === '') {
      cleanDeadline = null;
    } else {
      const parsed = new Date(deadline);
      if (isNaN(parsed.getTime())) {
        return { error: 'Invalid deadline date format' };
      }
      cleanDeadline = parsed;
    }
  }

  let cleanStatus = undefined;
  if (status !== undefined) {
    if (!status || typeof status !== 'string') {
      return { error: 'Invalid status value' };
    }
    const s = status.trim().toLowerCase();
    if (!GOAL_STATUSES.includes(s)) {
      return { error: `Status must be one of: ${GOAL_STATUSES.join(', ')}` };
    }
    cleanStatus = s;
  }

  let cleanPriority = undefined;
  if (priority !== undefined) {
    if (!priority || typeof priority !== 'string' || !GOAL_PRIORITIES.includes(priority.trim())) {
      return { error: `Priority must be one of: ${GOAL_PRIORITIES.join(', ')}` };
    }
    cleanPriority = priority.trim();
  }

  return {
    error: null,
    value: {
      title: cleanTitle,
      description: cleanDescription,
      category: cleanCategory,
      targetValue: cleanTarget,
      currentValue: cleanCurrent,
      unit: cleanUnit,
      deadline: cleanDeadline,
      status: cleanStatus,
      priority: cleanPriority,
    },
  };
}

export function validateGoalQuery(query = {}) {
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

  let status = undefined;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const s = String(query.status).trim().toLowerCase();
    if (!GOAL_STATUSES.includes(s)) {
      return { error: `Invalid status filter '${s}'` };
    }
    status = s;
  }

  let category = undefined;
  if (query.category !== undefined && query.category !== null && query.category !== '') {
    const c = String(query.category).trim();
    if (!GOAL_CATEGORIES.includes(c)) {
      return { error: `Invalid category filter '${c}'` };
    }
    category = c;
  }

  let priority = undefined;
  if (query.priority !== undefined && query.priority !== null && query.priority !== '') {
    const p = String(query.priority).trim();
    if (!GOAL_PRIORITIES.includes(p)) {
      return { error: `Invalid priority filter '${p}'` };
    }
    priority = p;
  }

  let deadline = undefined;
  if (query.deadline !== undefined && query.deadline !== null && query.deadline !== '') {
    const d = new Date(query.deadline);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid deadline query parameter' };
    }
    deadline = d;
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

  return {
    error: null,
    value: {
      page,
      limit,
      status,
      category,
      priority,
      deadline,
      startDate,
      endDate,
    },
  };
}
