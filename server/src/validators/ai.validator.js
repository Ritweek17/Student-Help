/**
 * CareerOS AI Request Validator (Phase 11H — B4)
 *
 * Enforces strict input validation for AI endpoints:
 * - Query required, string, max 500 characters.
 * - Rejects oversized request bodies.
 * - Strict schema: rejects any unsupported fields (e.g. client-provided userId,
 *   scores, skill gaps, or profile data).
 * - Authoritative context is constructed entirely server-side.
 */

export const MAX_QUERY_LENGTH = 500;
export const MAX_BODY_BYTES = 2048;
export const ALLOWED_FIELDS = Object.freeze(['query']);

/**
 * Validates the request body for POST /api/ai/career-coach.
 *
 * @param {any} body - Parsed JSON request body
 * @returns {{
 *   isValid: boolean,
 *   value?: { query: string },
 *   status?: number,
 *   category?: string,
 *   message?: string
 * }}
 */
export function validateCareerCoachRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      status: 400,
      category: 'invalid_request',
      message: 'Request body must be a valid JSON object',
    };
  }

  // Reject oversized payloads
  try {
    const rawLength = JSON.stringify(body).length;
    if (rawLength > MAX_BODY_BYTES) {
      return {
        isValid: false,
        status: 400,
        category: 'invalid_request',
        message: 'Request body exceeds maximum allowed size',
      };
    }
  } catch {
    return {
      isValid: false,
      status: 400,
      category: 'invalid_request',
      message: 'Malformed request body structure',
    };
  }

  // Strict schema: reject any unsupported fields
  const bodyKeys = Object.keys(body);
  const unsupportedFields = bodyKeys.filter((k) => !ALLOWED_FIELDS.includes(k));
  if (unsupportedFields.length > 0) {
    return {
      isValid: false,
      status: 400,
      category: 'invalid_request',
      message: `Unsupported field(s) in request body: ${unsupportedFields.join(', ')}. Client must not provide identity, scores, or context.`,
    };
  }

  const { query } = body;

  if (query === undefined || query === null) {
    return {
      isValid: false,
      status: 400,
      category: 'invalid_request',
      message: 'query is required',
    };
  }

  if (typeof query !== 'string') {
    return {
      isValid: false,
      status: 400,
      category: 'invalid_request',
      message: 'query must be a string',
    };
  }

  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return {
      isValid: false,
      status: 400,
      category: 'invalid_request',
      message: 'query cannot be empty',
    };
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return {
      isValid: false,
      status: 400,
      category: 'invalid_request',
      message: `query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`,
    };
  }

  return {
    isValid: true,
    value: {
      query: trimmedQuery,
    },
  };
}
