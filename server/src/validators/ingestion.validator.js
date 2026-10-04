import { SOURCE_TYPES } from '../models/OpportunitySource.js';
import { INGESTION_RUN_STATUSES } from '../models/OpportunityIngestionRun.js';

function containsMongoOperator(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) return true;
    if (typeof obj[key] === 'object' && containsMongoOperator(obj[key])) {
      return true;
    }
  }
  return false;
}

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate OpportunitySource input data.
 */
export function validateOpportunitySource(data = {}) {
  if (containsMongoOperator(data)) {
    return { error: 'Invalid input: Mongo query operators are not permitted' };
  }

  const { name, slug, type, baseUrl, enabled, priority, metadata } = data;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return { error: 'Source name is required and must be a non-empty string' };
  }

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    return { error: 'Source slug is required and must be a non-empty string' };
  }

  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
    return { error: 'Source slug must contain only lowercase letters, numbers, and hyphens' };
  }

  if (!type || typeof type !== 'string' || !SOURCE_TYPES.includes(type.trim())) {
    return { error: `Source type must be one of: ${SOURCE_TYPES.join(', ')}` };
  }

  if (baseUrl !== undefined && baseUrl !== null && baseUrl !== '') {
    if (typeof baseUrl !== 'string' || !isValidHttpUrl(baseUrl.trim())) {
      return { error: 'Base URL must be a valid HTTP or HTTPS URL' };
    }
  }

  if (priority !== undefined) {
    const parsedPriority = Number(priority);
    if (!Number.isInteger(parsedPriority) || parsedPriority < 0) {
      return { error: 'Priority must be an integer greater than or equal to 0' };
    }
  }

  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return { error: 'Enabled must be a boolean' };
  }

  if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
    return { error: 'Metadata must be an object' };
  }

  return {
    error: null,
    value: {
      name: name.trim(),
      slug: normalizedSlug,
      type: type.trim(),
      baseUrl: baseUrl ? baseUrl.trim() : undefined,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      priority: priority !== undefined ? Number(priority) : 0,
      metadata: metadata || {},
    },
  };
}

/**
 * Validate run status against allowed enum.
 */
export function validateIngestionRunStatus(status) {
  if (!status || typeof status !== 'string' || !INGESTION_RUN_STATUSES.includes(status.trim())) {
    return { error: `Run status must be one of: ${INGESTION_RUN_STATUSES.join(', ')}` };
  }
  return { error: null, value: status.trim() };
}

/**
 * Validate operational counters.
 */
export function validateIngestionCounters(counters = {}) {
  if (containsMongoOperator(counters)) {
    return { error: 'Invalid input: Mongo query operators are not permitted' };
  }

  const counterFields = [
    'fetchedCount',
    'createdCount',
    'updatedCount',
    'skippedCount',
    'failedCount',
  ];

  const validated = {};
  for (const field of counterFields) {
    if (counters[field] !== undefined) {
      const val = Number(counters[field]);
      if (!Number.isInteger(val) || val < 0) {
        return { error: `${field} must be an integer greater than or equal to 0` };
      }
      validated[field] = val;
    }
  }

  return { error: null, value: validated };
}
