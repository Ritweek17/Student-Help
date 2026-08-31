import { env } from '../config/env.js';

export function notFoundHandler(_request, response) {
  response.status(404).json({
    success: false,
    message: 'Route not found',
  });
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode || 500;
  const payload = {
    success: false,
    message: statusCode >= 500 && env.nodeEnv === 'production'
      ? 'Internal server error'
      : error.message || 'Internal server error',
  };

  if (env.nodeEnv !== 'production' && error.stack) {
    payload.stack = error.stack;
  }

  response.status(statusCode).json(payload);
}
