/**
 * Opportunity API Service
 * Centralized client for communicating with the CareerOS Express Opportunity endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class OpportunityApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'OpportunityApiError';
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
    throw new OpportunityApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = 'Opportunity not found.';
    throw new OpportunityApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid search parameters or request.';
    throw new OpportunityApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = defaultErrorMessage || 'Something went wrong while loading opportunities.';
    throw new OpportunityApiError(message, status, 'SERVER_ERROR');
  }

  throw new OpportunityApiError(message || defaultErrorMessage || 'An error occurred.', status, 'API_ERROR');
}

export async function getOpportunities(params = {}, token, signal) {
  if (!token) {
    throw new OpportunityApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'All') {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          queryParams.append(key, value.join(','));
        }
      } else {
        queryParams.append(key, String(value).trim());
      }
    }
  });

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/opportunities${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load opportunities. Please try again.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof OpportunityApiError) {
      throw error;
    }
    throw new OpportunityApiError('Unable to load opportunities. Please try again.', 0, 'NETWORK_ERROR');
  }
}

export async function getOpportunityById(id, token, signal) {
  if (!token) {
    throw new OpportunityApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  if (!id) {
    throw new OpportunityApiError('Opportunity ID is required', 400, 'BAD_REQUEST');
  }

  const url = `${API_BASE_URL}/api/opportunities/${id}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load this opportunity. Please try again.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof OpportunityApiError) {
      throw error;
    }
    throw new OpportunityApiError('Unable to load this opportunity. Please try again.', 0, 'NETWORK_ERROR');
  }
}
