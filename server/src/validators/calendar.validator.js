import mongoose from 'mongoose';
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_STATUSES,
  CALENDAR_EVENT_SOURCES,
} from '../models/CalendarEvent.js';

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function validateEventId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateCalendarCreate(data = {}) {
  const {
    title,
    description,
    type,
    startAt,
    endAt,
    allDay,
    location,
    url,
    status,
    reminderMinutes,
    source,
    opportunityId,
    applicationId,
    userId,
  } = data;

  if (userId !== undefined) {
    return { error: 'userId cannot be supplied in request body' };
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'Event title is required' };
  }

  if (!type || typeof type !== 'string' || !CALENDAR_EVENT_TYPES.includes(type.trim())) {
    return { error: `Event type must be one of: ${CALENDAR_EVENT_TYPES.join(', ')}` };
  }

  if (!startAt) {
    return { error: 'Start date/time is required' };
  }

  const parsedStartAt = new Date(startAt);
  if (isNaN(parsedStartAt.getTime())) {
    return { error: 'Invalid startAt date format' };
  }

  let parsedEndAt = undefined;
  if (endAt !== undefined && endAt !== null && endAt !== '') {
    const d = new Date(endAt);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid endAt date format' };
    }
    if (d < parsedStartAt) {
      return { error: 'endAt date cannot be before startAt date' };
    }
    parsedEndAt = d;
  }

  if (url && !isValidHttpUrl(url)) {
    return { error: 'URL must be a valid HTTP or HTTPS URL' };
  }

  let cleanStatus = 'scheduled';
  if (status !== undefined && status !== null && status !== '') {
    const s = String(status).trim();
    if (!CALENDAR_EVENT_STATUSES.includes(s)) {
      return { error: `Status must be one of: ${CALENDAR_EVENT_STATUSES.join(', ')}` };
    }
    cleanStatus = s;
  }

  let cleanSource = 'manual';
  if (source !== undefined && source !== null && source !== '') {
    const src = String(source).trim();
    if (!CALENDAR_EVENT_SOURCES.includes(src)) {
      return { error: `Source must be one of: ${CALENDAR_EVENT_SOURCES.join(', ')}` };
    }
    cleanSource = src;
  }

  let parsedReminder = undefined;
  if (reminderMinutes !== undefined && reminderMinutes !== null && reminderMinutes !== '') {
    const rem = Number(reminderMinutes);
    if (isNaN(rem) || rem < 0) {
      return { error: 'reminderMinutes must be a non-negative number' };
    }
    parsedReminder = rem;
  }

  if (opportunityId && !validateEventId(opportunityId)) {
    return { error: 'Invalid opportunityId format' };
  }

  if (applicationId && !validateEventId(applicationId)) {
    return { error: 'Invalid applicationId format' };
  }

  return {
    error: null,
    value: {
      title: title.trim(),
      description: description !== undefined && description !== null ? String(description).trim() : undefined,
      type: type.trim(),
      startAt: parsedStartAt,
      endAt: parsedEndAt,
      allDay: Boolean(allDay),
      location: location !== undefined && location !== null ? String(location).trim() : undefined,
      url: url !== undefined && url !== null ? String(url).trim() : undefined,
      status: cleanStatus,
      reminderMinutes: parsedReminder,
      source: cleanSource,
      opportunityId: opportunityId ? String(opportunityId).trim() : undefined,
      applicationId: applicationId ? String(applicationId).trim() : undefined,
    },
  };
}

