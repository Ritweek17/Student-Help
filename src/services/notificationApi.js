/**
 * Notification API Service
 * Centralized client for communicating with CareerOS Express Notification REST endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class NotificationApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'NotificationApiError';
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
    throw new NotificationApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = message || 'Notification not found.';
    throw new NotificationApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 409) {
    message = message || 'This notification already exists.';
    throw new NotificationApiError(message, 409, 'CONFLICT');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new NotificationApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new NotificationApiError(message, status, 'SERVER_ERROR');
  }

  throw new NotificationApiError(
    message || defaultErrorMessage || 'An error occurred.',
    status,
    'API_ERROR'
  );
}

/**
 * Fetch paginated list of notifications
 * GET /api/notifications?page&limit&type&read&dismissed
 */
export async function getNotifications(params = {}, token, signal) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) queryParams.append('page', String(params.page));
  if (params.limit !== undefined && params.limit !== null) queryParams.append('limit', String(params.limit));
  if (params.type) queryParams.append('type', String(params.type));
  if (params.read !== undefined && params.read !== null) queryParams.append('read', String(params.read));
  if (params.dismissed !== undefined && params.dismissed !== null) queryParams.append('dismissed', String(params.dismissed));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/notifications${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load notifications.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch single notification by ID
 * GET /api/notifications/:id
 */
export async function getNotification(id, token) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to load notification.');
  } catch (error) {
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch unread notification count
 * GET /api/notifications/unread-count
 */
export async function getUnreadCount(token) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notifications/unread-count`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to load unread count.');
  } catch (error) {
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
export async function markRead(id, token) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to mark notification as read.');
  } catch (error) {
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
export async function markAllRead(token) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notifications/read-all`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to mark all notifications as read.');
  } catch (error) {
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Dismiss a notification
 * PUT /api/notifications/:id/dismiss
 */
export async function dismissNotification(id, token) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/dismiss`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to dismiss notification.');
  } catch (error) {
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export async function deleteNotification(id, token) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to delete notification.');
  } catch (error) {
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Create a new notification
 * POST /api/notifications
 */
export async function createNotification(payload, token) {
  if (!token) {
    throw new NotificationApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notifications`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to create notification.');
  } catch (error) {
    if (error instanceof NotificationApiError) {
      throw error;
    }
    throw new NotificationApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
