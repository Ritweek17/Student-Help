import mongoose from 'mongoose';
import { APPLICATION_TYPES, APPLICATION_STATUSES, REGISTRATION_STATUSES, ALL_TRACKING_STATUSES } from '../models/Application.js';

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function validateOpportunityId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateType(type) {
  if (!type || typeof type !== 'string') {
    return { error: 'Tracking type parameter is required' };
  }
  if (!APPLICATION_TYPES.includes(type.trim())) {
    return { error: `Type must be one of: ${APPLICATION_TYPES.join(', ')}` };
  }
  return { error: null, value: type.trim() };
}

export function validateApplicationCreate(data = {}) {
  const { opportunityId, type, status, notes, externalUrl, appliedAt, registeredAt } = data;

  if (!validateOpportunityId(opportunityId)) {
    return { error: 'Valid opportunity ID is required' };
  }

  if (!type || typeof type !== 'string' || !APPLICATION_TYPES.includes(type.trim())) {
    return { error: `Type is required and must be one of: ${APPLICATION_TYPES.join(', ')}` };
  }

  const cleanType = type.trim();
  let cleanStatus = status ? String(status).trim() : null;

  if (!cleanStatus) {
    cleanStatus = cleanType === 'application' ? 'applied' : 'registered';
  }

  if (cleanType === 'application' && !APPLICATION_STATUSES.includes(cleanStatus)) {
    return { error: `Status '${cleanStatus}' is not valid for application tracking. Allowed: ${APPLICATION_STATUSES.join(', ')}` };
  }

  if (cleanType === 'registration' && !REGISTRATION_STATUSES.includes(cleanStatus)) {
    return { error: `Status '${cleanStatus}' is not valid for registration tracking. Allowed: ${REGISTRATION_STATUSES.join(', ')}` };
  }

  if (externalUrl && !isValidHttpUrl(externalUrl)) {
    return { error: 'externalUrl must be a valid HTTP or HTTPS URL' };
  }

  let parsedAppliedAt = undefined;
  if (appliedAt !== undefined && appliedAt !== null && appliedAt !== '') {
    const d = new Date(appliedAt);
    if (isNaN(d.getTime())) return { error: 'Invalid appliedAt date format' };
    parsedAppliedAt = d;
  }

  let parsedRegisteredAt = undefined;
  if (registeredAt !== undefined && registeredAt !== null && registeredAt !== '') {
    const d = new Date(registeredAt);
    if (isNaN(d.getTime())) return { error: 'Invalid registeredAt date format' };
    parsedRegisteredAt = d;
  }

  return {
    error: null,
    value: {
      opportunityId,
      type: cleanType,
      status: cleanStatus,
      notes: notes !== undefined && notes !== null ? String(notes).trim() : undefined,
      externalUrl: externalUrl !== undefined && externalUrl !== null ? String(externalUrl).trim() : undefined,
      appliedAt: parsedAppliedAt,
      registeredAt: parsedRegisteredAt,
    },
  };
}

export function validateApplicationUpdate(data = {}, currentType) {
  const { status, notes, externalUrl, appliedAt, registeredAt, type, userId, opportunityId, _id } = data;

  if (type !== undefined && type !== currentType) {
    return { error: 'Type is immutable and cannot be modified' };
  }

  if (userId !== undefined || opportunityId !== undefined || _id !== undefined) {
    return { error: 'Ownership fields (userId, opportunityId) are immutable' };
  }

  let cleanStatus = undefined;
  if (status !== undefined && status !== null) {
    cleanStatus = String(status).trim();
    if (currentType === 'application' && !APPLICATION_STATUSES.includes(cleanStatus)) {
      return { error: `Status '${cleanStatus}' is not valid for application tracking. Allowed: ${APPLICATION_STATUSES.join(', ')}` };
    }
    if (currentType === 'registration' && !REGISTRATION_STATUSES.includes(cleanStatus)) {
      return { error: `Status '${cleanStatus}' is not valid for registration tracking. Allowed: ${REGISTRATION_STATUSES.join(', ')}` };
    }
  }

  if (externalUrl && !isValidHttpUrl(externalUrl)) {
    return { error: 'externalUrl must be a valid HTTP or HTTPS URL' };
  }

  let parsedAppliedAt = undefined;
  if (appliedAt !== undefined && appliedAt !== null && appliedAt !== '') {
    const d = new Date(appliedAt);
    if (isNaN(d.getTime())) return { error: 'Invalid appliedAt date format' };
    parsedAppliedAt = d;
  }

  let parsedRegisteredAt = undefined;
  if (registeredAt !== undefined && registeredAt !== null && registeredAt !== '') {
    const d = new Date(registeredAt);
    if (isNaN(d.getTime())) return { error: 'Invalid registeredAt date format' };
    parsedRegisteredAt = d;
  }

  return {
    error: null,
    value: {
      status: cleanStatus,
      notes: notes !== undefined && notes !== null ? String(notes).trim() : undefined,
      externalUrl: externalUrl !== undefined && externalUrl !== null ? String(externalUrl).trim() : undefined,
      appliedAt: parsedAppliedAt,
      registeredAt: parsedRegisteredAt,
    },
  };
}

export function validateApplicationQuery(query = {}) {
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
    if (!APPLICATION_TYPES.includes(cleanType)) {
      return { error: `Type query must be one of: ${APPLICATION_TYPES.join(', ')}` };
    }
    type = cleanType;
  }

  let status = undefined;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const cleanStatus = String(query.status).trim();
    if (!ALL_TRACKING_STATUSES.includes(cleanStatus)) {
      return { error: `Invalid status filter '${cleanStatus}'` };
    }
    status = cleanStatus;
  }

  return {
    error: null,
    value: {
      page,
      limit,
      type,
      status,
    },
  };
}
