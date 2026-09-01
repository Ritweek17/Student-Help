function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeEmail(email) {
  if (typeof email !== 'string' || !email.trim()) {
    throw validationError('Email is required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw validationError('Email must be a valid email address');
  }

  return normalizedEmail;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw validationError('Password must be at least 8 characters long');
  }
}

export function validateSignup(input) {
  const email = normalizeEmail(input.email);
  validatePassword(input.password);

  if (typeof input.firstName !== 'string' || !input.firstName.trim()) {
    throw validationError('First name is required');
  }

  if (input.lastName !== undefined && (typeof input.lastName !== 'string' || !input.lastName.trim())) {
    throw validationError('Last name must be a non-empty string when provided');
  }

  return {
    email,
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName?.trim(),
  };
}

export function validateLogin(input) {
  return {
    email: normalizeEmail(input.email),
    password: (() => {
      if (typeof input.password !== 'string' || !input.password) {
        throw validationError('Password is required');
      }

      return input.password;
    })(),
  };
}
