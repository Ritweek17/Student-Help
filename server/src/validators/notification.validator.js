import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../models/Notification.js';

export function validateNotificationId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateNotificationCreate(data = {}) {
  const {
    title,
    message,
    type,
    opportunityId,
    applicationId,
    calendarEventId,
    notificationKey,
    userId,
    readAt,
    dismissedAt,
  } = data;

  if (notificationKey !== undefined) {
    return { error: 'notificationKey cannot be supplied in request body' };
  }

  if (userId !== undefined) {
    return { error: 'userId cannot be supplied in request body' };
  }

  if (readAt !== undefined) {
    return { error: 'readAt cannot be supplied in request body' };
  }

  if (dismissedAt !== undefined) {
    return { error: 'dismissedAt cannot be supplied in request body' };
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'Notification title is required' };
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return { error: 'Notification message is required' };
  }

  if (!type || typeof type !== 'string' || !NOTIFICATION_TYPES.includes(type.trim())) {
    return { error: `Notification type must be one of: ${NOTIFICATION_TYPES.join(', ')}` };
  }

  if (opportunityId && !validateNotificationId(opportunityId)) {
    return { error: 'Invalid opportunityId format' };
  }

  if (applicationId && !validateNotificationId(applicationId)) {
    return { error: 'Invalid applicationId format' };
  }

  if (calendarEventId && !validateNotificationId(calendarEventId)) {
    return { error: 'Invalid calendarEventId format' };
  }

  return {
    error: null,
    value: {
      title: title.trim(),
      message: message.trim(),
      type: type.trim(),
      opportunityId: opportunityId ? String(opportunityId).trim() : undefined,
      applicationId: applicationId ? String(applicationId).trim() : undefined,
      calendarEventId: calendarEventId ? String(calendarEventId).trim() : undefined,
    },
  };
}

export function validateNotificationQuery(query = {}) {
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

  let readFilter = undefined;
  if (query.read !== undefined && query.read !== null && query.read !== '') {
    if (query.read === 'true') {
      readFilter = true;
    } else if (query.read === 'false') {
      readFilter = false;
    } else {
      return { error: 'Read filter must be true or false' };
    }
  }

  let dismissedFilter = false; // Default feed hides dismissed notifications unless specified
  if (query.dismissed !== undefined && query.dismissed !== null && query.dismissed !== '') {
    if (query.dismissed === 'true') {
      dismissedFilter = true;
    } else if (query.dismissed === 'false') {
      dismissedFilter = false;
    } else {
      return { error: 'Dismissed filter must be true or false' };
    }
  }

  let typeFilter = undefined;
  if (query.type !== undefined && query.type !== null && query.type !== '') {
    const types = String(query.type)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    for (const t of types) {
      if (!NOTIFICATION_TYPES.includes(t)) {
        return { error: `Invalid notification type '${t}'` };
      }
    }
    typeFilter = types.length === 1 ? types[0] : types;
  }

  return {
    error: null,
    value: {
      page,
      limit,
      read: readFilter,
      dismissed: dismissedFilter,
      type: typeFilter,
    },
  };
}
