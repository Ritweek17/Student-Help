/**
 * Profile API Service
 * Centralized service for communicating with the CareerOS Express Profile endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ProfileApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
    this.code = code;
  }
}

async function handleResponse(response, defaultErrorMessage) {
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
    message = 'Your session has expired. Please sign in again.';
    throw new ProfileApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = 'Profile not found.';
    throw new ProfileApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid profile data provided.';
    throw new ProfileApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = defaultErrorMessage || 'Something went wrong. Please try again.';
    throw new ProfileApiError(message, status, 'SERVER_ERROR');
  }

  throw new ProfileApiError(message || defaultErrorMessage || 'An error occurred.', status, 'API_ERROR');
}

export async function getProfile(token) {
  if (!token) {
    throw new ProfileApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Something went wrong while loading your profile.');
  } catch (error) {
    if (error instanceof ProfileApiError) {
      throw error;
    }
    throw new ProfileApiError('Unable to load your profile. Please try again.', 0, 'NETWORK_ERROR');
  }
}

export async function updateProfile(token, profileData) {
  if (!token) {
    throw new ProfileApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    return await handleResponse(response, 'Something went wrong while saving your profile.');
  } catch (error) {
    if (error instanceof ProfileApiError) {
      throw error;
    }
    throw new ProfileApiError('Unable to save your profile. Please try again.', 0, 'NETWORK_ERROR');
  }
}
