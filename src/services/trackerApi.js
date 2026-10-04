/**
 * Tracker API Service
 * Centralized client for communicating with CareerOS Express Tracker REST endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class TrackerApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'TrackerApiError';
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
    throw new TrackerApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = message || 'Tracker activity not found.';
    throw new TrackerApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new TrackerApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new TrackerApiError(message, status, 'SERVER_ERROR');
  }

  throw new TrackerApiError(
    message || defaultErrorMessage || 'An error occurred.',
    status,
    'API_ERROR'
  );
}

/**
 * Fetch activities with optional query filters:
 * GET /api/tracker?page&limit&date&startDate&endDate&category&completed
 */
export async function getTrackerActivities(params = {}, token, signal) {
  if (!token) {
    throw new TrackerApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) queryParams.append('page', String(params.page));
  if (params.limit !== undefined && params.limit !== null) queryParams.append('limit', String(params.limit));
  if (params.date) queryParams.append('date', String(params.date));
  if (params.startDate) queryParams.append('startDate', String(params.startDate));
  if (params.endDate) queryParams.append('endDate', String(params.endDate));
  if (params.category) queryParams.append('category', String(params.category));
  if (params.completed !== undefined && params.completed !== null) queryParams.append('completed', String(params.completed));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/tracker${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load tracker activities.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof TrackerApiError) {
      throw error;
    }
    throw new TrackerApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch a single tracker activity by ID
 * GET /api/tracker/:id
 */
export async function getTrackerActivity(id, token, signal) {
  if (!token) {
    throw new TrackerApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/tracker/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load tracker activity.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof TrackerApiError) {
      throw error;
    }
    throw new TrackerApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Create a new tracker activity
 * POST /api/tracker
 */
export async function createTrackerActivity(payload, token) {
  if (!token) {
    throw new TrackerApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/tracker`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to create tracker activity.');
  } catch (error) {
    if (error instanceof TrackerApiError) {
      throw error;
    }
    throw new TrackerApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Update an existing tracker activity
 * PUT /api/tracker/:id
 */
export async function updateTrackerActivity(id, payload, token) {
  if (!token) {
    throw new TrackerApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/tracker/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to update tracker activity.');
  } catch (error) {
    if (error instanceof TrackerApiError) {
      throw error;
    }
    throw new TrackerApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Delete a tracker activity
 * DELETE /api/tracker/:id
 */
export async function deleteTrackerActivity(id, token) {
  if (!token) {
    throw new TrackerApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/tracker/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to delete tracker activity.');
  } catch (error) {
    if (error instanceof TrackerApiError) {
      throw error;
    }
    throw new TrackerApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
