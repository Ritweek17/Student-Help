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

export async function shutdown(signal = 'SIGTERM') {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[ReminderWorker] ${signal} received. Initiating graceful shutdown.`);

  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }

  // Wait for currently active cycle to finish if running
  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  try {
    await disconnectDatabase();
    console.log('[ReminderWorker] Database connection closed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('[ReminderWorker] Error disconnecting database during shutdown:', err);
    process.exit(1);
  }
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
  startWorker();
}
