/**
 * Calendar API Service
 * Centralized client for communicating with CareerOS Express Calendar REST endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class CalendarApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'CalendarApiError';
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
    throw new CalendarApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = message || 'Calendar event not found.';
    throw new CalendarApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new CalendarApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new CalendarApiError(message, status, 'SERVER_ERROR');
  }

  throw new CalendarApiError(
    message || defaultErrorMessage || 'An error occurred.',
    status,
    'API_ERROR'
  );
}

/**
 * Fetch calendar events with optional query parameters:
 * GET /api/calendar?page&limit&type&status&startAfter&startBefore
 */
export async function getCalendarEvents(params = {}, token, signal) {
  if (!token) {
    throw new CalendarApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) queryParams.append('page', String(params.page));
  if (params.limit !== undefined && params.limit !== null) queryParams.append('limit', String(params.limit));
  if (params.type) queryParams.append('type', String(params.type));
  if (params.status) queryParams.append('status', String(params.status));
  if (params.startAfter) queryParams.append('startAfter', String(params.startAfter));
  if (params.startBefore) queryParams.append('startBefore', String(params.startBefore));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/calendar${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load calendar events.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof CalendarApiError) {
      throw error;
    }
    throw new CalendarApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch a single calendar event by ID
 * GET /api/calendar/:id
 */
export async function getCalendarEvent(id, token, signal) {
  if (!token) {
    throw new CalendarApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/calendar/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load calendar event.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof CalendarApiError) {
      throw error;
    }
    throw new CalendarApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Create a new calendar event
 * POST /api/calendar
 */
export async function createCalendarEvent(payload, token) {
  if (!token) {
    throw new CalendarApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/calendar`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to create calendar event.');
  } catch (error) {
    if (error instanceof CalendarApiError) {
      throw error;
    }
    throw new CalendarApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Update an existing calendar event
 * PUT /api/calendar/:id
 */
export async function updateCalendarEvent(id, payload, token) {
  if (!token) {
    throw new CalendarApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/calendar/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to update calendar event.');
  } catch (error) {
    if (error instanceof CalendarApiError) {
      throw error;
    }
    throw new CalendarApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Delete a calendar event
 * DELETE /api/calendar/:id
 */
export async function deleteCalendarEvent(id, token) {
  if (!token) {
    throw new CalendarApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/calendar/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to delete calendar event.');
  } catch (error) {
    if (error instanceof CalendarApiError) {
      throw error;
    }
    throw new CalendarApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
