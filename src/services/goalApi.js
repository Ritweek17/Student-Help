/**
 * Goal API Service
 * Centralized client for communicating with CareerOS Express Goal REST endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class GoalApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'GoalApiError';
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
    throw new GoalApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = message || 'Goal not found.';
    throw new GoalApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new GoalApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new GoalApiError(message, status, 'SERVER_ERROR');
  }

  throw new GoalApiError(
    message || defaultErrorMessage || 'An error occurred.',
    status,
    'API_ERROR'
  );
}

/**
 * Fetch goals with optional query filters:
 * GET /api/goals?page&limit&status&category&priority&deadline&startDate&endDate
 */
export async function getGoals(params = {}, token, signal) {
  if (!token) {
    throw new GoalApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) queryParams.append('page', String(params.page));
  if (params.limit !== undefined && params.limit !== null) queryParams.append('limit', String(params.limit));
  if (params.status) queryParams.append('status', String(params.status));
  if (params.category) queryParams.append('category', String(params.category));
  if (params.priority) queryParams.append('priority', String(params.priority));
  if (params.deadline) queryParams.append('deadline', String(params.deadline));
  if (params.startDate) queryParams.append('startDate', String(params.startDate));
  if (params.endDate) queryParams.append('endDate', String(params.endDate));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/goals${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load goals.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof GoalApiError) {
      throw error;
    }
    throw new GoalApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch a single goal by ID
 * GET /api/goals/:id
 */
export async function getGoal(id, token, signal) {
  if (!token) {
    throw new GoalApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/goals/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load goal.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof GoalApiError) {
      throw error;
    }
    throw new GoalApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Create a new goal
 * POST /api/goals
 */
export async function createGoal(payload, token) {
  if (!token) {
    throw new GoalApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/goals`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to create goal.');
  } catch (error) {
    if (error instanceof GoalApiError) {
      throw error;
    }
    throw new GoalApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Update an existing goal
 * PUT /api/goals/:id
 */
export async function updateGoal(id, payload, token) {
  if (!token) {
    throw new GoalApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/goals/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to update goal.');
  } catch (error) {
    if (error instanceof GoalApiError) {
      throw error;
    }
    throw new GoalApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Quick progress update convenience method
 * PUT /api/goals/:id
 */
export async function updateGoalProgress(id, currentValue, token) {
  return updateGoal(id, { currentValue }, token);
}

/**
 * Delete a goal
 * DELETE /api/goals/:id
 */
export async function deleteGoal(id, token) {
  if (!token) {
    throw new GoalApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/goals/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to delete goal.');
  } catch (error) {
    if (error instanceof GoalApiError) {
      throw error;
    }
    throw new GoalApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
