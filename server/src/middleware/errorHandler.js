import { env } from '../config/env.js';

function sanitizeErrorText(text) {
  if (typeof text !== 'string') {
    return text;
  }
  return text
    .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]');
}

export function notFoundHandler(_request, response) {
  response.status(404).json({
    success: false,
    message: 'Route not found',
  });
}

export function errorHandler(error, request, response, _next) {
  const statusCode = error.statusCode || 500;
  const isProduction = (process.env.NODE_ENV || env.nodeEnv) === 'production';
  const method = request?.method || 'UNKNOWN';
  const url = request?.originalUrl || request?.url || 'UNKNOWN';

  // Safe server-side error logging:
  // Server errors (5xx) are logged to console.error with sanitized message and full stack.
  // Client errors (4xx) are logged cleanly without leaking secrets or polluting server logs with stack traces.
  // Request headers (Authorization, Cookie) and body are never logged.
  if (statusCode >= 500) {
    const logMeta = {
      name: error.name || 'Error',
      message: sanitizeErrorText(error.message),
      statusCode,
    };

    if (error.stack) {
      logMeta.stack = sanitizeErrorText(error.stack);
    }

    console.error(`[Server Error] ${method} ${url} - Status ${statusCode}:`, logMeta);
  } else if (!isProduction) {
    console.warn(`[Client Error] ${method} ${url} - Status ${statusCode}: ${sanitizeErrorText(error.message)}`);
  }

  const payload = {
    success: false,
    message: statusCode >= 500 && isProduction
      ? 'Internal server error'
      : error.message || 'Internal server error',
  };

  if (!isProduction && error.stack) {
    payload.stack = error.stack;
  }

  response.status(statusCode).json(payload);
}
