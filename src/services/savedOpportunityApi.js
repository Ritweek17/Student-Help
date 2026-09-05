/**
 * Saved Opportunity API Service
 * Centralized client for communicating with CareerOS Express Saved Opportunity endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class SavedOpportunityApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'SavedOpportunityApiError';
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
    throw new SavedOpportunityApiError(message, 401, 'UNAUTHORIZED');
  }

  if (status === 404) {
    message = 'Opportunity not found.';
    throw new SavedOpportunityApiError(message, 404, 'NOT_FOUND');
  }

  if (status === 400) {
    message = message || 'Invalid request parameters.';
    throw new SavedOpportunityApiError(message, 400, 'BAD_REQUEST');
  }

  if (status >= 500) {
    message = 'Something went wrong. Please try again.';
    throw new SavedOpportunityApiError(message, status, 'SERVER_ERROR');
  }

  throw new SavedOpportunityApiError(message || defaultErrorMessage || 'An error occurred.', status, 'API_ERROR');
}

/**
 * Save an opportunity for the current user
 * POST /api/opportunities/:id/save
 */
export async function saveOpportunity(opportunityId, token) {
  if (!token) {
    throw new SavedOpportunityApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  if (!opportunityId) {
    throw new SavedOpportunityApiError('Opportunity ID is required.', 400, 'BAD_REQUEST');
  }

  const url = `${API_BASE_URL}/api/opportunities/${opportunityId}/save`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to update saved opportunities. Please try again.');
  } catch (error) {
    if (error instanceof SavedOpportunityApiError) {
      throw error;
    }
    throw new SavedOpportunityApiError('Unable to update saved opportunities. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Unsave an opportunity for the current user
 * DELETE /api/opportunities/:id/save
 */
export async function unsaveOpportunity(opportunityId, token) {
  if (!token) {
    throw new SavedOpportunityApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  if (!opportunityId) {
    throw new SavedOpportunityApiError('Opportunity ID is required.', 400, 'BAD_REQUEST');
  }

  const url = `${API_BASE_URL}/api/opportunities/${opportunityId}/save`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return await handleResponse(response, 'Unable to update saved opportunities. Please try again.');
  } catch (error) {
    if (error instanceof SavedOpportunityApiError) {
      throw error;
    }
    throw new SavedOpportunityApiError('Unable to update saved opportunities. Please try again.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Get paginated list of saved opportunities for the current user
 * GET /api/saved-opportunities?page=X&limit=Y
 */
export async function getSavedOpportunities(params = {}, token, signal) {
  if (!token) {
    throw new SavedOpportunityApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  const queryParams = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) queryParams.append('page', String(params.page));
  if (params.limit !== undefined && params.limit !== null) queryParams.append('limit', String(params.limit));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/saved-opportunities${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(response, 'Unable to load saved opportunities.');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof SavedOpportunityApiError) {
      throw error;
    }
    throw new SavedOpportunityApiError('Unable to load saved opportunities.', 0, 'NETWORK_ERROR');
  }
}
