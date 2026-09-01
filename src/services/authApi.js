/**
 * Authentication API Service
 * Centralized service for communicating with the CareerOS Express Authentication endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class AuthApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
  }
}

async function handleResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.ok && data?.success !== false) {
    return data;
  }

  const status = response.status;
  let message = data?.message;

  if (status === 401) {
    message = message || 'Invalid email or password';
    throw new AuthApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 409) {
    message = 'An account with this email already exists.';
    throw new AuthApiError(message, 409, 'CONFLICT');
  }

  if (status === 429) {
    message = 'Too many authentication attempts. Please try again later.';
    throw new AuthApiError(message, 429, 'RATE_LIMITED');
  }

  if (status === 400) {
    message = message || 'Invalid request data';
    throw new AuthApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new AuthApiError(message, status, 'SERVER_ERROR');
  }

  throw new AuthApiError(message || 'An error occurred during authentication.', status, 'API_ERROR');
}

export async function login({ email, password }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }
    throw new AuthApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

export async function signup({ email, password, firstName, lastName }) {
  try {
    const payload = {
      email,
      password,
      firstName,
    };
    if (lastName && lastName.trim()) {
      payload.lastName = lastName.trim();
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }
    throw new AuthApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

export async function getCurrentUser(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }
    throw new AuthApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
