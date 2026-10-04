import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { randomUUID } from 'crypto';
import { BaseOpportunityAdapter } from '../services/ingestion/adapter.interface.js';
import { RemotiveAdapter } from '../services/ingestion/adapters/remotive.adapter.js';
import { HasjobAdapter } from '../services/ingestion/adapters/hasjob.adapter.js';
import { DevpostAdapter } from '../services/ingestion/adapters/devpost.adapter.js';
import { AdzunaAdapter } from '../services/ingestion/adapters/adzuna.adapter.js';
import {
  getEnabledSources,
  createIngestionRun,
  markRunSuccess,
  markRunPartial,
  markRunFailure,
  acquireSourceLock,
  releaseSourceLock
} from '../services/ingestion/ingestion.service.js';
import { processOpportunityItem } from '../services/ingestion/pipeline.service.js';

// The adapter registry maps Source schema slugs to their implementation classes.
export const ADAPTER_REGISTRY = {
  remotive: RemotiveAdapter,
  hasjob: HasjobAdapter,
  devpost: DevpostAdapter,
  adzuna: AdzunaAdapter
};

export const MAX_ITEMS_PER_SOURCE = 100;

/**
 * Parses and validates the polling interval in minutes.
 * - Defaults to 60 minutes.
 * - Clamps minimum to 5 minutes.
 */
export function getPollIntervalMs(envVal = process.env.INGESTION_INTERVAL_MINUTES) {
  if (envVal === undefined || envVal === null || envVal === '') {
    return 60 * 60 * 1000;
  }
  const parsed = Number(envVal);
  if (isNaN(parsed) || !Number.isFinite(parsed)) {
    return 60 * 60 * 1000;
  }
  if (parsed < 5) {
    return 5 * 60 * 1000;
  }
  return Math.floor(parsed * 60 * 1000);
}

let isRunning = false;
let isShuttingDown = false;
let timerHandle = null;

// Generate unique identifier for this worker instance to guarantee safe locking ownership
const WORKER_ID = randomUUID();

/**
 * Executes a single ingestion cycle across all enabled sources.
 * Exposed for scheduled execution and testing.
 */
export async function runIngestionCycle() {
  if (isShuttingDown || isRunning) {
    return;
  }

  isRunning = true;
  console.log(`[IngestionWorker:${WORKER_ID}] Starting ingestion cycle...`);

  try {
    const sources = await getEnabledSources();
    
    if (!sources || sources.length === 0) {
      console.log(`[IngestionWorker:${WORKER_ID}] No enabled sources found.`);
      return;
    }

    for (const source of sources) {
      if (isShuttingDown) break;

      // 1. Acquire Lock
      const lockAcquired = await acquireSourceLock(source._id, WORKER_ID, 30);
      if (!lockAcquired) {
        console.log(`[IngestionWorker:${WORKER_ID}] Source ${source.slug} is locked. Skipping.`);
        continue;
      }

      console.log(`[IngestionWorker:${WORKER_ID}] Acquired lock for source: ${source.slug}`);

      let runId = null;
      try {
        // 2. Create Ingestion Run
        const run = await createIngestionRun(source._id, { workerId: WORKER_ID });
        runId = run._id;

        // 3. Resolve Adapter
        const AdapterClass = ADAPTER_REGISTRY[source.slug];
        if (!AdapterClass) {
          console.warn(`[IngestionWorker:${WORKER_ID}] No adapter registered for source: ${source.slug}`);
          await markRunFailure(runId, 'No adapter registered for source');
          continue; // Move to finally block to release lock
        }

        const adapter = new AdapterClass(source);

        // 4. Fetch Opportunities
        const rawItems = await adapter.fetchOpportunities({ limit: MAX_ITEMS_PER_SOURCE });
        
        let fetchedCount = rawItems.length;
        let createdCount = 0;
        let updatedCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        // 5. Process through Pipeline
        for (const rawItem of rawItems) {
          if (isShuttingDown) break;

          try {
            const result = await processOpportunityItem({
              rawItem: adapter.normalize(rawItem),
              source,
              ingestionRunId: runId
            });

            if (result.status === 'success') {
              if (result.action === 'created') createdCount++;
              else if (result.action === 'updated') updatedCount++;
            } else if (result.status === 'duplicate') {
              duplicateCount++;
            } else if (result.status === 'invalid') {
              invalidCount++;
            } else if (result.status === 'failed') {
              failedCount++;
            } else {
              skippedCount++;
            }
          } catch (itemErr) {
            console.error(`[IngestionWorker:${WORKER_ID}] Error processing item from ${source.slug}:`, itemErr.message);
            failedCount++;
          }
        }

        const counters = {
          fetchedCount, createdCount, updatedCount,
          duplicateCount, invalidCount, failedCount, skippedCount
        };

        // 6. Update Run Status
        if (failedCount > 0 || invalidCount > 0) {
          await markRunPartial(runId, 'Completed with some item failures or invalid items', counters);
        } else {
          await markRunSuccess(runId, counters);
        }

        console.log(`[IngestionWorker:${WORKER_ID}] Finished source ${source.slug}: fetched ${fetchedCount}, created ${createdCount}, updated ${updatedCount}`);

      } catch (sourceErr) {
        console.error(`[IngestionWorker:${WORKER_ID}] Fatal error processing source ${source.slug}:`, sourceErr.message);
        if (runId) {
          await markRunFailure(runId, sourceErr.message || 'Unknown fatal source error');
        }
      } finally {
        // 7. Ownership-safe Lock Release
        const released = await releaseSourceLock(source._id, WORKER_ID);
        if (released) {
          console.log(`[IngestionWorker:${WORKER_ID}] Released lock for source: ${source.slug}`);
        } else {
          console.error(`[IngestionWorker:${WORKER_ID}] Failed to release lock for source ${source.slug} - Ownership mismatch or lost lock.`);
        }
      }
    }
  } catch (cycleErr) {
    console.error(`[IngestionWorker:${WORKER_ID}] Cycle execution error:`, cycleErr.message);
  } finally {
    isRunning = false;
    if (!isShuttingDown) {
      const pollIntervalMs = getPollIntervalMs();
      timerHandle = setTimeout(runIngestionCycle, pollIntervalMs);
    }
  }
}

export async function shutdown(signal = 'SIGTERM') {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`[IngestionWorker:${WORKER_ID}] ${signal} received. Initiating graceful shutdown.`);

  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }

  // Wait for currently active cycle to finish if running
  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  try {
    await disconnectDatabase();
    console.log(`[IngestionWorker:${WORKER_ID}] Database connection closed cleanly.`);
    process.exit(0);
  } catch (err) {
    console.error(`[IngestionWorker:${WORKER_ID}] Error disconnecting database during shutdown:`, err);
    process.exit(1);
  }
}

export async function startWorker() {
  try {
    await connectDatabase();
    const pollIntervalMs = getPollIntervalMs();
    console.log(`[IngestionWorker:${WORKER_ID}] Started successfully. Polling interval: ${pollIntervalMs}ms`);

    // Run first cycle immediately
    await runIngestionCycle();
  } catch (error) {
    console.error(`[IngestionWorker:${WORKER_ID}] Failed to start:`, error.message);
    process.exit(1);
  }
}

// Auto-start only when directly invoked as the main script
if (process.argv[1] && process.argv[1].endsWith('ingestion.worker.js')) {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  startWorker();
}