export function validateCalendarUpdate(data = {}) {
  const {
    title,
    description,
    type,
    startAt,
    endAt,
    allDay,
    location,
    url,
    status,
    reminderMinutes,
    source,
    opportunityId,
    applicationId,
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
      return { error: 'Event title cannot be empty' };
    }
    cleanTitle = title.trim();
  }

  let cleanType = undefined;
  if (type !== undefined) {
    if (!type || typeof type !== 'string' || !CALENDAR_EVENT_TYPES.includes(type.trim())) {
      return { error: `Event type must be one of: ${CALENDAR_EVENT_TYPES.join(', ')}` };
    }
    cleanType = type.trim();
  }

  let parsedStartAt = undefined;
  if (startAt !== undefined) {
    const d = new Date(startAt);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid startAt date format' };
    }
    parsedStartAt = d;
  }

  let parsedEndAt = undefined;
  if (endAt !== undefined && endAt !== null && endAt !== '') {
    const d = new Date(endAt);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid endAt date format' };
    }
    parsedEndAt = d;
  }

  if (parsedStartAt && parsedEndAt && parsedEndAt < parsedStartAt) {
    return { error: 'endAt date cannot be before startAt date' };
  }

  if (url !== undefined && url !== null && url !== '' && !isValidHttpUrl(url)) {
    return { error: 'URL must be a valid HTTP or HTTPS URL' };
  }

  let cleanStatus = undefined;
  if (status !== undefined && status !== null && status !== '') {
    const s = String(status).trim();
    if (!CALENDAR_EVENT_STATUSES.includes(s)) {
      return { error: `Status must be one of: ${CALENDAR_EVENT_STATUSES.join(', ')}` };
    }
    cleanStatus = s;
  }

  let cleanSource = undefined;
  if (source !== undefined && source !== null && source !== '') {
    const src = String(source).trim();
    if (!CALENDAR_EVENT_SOURCES.includes(src)) {
      return { error: `Source must be one of: ${CALENDAR_EVENT_SOURCES.join(', ')}` };
    }
    cleanSource = src;
  }

  let parsedReminder = undefined;
  if (reminderMinutes !== undefined && reminderMinutes !== null && reminderMinutes !== '') {
    const rem = Number(reminderMinutes);
    if (isNaN(rem) || rem < 0) {
      return { error: 'reminderMinutes must be a non-negative number' };
    }
    parsedReminder = rem;
  }

  if (opportunityId !== undefined && opportunityId !== null && opportunityId !== '' && !validateEventId(opportunityId)) {
    return { error: 'Invalid opportunityId format' };
  }

  if (applicationId !== undefined && applicationId !== null && applicationId !== '' && !validateEventId(applicationId)) {
    return { error: 'Invalid applicationId format' };
  }

  return {
    error: null,
    value: {
      title: cleanTitle,
      description: description !== undefined && description !== null ? String(description).trim() : undefined,
      type: cleanType,
      startAt: parsedStartAt,
      endAt: parsedEndAt,
      allDay: allDay !== undefined ? Boolean(allDay) : undefined,
      location: location !== undefined && location !== null ? String(location).trim() : undefined,
      url: url !== undefined && url !== null ? String(url).trim() : undefined,
      status: cleanStatus,
      reminderMinutes: parsedReminder,
      source: cleanSource,
      opportunityId: opportunityId !== undefined ? (opportunityId ? String(opportunityId).trim() : null) : undefined,
      applicationId: applicationId !== undefined ? (applicationId ? String(applicationId).trim() : null) : undefined,
    },
  };
}

export function validateCalendarQuery(query = {}) {
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

  let type = undefined;
  if (query.type !== undefined && query.type !== null && query.type !== '') {
    const cleanType = String(query.type).trim();
    if (!CALENDAR_EVENT_TYPES.includes(cleanType)) {
      return { error: `Invalid type filter '${cleanType}'` };
    }
    type = cleanType;
  }

  let status = undefined;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const cleanStatus = String(query.status).trim();
    if (!CALENDAR_EVENT_STATUSES.includes(cleanStatus)) {
      return { error: `Invalid status filter '${cleanStatus}'` };
    }
    status = cleanStatus;
  }

  let startBefore = undefined;
  if (query.startBefore !== undefined && query.startBefore !== null && query.startBefore !== '') {
    const d = new Date(query.startBefore);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid startBefore date format' };
    }
    startBefore = d;
  }

  let startAfter = undefined;
  if (query.startAfter !== undefined && query.startAfter !== null && query.startAfter !== '') {
    const d = new Date(query.startAfter);
    if (isNaN(d.getTime())) {
      return { error: 'Invalid startAfter date format' };
    }
    startAfter = d;
  }

  return {
    error: null,
    value: {
      page,
      limit,
      type,
      status,
      startBefore,
      startAfter,
    },
  };
}
