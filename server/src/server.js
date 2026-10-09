import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { createGracefulShutdownHandler, setupProcessHandlers } from './utils/shutdown.js';
import { closeRedisClient } from './middleware/rateLimiter.js';

let server = null;
let shutdownCoordinator = null;

export async function shutdown(signal = 'SIGTERM', options = {}) {
  if (shutdownCoordinator) {
    return shutdownCoordinator.shutdown(signal);
  }
  const fallbackHandler = createGracefulShutdownHandler({
    server,
    onShutdown: async () => {
      await closeRedisClient();
    },
    disconnectDb: disconnectDatabase,
    timeoutMs: options.timeoutMs ?? (Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000),
    exitFn: options.exitFn ?? process.exit,
  });
  return fallbackHandler.shutdown(signal);
}

export async function startServer(port = env.port, options = {}) {
  try {
    await connectDatabase();
    server = app.listen(port, () => {
      console.log(`CareerOS API listening on port ${port}`);
    });

    shutdownCoordinator = createGracefulShutdownHandler({
      server,
      onShutdown: async () => {
        await closeRedisClient();
      },
      disconnectDb: disconnectDatabase,
      timeoutMs: options.timeoutMs ?? (Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000),
      exitFn: options.exitFn ?? process.exit,
    });

    if (options.registerProcessHandlers !== false) {
      setupProcessHandlers(shutdownCoordinator);
    }

    return server;
  } catch (error) {
    console.error('CareerOS API did not start because MongoDB is unavailable.', {
      name: error?.name,
      message: error?.message,
    });
    const exit = options.exitFn ?? process.exit;
    exit(1);
    return null;
  }
}

export function getServer() {
  return server;
}

// Auto-start when invoked directly as entrypoint
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

