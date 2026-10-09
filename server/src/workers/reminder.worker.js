import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { processDueReminders } from '../services/reminder.service.js';

/**
 * Parses and validates the polling interval in milliseconds.
 * - Defaults to 60000 ms.
 * - Clamps minimum to 1000 ms.
 * - Safely handles non-numeric, negative, or invalid strings.
 */
export function getPollInterval(envVal = process.env.REMINDER_POLL_INTERVAL_MS) {
  if (envVal === undefined || envVal === null || envVal === '') {
    return 60000;
  }

  const parsed = Number(envVal);
  if (isNaN(parsed) || !Number.isFinite(parsed)) {
    return 60000;
  }

  if (parsed < 1000) {
    return 1000;
  }

  return Math.floor(parsed);
}

let isRunning = false;
let isShuttingDown = false;
let timerHandle = null;

async function executeCycle() {
  if (isShuttingDown || isRunning) {
    return;
  }

  isRunning = true;
  try {
    const summary = await processDueReminders(new Date());
    if (summary.processed > 0) {
      console.log(
        `[ReminderWorker] Processed ${summary.processed} due event(s), created ${summary.notificationsCreated} notification(s)`
      );
    }
  } catch (error) {
    console.error('[ReminderWorker] Cycle execution error:', error.message);
  } finally {
    isRunning = false;
    if (!isShuttingDown) {
      const pollInterval = getPollInterval();
      timerHandle = setTimeout(executeCycle, pollInterval);
    }
  }
}

let shutdownPromise = null;

export function isWorkerShuttingDown() {
  return isShuttingDown;
}

export async function shutdown(signal = 'SIGTERM', options = {}) {
  if (isShuttingDown && shutdownPromise) {
    return shutdownPromise;
  }

  isShuttingDown = true;
  const timeoutMs = options.timeoutMs ?? (Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000);
  const exitFn = options.exitFn ?? process.exit;
  const disconnectDb = options.disconnectDb ?? disconnectDatabase;
  const isError = signal === 'uncaughtException' || signal === 'unhandledRejection';

  console.log(`[ReminderWorker] ${signal} received. Initiating graceful shutdown.`);

  shutdownPromise = (async () => {
    if (timerHandle) {
      clearTimeout(timerHandle);
      timerHandle = null;
    }

    // Wait for currently active cycle to finish with bounded safety timeout
    const startTime = Date.now();
    while (isRunning) {
      if (Date.now() - startTime >= timeoutMs) {
        console.warn(`[ReminderWorker] Active cycle did not finish within ${timeoutMs}ms. Forcing database disconnect.`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    try {
      if (typeof disconnectDb === 'function') {
        await disconnectDb();
      }
      console.log('[ReminderWorker] Database connection closed cleanly.');
      exitFn(isError ? 1 : 0);
    } catch (err) {
      console.error('[ReminderWorker] Error disconnecting database during shutdown:', err?.message || err);
      exitFn(1);
    }
  })();

  return shutdownPromise;
}

export async function startWorker() {
  try {
    await connectDatabase();
    const pollInterval = getPollInterval();
    console.log(`[ReminderWorker] Started successfully. Polling interval: ${pollInterval}ms`);

    // Run first cycle immediately
    await executeCycle();
  } catch (error) {
    console.error('[ReminderWorker] Failed to start:', error.message);
    process.exit(1);
  }
}

// Auto-start only when directly invoked as the main script
if (process.argv[1] && process.argv[1].endsWith('reminder.worker.js')) {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    console.error('[ReminderWorker] Fatal uncaughtException:', err?.message || err);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[ReminderWorker] Fatal unhandledRejection:', reason?.message || reason);
    shutdown('unhandledRejection');
  });
  startWorker();
}
