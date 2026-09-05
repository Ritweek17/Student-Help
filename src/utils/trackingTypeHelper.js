/**
 * Tracking Type Helper
 * Centralized mapping for opportunity types to application/registration tracking categories.
 */

export const APPLICATION_OPPORTUNITY_TYPES = [
  'internship',
  'fellowship',
  'scholarship',
  'open_source',
];

export const REGISTRATION_OPPORTUNITY_TYPES = [
  'hackathon',
  'workshop',
  'meetup',
  'conference',
  'expo',
  'tech_talk',
  'student_program',
  'competition',
];

export const APPLICATION_STATUSES = [
  'applied',
  'interview',
  'waiting',
  'selected',
  'rejected',
  'withdrawn',
];

export const REGISTRATION_STATUSES = [
  'registered',
  'attended',
  'completed',
  'cancelled',
];

/**
 * Returns tracking type ('application' or 'registration') for a given opportunity type/category string.
 */
export function getTrackingType(opportunityType) {
  if (!opportunityType || typeof opportunityType !== 'string') {
    return 'application';
  }

  const clean = opportunityType.toLowerCase().trim();

  if (APPLICATION_OPPORTUNITY_TYPES.includes(clean)) {
    return 'application';
  }

  if (REGISTRATION_OPPORTUNITY_TYPES.includes(clean)) {
    return 'registration';
  }

  // Safe explicit fallback
  return 'application';
}

export function isApplicationType(opportunityType) {
  return getTrackingType(opportunityType) === 'application';
}

export function isRegistrationType(opportunityType) {
  return getTrackingType(opportunityType) === 'registration';
}
