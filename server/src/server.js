import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`CareerOS API listening on port ${env.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down CareerOS API.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
