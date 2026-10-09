import { sanitizeClientUrl } from '../config/env.js';

/**
 * Sanitizes error messages by scrubbing sensitive connection URI credentials or tokens.
 */
export function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return '';
  }
  return message
    .replace(/(mongodb(?:\+srv)?:\/\/)([^:@\s]+):([^@\s]+)@/gi, '$1[REDACTED]:[REDACTED]@')
    .replace(/(bearer\s+)([A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/gi, '$1[REDACTED]');
}

/**
 * Creates a graceful shutdown coordinator for HTTP servers and background processes.
 *
 * Required conceptual order:
 * 1. Stop accepting new HTTP connections (server.close)
 * 2. Close idle keep-alive connections (server.closeIdleConnections)
 * 3. Allow active requests to drain (await server.close callback)
 * 4. Stop background scheduling / invoke onShutdown hook
 * 5. Disconnect MongoDB (strictly after HTTP requests have completed)
 * 6. Exit cleanly with exit code
 */
export function createGracefulShutdownHandler(options = {}) {
  const {
    server = null,
    onShutdown = null,
    disconnectDb = null,
    timeoutMs = 10000,
    exitFn = process.exit,
    logger = console,
  } = options;

  let isShuttingDownState = false;
  let shutdownPromise = null;

  async function shutdown(signal = 'SIGTERM', err = null) {
    if (isShuttingDownState && shutdownPromise) {
      return shutdownPromise;
    }
    isShuttingDownState = true;

    shutdownPromise = (async () => {
      const isErrorShutdown = signal === 'uncaughtException' || signal === 'unhandledRejection';
      logger.log?.(`${signal} received. Initiating graceful shutdown.`);

      // Safety timeout: if cleanup exceeds timeoutMs, force exit
      const timer = setTimeout(async () => {
        logger.error?.(`Graceful shutdown timed out after ${timeoutMs}ms. Forcing process exit.`);
        try {
          if (typeof disconnectDb === 'function') {
            await disconnectDb();
          }
        } catch {
          // Ignore errors on forced exit
        }
        exitFn(1);
      }, timeoutMs);

      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }

      try {
        // 1 & 2 & 3. Close HTTP server and drain active requests
        if (server && typeof server.close === 'function') {
          if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
          }

          await new Promise((resolve) => {
            server.close((closeErr) => {
              if (closeErr) {
                logger.warn?.('Notice while closing HTTP server:', closeErr.message);
              }
              resolve();
            });
          });
          logger.log?.('HTTP server closed. In-flight requests drained.');
        }

        // 4. Custom cleanup / background task stop
        if (typeof onShutdown === 'function') {
          await onShutdown(signal, err);
        }

        // 5. Disconnect database ONLY after active HTTP requests have finished
        if (typeof disconnectDb === 'function') {
          await disconnectDb();
          logger.log?.('Database disconnected cleanly.');
        }

        clearTimeout(timer);
        exitFn(isErrorShutdown ? 1 : 0);
      } catch (shutdownErr) {
        clearTimeout(timer);
        logger.error?.('Error during graceful shutdown:', sanitizeErrorMessage(shutdownErr?.message));
        exitFn(1);
      }
    })();

    return shutdownPromise;
  }

  return {
    shutdown,
    isShuttingDown: () => isShuttingDownState,
  };
}

/**
 * Registers process-level signal listeners and unhandled error handlers.
 */
export function setupProcessHandlers(shutdownHandler, options = {}) {
  const { logger = console } = options;
  let isHandlingFatal = false;

  const handleFatal = (type, err) => {
    if (isHandlingFatal) {
      return;
    }
    isHandlingFatal = true;
    logger.error?.(`Fatal ${type} encountered:`, {
      name: err?.name || 'Error',
      message: sanitizeErrorMessage(err?.message || String(err)),
    });

    shutdownHandler.shutdown(type, err).catch(() => {
      process.exit(1);
    });
  };

  const onSigterm = () => shutdownHandler.shutdown('SIGTERM');
  const onSigint = () => shutdownHandler.shutdown('SIGINT');
  const onUncaught = (err) => handleFatal('uncaughtException', err);
  const onUnhandled = (reason) => handleFatal('unhandledRejection', reason);

  process.on('SIGTERM', onSigterm);
  process.on('SIGINT', onSigint);
  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onUnhandled);

  return () => {
    process.off('SIGTERM', onSigterm);
    process.off('SIGINT', onSigint);
    process.off('uncaughtException', onUncaught);
    process.off('unhandledRejection', onUnhandled);
  };
}
