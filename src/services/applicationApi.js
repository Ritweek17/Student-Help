/**
 * Application API Service
 * Centralized client for communicating with CareerOS Express Application/Registration REST endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApplicationApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ApplicationApiError';
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
    throw new ApplicationApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = message || 'Opportunity not found.';
    throw new ApplicationApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 409) {
    message = 'This tracking record already exists.';
    throw new ApplicationApiError(message, 409, 'CONFLICT');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new ApplicationApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new ApplicationApiError(message, status, 'SERVER_ERROR');
  }

  throw new ApplicationApiError(message || defaultErrorMessage || 'An error occurred.', status, 'API_ERROR');
}

/**
 * Create a new application or registration tracking record
 * POST /api/applications
 */
export async function createApplication(payload, token) {
  if (!token) {
    throw new ApplicationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/applications`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to create tracking record. Please try again.');
  } catch (error) {
    if (error instanceof ApplicationApiError) {
      throw error;
    }
    throw new ApplicationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch paginated list of tracking records
 * GET /api/applications?page=X&limit=Y&type=Z&status=W
 */
export async function getApplications(params = {}, token, signal) {
  if (!token) {
    throw new ApplicationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) queryParams.append('page', String(params.page));
  if (params.limit !== undefined && params.limit !== null) queryParams.append('limit', String(params.limit));
  if (params.type) queryParams.append('type', String(params.type));
  if (params.status) queryParams.append('status', String(params.status));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/applications${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load applications.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof ApplicationApiError) {
      throw error;
    }
    throw new ApplicationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch single tracking record for an opportunity by type
 * GET /api/applications/:opportunityId?type=application|registration
 */
export async function getApplication(opportunityId, type, token, signal) {
  if (!token) {
    throw new ApplicationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  if (!opportunityId || !type) {
    throw new ApplicationApiError('Opportunity ID and tracking type are required.', 400, 'BAD_REQUEST');
  }

  const url = `${API_BASE_URL}/api/applications/${opportunityId}?type=${encodeURIComponent(type)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load tracking details.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof ApplicationApiError) {
      throw error;
    }
    throw new ApplicationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Update tracking record for an opportunity
 * PUT /api/applications/:opportunityId?type=application|registration
 */
export async function updateApplication(opportunityId, type, payload, token) {
  if (!token) {
    throw new ApplicationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  if (!opportunityId || !type) {
    throw new ApplicationApiError('Opportunity ID and tracking type are required.', 400, 'BAD_REQUEST');
  }

  const url = `${API_BASE_URL}/api/applications/${opportunityId}?type=${encodeURIComponent(type)}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to update tracking details.');
  } catch (error) {
    if (error instanceof ApplicationApiError) {
      throw error;
    }
    throw new ApplicationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Delete tracking record for an opportunity
 * DELETE /api/applications/:opportunityId?type=application|registration
 */
export async function deleteApplication(opportunityId, type, token) {
  if (!token) {
    throw new ApplicationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  if (!opportunityId || !type) {
    throw new ApplicationApiError('Opportunity ID and tracking type are required.', 400, 'BAD_REQUEST');
  }

  const url = `${API_BASE_URL}/api/applications/${opportunityId}?type=${encodeURIComponent(type)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to delete tracking record.');
  } catch (error) {
    if (error instanceof ApplicationApiError) {
      throw error;
    }
    throw new ApplicationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
