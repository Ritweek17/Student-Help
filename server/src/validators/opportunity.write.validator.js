import { OPPORTUNITY_TYPES, WORK_MODES, OPPORTUNITY_STATUSES } from '../models/Opportunity.js';

function isValidUrl(value) {
  if (!value || typeof value !== 'string') return true;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function validateOpportunityWrite(body = {}, isUpdate = false) {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid request body', value: null };
  }

  // Explicitly strip/ignore system and read-only fields
  const forbiddenKeys = ['_id', 'createdAt', 'updatedAt', '__v', 'userId', 'profileId', 'verifiedBy', 'verifiedAt'];
  forbiddenKeys.forEach((key) => {
    delete body[key];
  });

  // 1. Core Required Fields on Create
  if (!isUpdate) {
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      errors.push('Opportunity title is required');
    }
    if (!body.organization || typeof body.organization !== 'string' || !body.organization.trim()) {
      errors.push('Organization name is required');
    }
    if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
      errors.push('Description is required');
    }
    if (!body.type || typeof body.type !== 'string' || !body.type.trim()) {
      errors.push('Opportunity type is required');
    }
  }

  // 2. String Fields
  if (body.title !== undefined) {
    if (typeof body.title === 'string' && body.title.trim()) {
      sanitized.title = body.title.trim();
    } else if (isUpdate && (body.title === '' || body.title === null)) {
      errors.push('Opportunity title cannot be empty');
    }
  }

  if (body.organization !== undefined) {
    if (typeof body.organization === 'string' && body.organization.trim()) {
      sanitized.organization = body.organization.trim();
    } else if (isUpdate && (body.organization === '' || body.organization === null)) {
      errors.push('Organization name cannot be empty');
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description === 'string' && body.description.trim()) {
      sanitized.description = body.description.trim();
    } else if (isUpdate && (body.description === '' || body.description === null)) {
      errors.push('Description cannot be empty');
    }
  }

  if (body.shortDescription !== undefined) {
    sanitized.shortDescription = typeof body.shortDescription === 'string' ? body.shortDescription.trim() : '';
  }

  if (body.duration !== undefined) {
    sanitized.duration = typeof body.duration === 'string' ? body.duration.trim() : '';
  }

  if (body.sourceId !== undefined) {
    sanitized.sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : '';
  }

  if (body.sourceType !== undefined) {
    sanitized.sourceType = typeof body.sourceType === 'string' ? body.sourceType.trim() : '';
  }

  // 3. Enums: type, workMode, status
  if (body.type !== undefined) {
    const t = String(body.type).trim().toLowerCase();
    if (!OPPORTUNITY_TYPES.includes(t)) {
      errors.push(`Invalid opportunity type. Allowed: ${OPPORTUNITY_TYPES.join(', ')}`);
    } else {
      sanitized.type = t;
    }
  }

  if (body.workMode !== undefined && body.workMode !== null && body.workMode !== '') {
    const wm = String(body.workMode).trim().toLowerCase();
    if (!WORK_MODES.includes(wm)) {
      errors.push(`Invalid work mode. Allowed: ${WORK_MODES.join(', ')}`);
    } else {
      sanitized.workMode = wm;
    }
  } else if (body.workMode === null || body.workMode === '') {
    sanitized.workMode = undefined;
  }

  if (body.status !== undefined) {
    const st = String(body.status).trim().toLowerCase();
    if (!OPPORTUNITY_STATUSES.includes(st)) {
      errors.push(`Invalid opportunity status. Allowed: ${OPPORTUNITY_STATUSES.join(', ')}`);
    } else {
      sanitized.status = st;
    }
  }

  // 4. Booleans: verified, featured
  if (body.verified !== undefined) {
    if (typeof body.verified === 'boolean') {
      sanitized.verified = body.verified;
    } else if (String(body.verified).toLowerCase() === 'true') {
      sanitized.verified = true;
    } else if (String(body.verified).toLowerCase() === 'false') {
      sanitized.verified = false;
    } else {
      errors.push('Verified must be a boolean');
    }
  }

  if (body.featured !== undefined) {
    if (typeof body.featured === 'boolean') {
      sanitized.featured = body.featured;
    } else if (String(body.featured).toLowerCase() === 'true') {
      sanitized.featured = true;
    } else if (String(body.featured).toLowerCase() === 'false') {
      sanitized.featured = false;
    } else {
      errors.push('Featured must be a boolean');
    }
  }

  // 5. Arrays: skills, tags
  if (body.skills !== undefined) {
    if (Array.isArray(body.skills)) {
      sanitized.skills = body.skills.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    } else if (typeof body.skills === 'string') {
      sanitized.skills = body.skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
  }

  if (body.tags !== undefined) {
    if (Array.isArray(body.tags)) {
      sanitized.tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof body.tags === 'string') {
      sanitized.tags = body.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  // 6. Subdocuments: location, stipend, prize, eligibility, source
  if (body.location && typeof body.location === 'object') {
    sanitized.location = {
      country: typeof body.location.country === 'string' ? body.location.country.trim() : undefined,
      state: typeof body.location.state === 'string' ? body.location.state.trim() : undefined,
      city: typeof body.location.city === 'string' ? body.location.city.trim() : undefined,
    };
  }

  if (body.stipend && typeof body.stipend === 'object') {
    const stipend = {};
    if (body.stipend.amount !== undefined && body.stipend.amount !== null && body.stipend.amount !== '') {
      const amt = Number(body.stipend.amount);
      if (isNaN(amt) || amt < 0) {
        errors.push('Stipend amount cannot be negative');
      } else {
        stipend.amount = amt;
      }
    }
    if (typeof body.stipend.currency === 'string') stipend.currency = body.stipend.currency.trim();
    if (typeof body.stipend.period === 'string') stipend.period = body.stipend.period.trim();
    sanitized.stipend = stipend;
  }

  if (body.prize && typeof body.prize === 'object') {
    const prize = {};
    if (body.prize.amount !== undefined && body.prize.amount !== null && body.prize.amount !== '') {
      const amt = Number(body.prize.amount);
      if (isNaN(amt) || amt < 0) {
        errors.push('Prize amount cannot be negative');
      } else {
        prize.amount = amt;
      }
    }
    if (typeof body.prize.currency === 'string') prize.currency = body.prize.currency.trim();
    sanitized.prize = prize;
  }

  if (body.eligibility && typeof body.eligibility === 'object') {
    const el = {};
    if (body.eligibility.minAge !== undefined && body.eligibility.minAge !== null && body.eligibility.minAge !== '') {
      const age = Number(body.eligibility.minAge);
      if (isNaN(age) || age < 0) errors.push('Minimum age cannot be negative');
      else el.minAge = age;
    }
    if (body.eligibility.maxAge !== undefined && body.eligibility.maxAge !== null && body.eligibility.maxAge !== '') {
      const age = Number(body.eligibility.maxAge);
      if (isNaN(age) || age < 0) errors.push('Maximum age cannot be negative');
      else el.maxAge = age;
    }
    if (Array.isArray(body.eligibility.educationLevels)) el.educationLevels = body.eligibility.educationLevels.map((e) => String(e).trim()).filter(Boolean);
    if (Array.isArray(body.eligibility.branches)) el.branches = body.eligibility.branches.map((b) => String(b).trim()).filter(Boolean);
    if (Array.isArray(body.eligibility.graduationYears)) el.graduationYears = body.eligibility.graduationYears.map(Number).filter((n) => !isNaN(n));
    if (Array.isArray(body.eligibility.locations)) el.locations = body.eligibility.locations.map((l) => String(l).trim()).filter(Boolean);
    sanitized.eligibility = el;
  }

  if (body.source && typeof body.source === 'object') {
    const src = {};
    if (typeof body.source.name === 'string') src.name = body.source.name.trim();
    if (body.source.url !== undefined) {
      if (!isValidUrl(body.source.url)) errors.push('Source URL must be a valid HTTP or HTTPS URL');
      else src.url = String(body.source.url).trim();
    }
    sanitized.source = src;
  }

  // 7. URLs
  const urlFields = ['applicationUrl', 'registrationUrl', 'organizationLogo', 'organizationWebsite'];
  urlFields.forEach((field) => {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      if (!isValidUrl(body[field])) {
        errors.push(`Invalid ${field}. Must be a valid HTTP or HTTPS URL`);
      } else {
        sanitized[field] = String(body[field]).trim();
      }
    } else if (body[field] === null || body[field] === '') {
      sanitized[field] = undefined;
    }
  });

  // 8. Dates & Date Order
  let parsedEventDate = null;
  let parsedEndDate = null;

  if (body.eventDate !== undefined && body.eventDate !== null && body.eventDate !== '') {
    const d = Date.parse(body.eventDate);
    if (isNaN(d)) errors.push('Invalid eventDate format');
    else {
      parsedEventDate = new Date(d);
      sanitized.eventDate = parsedEventDate;
    }
  }

  if (body.endDate !== undefined && body.endDate !== null && body.endDate !== '') {
    const d = Date.parse(body.endDate);
    if (isNaN(d)) errors.push('Invalid endDate format');
    else {
      parsedEndDate = new Date(d);
      sanitized.endDate = parsedEndDate;
    }
  }

  if (body.deadline !== undefined && body.deadline !== null && body.deadline !== '') {
    const d = Date.parse(body.deadline);
    if (isNaN(d)) errors.push('Invalid deadline format');
    else sanitized.deadline = new Date(d);
  }

  if (parsedEventDate && parsedEndDate && parsedEndDate < parsedEventDate) {
    errors.push('End date must be greater than or equal to event date');
  }

  if (errors.length > 0) {
    return { error: errors.join('; '), value: null };
  }

  return { error: null, value: sanitized };
}
