/**
 * CareerOS Intelligence API Service
 * 
 * Centralized client for communicating with the CareerOS Express Intelligence endpoints.
 * Handles fetching deterministic Career Readiness snapshots, fit scores, and preparation plans.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class IntelligenceApiError extends Error {
  constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'IntelligenceApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Normalizes and parses API response, converting errors to human-friendly messages.
 * 
 * @param {Response} response - Fetch response
 * @param {string} defaultErrorMessage - Default fallback error message
 * @returns {Promise<Object>} JSON response payload
 */
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
  const rawMessage = data?.message;

  if (status === 401) {
    throw new IntelligenceApiError(
      'Your session has expired. Please sign in again.',
      401,
      'UNAUTHORIZED'
    );
  }

  if (status === 404) {
    throw new IntelligenceApiError(
      rawMessage || 'Requested intelligence data not found.',
      404,
      'NOT_FOUND'
    );
  }

  if (status >= 500) {
    throw new IntelligenceApiError(
      rawMessage || defaultErrorMessage || 'Career readiness service is temporarily unavailable. Please try again later.',
      status,
      'SERVER_ERROR'
    );
  }

  throw new IntelligenceApiError(
    rawMessage || defaultErrorMessage || 'An unexpected error occurred while calculating career readiness.',
    status,
    'API_ERROR'
  );
}

/**
 * Retrieves the deterministic Career Readiness snapshot for the authenticated student.
 * 
 * @param {string} token - Authenticated user JWT session token
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{ success: boolean, readiness: Object }>}
 */
export async function getCareerReadiness(token, signal) {
  if (!token) {
    throw new IntelligenceApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/intelligence/readiness`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(
      response,
      'Career readiness is temporarily unavailable. Please try again.'
    );
  } catch (error) {
    if (error instanceof IntelligenceApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new IntelligenceApiError(
      'Unable to connect to the Career Readiness service. Please check your network connection.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Retrieves the application pipeline health and operational overview intelligence.
 * 
 * @param {string} token - Authenticated user JWT session token
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{ success: boolean, overview: Object }>}
 */
export async function getApplicationOverview(token, signal) {
  if (!token) {
    throw new IntelligenceApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/intelligence/applications/overview`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(
      response,
      'Application intelligence overview is temporarily unavailable. Please try again.'
    );
  } catch (error) {
    if (error instanceof IntelligenceApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new IntelligenceApiError(
      'Unable to connect to the Application Intelligence service. Please check your network connection.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Retrieves historical application outcome intelligence, recurring rejection gaps, and role patterns.
 * 
 * @param {string} token - Authenticated user JWT session token
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{ success: boolean, outcomes: Object }>}
 */
export async function getApplicationOutcomes(token, signal) {
  if (!token) {
    throw new IntelligenceApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/intelligence/applications/outcomes`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });

    return await handleResponse(
      response,
      'Application outcome intelligence is temporarily unavailable. Please try again.'
    );
  } catch (error) {
    if (error instanceof IntelligenceApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new IntelligenceApiError(
      'Unable to connect to the Application Intelligence service. Please check your network connection.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Retrieves contextual AI Career Coach guidance grounded strictly in the student's
 * authoritative CareerOS context, with automatic deterministic fallback.
 *
 * Strict Security & Contract Constraints:
 * - Only sends { query }.
 * - Never sends userId, scores, skill gaps, or profile.
 * - Backend remains the sole authoritative context and orchestration source.
 * - Returns structured guidance (source: 'ai' or 'deterministic_fallback').
 *
 * @param {string} token - Authenticated user JWT session token
 * @param {string} query - Student contextual query / question (1-500 chars)
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{
 *   ok: boolean,
 *   source: 'ai' | 'deterministic_fallback',
 *   data?: {
 *     adviceType: string,
 *     headline: string,
 *     keyPoints: string[],
 *     referencedSkills: string[],
 *     suggestedAction: string
 *   },
 *   fallbackData?: {
 *     adviceType: string,
 *     headline: string,
 *     keyPoints: string[],
 *     referencedSkills: string[],
 *     suggestedAction: string
 *   },
 *   reason?: string,
 *   requestId?: string
 * }>}
 */
export async function getCareerCoachAdvice(token, query, signal) {
  if (!token) {
    throw new IntelligenceApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new IntelligenceApiError('Please enter a question for the Career Coach.', 400, 'INVALID_REQUEST');
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 500) {
    throw new IntelligenceApiError('Career Coach query must be 500 characters or fewer.', 400, 'QUERY_TOO_LONG');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/career-coach`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: trimmedQuery }),
      signal,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const status = response.status;
    const rawMessage = data?.message;

    if (status === 401) {
      throw new IntelligenceApiError(
        'Your session has expired. Please sign in again.',
        401,
        'UNAUTHORIZED'
      );
    }

    if (status === 429) {
      throw new IntelligenceApiError(
        rawMessage || 'Daily advice quota reached. Please check back tomorrow or try again shortly.',
        429,
        'RATE_LIMITED'
      );
    }

    if (status === 400) {
      throw new IntelligenceApiError(
        rawMessage || 'Invalid request. Please check your question.',
        400,
        'INVALID_REQUEST'
      );
    }

    if (status === 503) {
      throw new IntelligenceApiError(
        rawMessage || 'Career Coach service is temporarily unavailable. Please try again.',
        503,
        'SERVICE_UNAVAILABLE'
      );
    }

    if (status >= 500) {
      throw new IntelligenceApiError(
        'Career Coach service is temporarily unavailable. Please try again later.',
        status,
        'SERVER_ERROR'
      );
    }

    if (!response.ok) {
      throw new IntelligenceApiError(
        rawMessage || 'An unexpected error occurred while communicating with Career Coach.',
        status,
        'API_ERROR'
      );
    }

    // Status 200: Machine-safe structured response (source: 'ai' or 'deterministic_fallback')
    return data;
  } catch (error) {
    if (error instanceof IntelligenceApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new IntelligenceApiError(
      'Unable to connect to the Career Coach service. Please check your network connection.',
      0,
      'NETWORK_ERROR'
    );
  }
}

