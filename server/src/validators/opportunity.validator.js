import { OPPORTUNITY_TYPES, WORK_MODES } from '../models/Opportunity.js';

export const ALLOWED_SORTS = [
  'deadline_asc',
  'deadline_desc',
  'event_asc',
  'event_desc',
  'newest',
  'oldest',
  'featured',
];

export function validateOpportunityQuery(rawQuery = {}) {
  const errors = [];
  const sanitized = {};

  // 1. Pagination: page
  if (rawQuery.page !== undefined) {
    const pageNum = Number(rawQuery.page);
    if (isNaN(pageNum) || pageNum < 1 || !Number.isInteger(pageNum)) {
      errors.push('Page must be a positive integer greater than or equal to 1');
    } else {
      sanitized.page = pageNum;
    }
  } else {
    sanitized.page = 1;
  }

  // 2. Pagination: limit
  if (rawQuery.limit !== undefined) {
    const limitNum = Number(rawQuery.limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50 || !Number.isInteger(limitNum)) {
      errors.push('Limit must be an integer between 1 and 50');
    } else {
      sanitized.limit = limitNum;
    }
  } else {
    sanitized.limit = 20;
  }

  // 3. Search query: q
  if (rawQuery.q !== undefined) {
    if (typeof rawQuery.q === 'string') {
      sanitized.q = rawQuery.q.trim();
    } else {
      errors.push('Search query q must be a string');
    }
  }

  // 4. Filter: type
  if (rawQuery.type !== undefined) {
    let types = [];
    if (typeof rawQuery.type === 'string') {
      types = rawQuery.type.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    } else if (Array.isArray(rawQuery.type)) {
      types = rawQuery.type.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    }

    const invalidTypes = types.filter((t) => !OPPORTUNITY_TYPES.includes(t));
    if (invalidTypes.length > 0) {
      errors.push(`Invalid opportunity type(s): ${invalidTypes.join(', ')}`);
    } else if (types.length > 0) {
      sanitized.type = types;
    }
  }

  // 5. Filter: workMode
  if (rawQuery.workMode !== undefined) {
    let modes = [];
    if (typeof rawQuery.workMode === 'string') {
      modes = rawQuery.workMode.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
    } else if (Array.isArray(rawQuery.workMode)) {
      modes = rawQuery.workMode.map((m) => String(m).trim().toLowerCase()).filter(Boolean);
    }

    const invalidModes = modes.filter((m) => !WORK_MODES.includes(m));
    if (invalidModes.length > 0) {
      errors.push(`Invalid work mode(s): ${invalidModes.join(', ')}`);
    } else if (modes.length > 0) {
      sanitized.workMode = modes;
    }
  }

  // 6. Filter: verified
  if (rawQuery.verified !== undefined) {
    const val = String(rawQuery.verified).trim().toLowerCase();
    if (val === 'true' || val === 'false') {
      sanitized.verified = val === 'true';
    } else {
      errors.push('Verified filter must be "true" or "false"');
    }
  }

  // 7. Filter: featured
  if (rawQuery.featured !== undefined) {
    const val = String(rawQuery.featured).trim().toLowerCase();
    if (val === 'true' || val === 'false') {
      sanitized.featured = val === 'true';
    } else {
      errors.push('Featured filter must be "true" or "false"');
    }
  }

  // 8. Filter: skills
  if (rawQuery.skills !== undefined) {
    if (typeof rawQuery.skills === 'string') {
      sanitized.skills = rawQuery.skills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (Array.isArray(rawQuery.skills)) {
      sanitized.skills = rawQuery.skills
        .map((s) => String(s).trim().toLowerCase())
        .filter(Boolean);
    }
  }

  // 9. Location: country, state, city
  if (rawQuery.country !== undefined && typeof rawQuery.country === 'string') {
    sanitized.country = rawQuery.country.trim();
  }
  if (rawQuery.state !== undefined && typeof rawQuery.state === 'string') {
    sanitized.state = rawQuery.state.trim();
  }
  if (rawQuery.city !== undefined && typeof rawQuery.city === 'string') {
    sanitized.city = rawQuery.city.trim();
  }

  // 10. Dates: deadlineBefore, deadlineAfter
  if (rawQuery.deadlineBefore !== undefined) {
    const d = Date.parse(rawQuery.deadlineBefore);
    if (isNaN(d)) {
      errors.push('Invalid deadlineBefore date format');
    } else {
      sanitized.deadlineBefore = new Date(d);
    }
  }

  if (rawQuery.deadlineAfter !== undefined) {
    const d = Date.parse(rawQuery.deadlineAfter);
    if (isNaN(d)) {
      errors.push('Invalid deadlineAfter date format');
    } else {
      sanitized.deadlineAfter = new Date(d);
    }
  }

  // 11. Dates: eventDateBefore, eventDateAfter
  if (rawQuery.eventDateBefore !== undefined) {
    const d = Date.parse(rawQuery.eventDateBefore);
    if (isNaN(d)) {
      errors.push('Invalid eventDateBefore date format');
    } else {
      sanitized.eventDateBefore = new Date(d);
    }
  }

  if (rawQuery.eventDateAfter !== undefined) {
    const d = Date.parse(rawQuery.eventDateAfter);
    if (isNaN(d)) {
      errors.push('Invalid eventDateAfter date format');
    } else {
      sanitized.eventDateAfter = new Date(d);
    }
  }

  // 12. Sort
  if (rawQuery.sort !== undefined) {
    const sortVal = String(rawQuery.sort).trim().toLowerCase();
    if (!ALLOWED_SORTS.includes(sortVal)) {
      errors.push(`Invalid sort option. Allowed: ${ALLOWED_SORTS.join(', ')}`);
    } else {
      sanitized.sort = sortVal;
    }
  } else {
    sanitized.sort = 'deadline_asc';
  }

  if (errors.length > 0) {
    return { error: errors.join('; '), value: null };
  }

  return { error: null, value: sanitized };
}
