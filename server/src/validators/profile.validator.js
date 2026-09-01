function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const ALLOWED_FIELDS = new Set([
  'personal',
  'education',
  'skills',
  'interests',
  'projects',
  'experience',
  'certifications',
  'achievements',
  'professionalLinks',
  'documents',
  'careerPreferences',
  'careerGoal',
]);

const FORBIDDEN_FIELDS = new Set([
  'userId',
  'profileId',
  '_id',
  'createdAt',
  'updatedAt',
  'id',
  '__v',
]);

export function validateProfileUpdate(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw validationError('Request body must be a valid JSON object');
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      continue;
    }

    if (ALLOWED_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
