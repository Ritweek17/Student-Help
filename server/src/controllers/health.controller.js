import { getDatabaseStatus, isDatabaseConnected } from '../config/db.js';

export function getHealth(_request, response) {
  const database = getDatabaseStatus();
  const connected = isDatabaseConnected();

  response.status(connected ? 200 : 503).json({
    success: connected,
    message: connected ? 'CareerOS API is running' : 'CareerOS API database is unavailable',
    database,
  });
}
