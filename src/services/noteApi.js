/**
 * Note API Service
 * Centralized client for communicating with CareerOS Express Note REST endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class NoteApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'NoteApiError';
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
    throw new NoteApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = message || 'Note not found.';
    throw new NoteApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new NoteApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new NoteApiError(message, status, 'SERVER_ERROR');
  }

  throw new NoteApiError(
    message || defaultErrorMessage || 'An error occurred.',
    status,
    'API_ERROR'
  );
}

/**
 * Fetch notes with optional query filters:
 * GET /api/notes?search&category
 */
export async function getNotes(params = {}, token, signal) {
  if (!token) {
    throw new NoteApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.search) queryParams.append('search', String(params.search));
  if (params.category && params.category !== 'All') queryParams.append('category', String(params.category));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/notes${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load notes.');
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error instanceof NoteApiError) throw error;
    throw new NoteApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Create a new note
 * POST /api/notes
 */
export async function createNote(payload, token) {
  if (!token) {
    throw new NoteApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notes`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to create note.');
  } catch (error) {
    if (error instanceof NoteApiError) throw error;
    throw new NoteApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Update an existing note
 * PATCH /api/notes/:id
 */
export async function updateNote(id, payload, token) {
  if (!token) {
    throw new NoteApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notes/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Unable to update note.');
  } catch (error) {
    if (error instanceof NoteApiError) throw error;
    throw new NoteApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Delete a note
 * DELETE /api/notes/:id
 */
export async function deleteNote(id, token) {
  if (!token) {
    throw new NoteApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const url = `${API_BASE_URL}/api/notes/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to delete note.');
  } catch (error) {
    if (error instanceof NoteApiError) throw error;
    throw new NoteApiError('Unable to connect to CareerOS. Please try again.', 0, 'NETWORK_ERROR');
  }
}
