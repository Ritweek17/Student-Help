import { getDatabaseStatus, isDatabaseConnected } from '../config/db.js';

/**
 * Liveness probe endpoint.
 * Returns HTTP 200 when the Express HTTP process is functioning.
 * MUST NOT depend on MongoDB connection status.
 */
export function getLiveness(_request, response) {
  response.status(200).json({
    success: true,
    status: 'alive',
    message: 'CareerOS API process is alive',
  });
}

/**
 * Readiness probe endpoint.
 * Returns HTTP 200 when critical database connectivity is verified and ready to accept traffic.
 * Returns HTTP 503 when database connectivity is unavailable.
 */
export function getReadiness(_request, response) {
  const connected = isDatabaseConnected();
  const database = getDatabaseStatus();

  response.status(connected ? 200 : 503).json({
    success: connected,
    status: connected ? 'ready' : 'not_ready',
    message: connected ? 'CareerOS API is ready' : 'CareerOS API database is unavailable',
    database,
  });
}

/**
 * Legacy general health check endpoint (preserved for backward compatibility).
 */
export function getHealth(_request, response) {
  const database = getDatabaseStatus();
  const connected = isDatabaseConnected();

  response.status(connected ? 200 : 503).json({
    success: connected,
    message: connected ? 'CareerOS API is running' : 'CareerOS API database is unavailable',
    database,
  });
}
