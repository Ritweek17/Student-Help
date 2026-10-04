/**
 * Todo API Service
 * Centralized client for communicating with CareerOS Express Todo REST endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class TodoApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'TodoApiError';
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
    throw new TodoApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = message || 'Todo not found.';
    throw new TodoApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new TodoApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new TodoApiError(message, status, 'SERVER_ERROR');
  }

  throw new TodoApiError(
    message || defaultErrorMessage || 'An error occurred.',
    status,
    'API_ERROR'
  );
}

/**
 * Fetch todos with optional query filters:
 * GET /api/todos?page&limit&completed&priority&category&dueDate&startDate&endDate&status
 */
export async function getTodos(params = {}, token, signal) {
  if (!token) {
    throw new TodoApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) queryParams.append('page', String(params.page));
  if (params.limit !== undefined && params.limit !== null) queryParams.append('limit', String(params.limit));
  if (params.completed !== undefined && params.completed !== null) queryParams.append('completed', String(params.completed));
  if (params.priority) queryParams.append('priority', String(params.priority));
  if (params.category) queryParams.append('category', String(params.category));
  if (params.dueDate) queryParams.append('dueDate', String(params.dueDate));
  if (params.startDate) queryParams.append('startDate', String(params.startDate));
  if (params.endDate) queryParams.append('endDate', String(params.endDate));
  if (params.status) queryParams.append('status', String(params.status));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/todos${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load todos.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof TodoApiError) {
      throw error;
    }
    throw new TodoApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Fetch a single todo by ID
 * GET /api/todos/:id
 */
export async function getTodo(id, token, signal) {
  if (!token) {
    throw new TodoApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/todos/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load todo.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof TodoApiError) {
      throw error;
    }
    throw new TodoApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Create a new todo
 * POST /api/todos
 */
export async function createTodo(payload, token) {
  if (!token) {
    throw new TodoApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/todos`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to create todo.');
  } catch (error) {
    if (error instanceof TodoApiError) {
      throw error;
    }
    throw new TodoApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Update an existing todo
 * PUT /api/todos/:id
 */
export async function updateTodo(id, payload, token) {
  if (!token) {
    throw new TodoApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/todos/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to update todo.');
  } catch (error) {
    if (error instanceof TodoApiError) {
      throw error;
    }
    throw new TodoApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Delete a todo
 * DELETE /api/todos/:id
 */
export async function deleteTodo(id, token) {
  if (!token) {
    throw new TodoApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/todos/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to delete todo.');
  } catch (error) {
    if (error instanceof TodoApiError) {
      throw error;
    }
    throw new TodoApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
