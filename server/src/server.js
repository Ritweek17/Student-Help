import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    await connectDatabase();
    server = app.listen(env.port, () => {
      console.log(`CareerOS API listening on port ${env.port}`);
    });
  } catch {
    console.error('CareerOS API did not start because MongoDB is unavailable.');
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Shutting down CareerOS API.`);

  const closeServer = server
    ? new Promise((resolve) => server.close(resolve))
    : Promise.resolve();

  try {
    await disconnectDatabase();
    await closeServer;
    process.exit(0);
  } catch (error) {
    console.error('CareerOS API shutdown encountered an error.', { name: error.name, code: error.code });
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
