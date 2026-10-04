import { OpportunitySource } from '../../models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../models/OpportunityIngestionRun.js';

/**
 * Retrieve all enabled opportunity sources ordered by priority descending.
 */
export async function getEnabledSources() {
  return OpportunitySource.find({ enabled: true })
    .sort({ priority: -1, createdAt: 1 })
    .lean();
}

/**
 * Initialize and record an ingestion run for a source.
 * Sets status to 'running', records startedAt, and updates source's lastRunAt.
 *
 * @param {string|ObjectId} sourceId - OpportunitySource ID
 * @param {Object} [metadata] - Non-sensitive execution metadata
 * @returns {Promise<OpportunityIngestionRun>} Created ingestion run record
 */
export async function createIngestionRun(sourceId, metadata = {}) {
  const source = await OpportunitySource.findById(sourceId);
  if (!source) {
    throw new Error('Opportunity source not found');
  }

  const startedAt = new Date();

  const run = await OpportunityIngestionRun.create({
    sourceId,
    status: 'running',
    startedAt,
    metadata,
  });

  source.lastRunAt = startedAt;
  await source.save();

  return run;
}

/**
 * Mark an ingestion run as completed successfully.
 * Updates counters, completedAt, and source's lastSuccessAt.
 *
 * @param {string|ObjectId} runId - Ingestion run ID
 * @param {Object} [counters] - Operational metrics (fetched, created, updated, etc.)
 * @param {Object} [metadata] - Additional execution metadata to merge
 * @returns {Promise<OpportunityIngestionRun>} Updated run document
 */
export async function markRunSuccess(runId, counters = {}, metadata = {}) {
  const run = await OpportunityIngestionRun.findById(runId);
  if (!run) {
    throw new Error('Opportunity ingestion run not found');
  }

  const completedAt = new Date();
  run.status = 'completed';
  run.completedAt = completedAt;

  if (counters.fetchedCount !== undefined) run.fetchedCount = counters.fetchedCount;
  if (counters.createdCount !== undefined) run.createdCount = counters.createdCount;
  if (counters.updatedCount !== undefined) run.updatedCount = counters.updatedCount;
  if (counters.skippedCount !== undefined) run.skippedCount = counters.skippedCount;
  if (counters.failedCount !== undefined) run.failedCount = counters.failedCount;

  if (metadata && Object.keys(metadata).length > 0) {
    run.metadata = { ...(run.metadata || {}), ...metadata };
  }

  await run.save();

  // Update source success timestamp
  await OpportunitySource.findByIdAndUpdate(run.sourceId, {
    $set: { lastSuccessAt: completedAt },
  });

  return run;
}

/**
 * Mark an ingestion run as failed.
 * Records concise error message, updates counters, completedAt, and source's lastFailureAt/lastError.
 *
 * @param {string|ObjectId} runId - Ingestion run ID
 * @param {string} errorMessage - Concise operational error summary (no stack traces or secrets)
 * @param {Object} [counters] - Operational metrics
 * @param {Object} [metadata] - Additional metadata
 * @returns {Promise<OpportunityIngestionRun>} Updated run document
 */
export async function markRunFailure(runId, errorMessage, counters = {}, metadata = {}) {
  const run = await OpportunityIngestionRun.findById(runId);
  if (!run) {
    throw new Error('Opportunity ingestion run not found');
  }

  const completedAt = new Date();
  const cleanError = errorMessage ? String(errorMessage).trim() : 'Unknown ingestion error';

  run.status = 'failed';
  run.completedAt = completedAt;
  run.errorMessage = cleanError;

  if (counters.fetchedCount !== undefined) run.fetchedCount = counters.fetchedCount;
  if (counters.createdCount !== undefined) run.createdCount = counters.createdCount;
  if (counters.updatedCount !== undefined) run.updatedCount = counters.updatedCount;
  if (counters.skippedCount !== undefined) run.skippedCount = counters.skippedCount;
  if (counters.failedCount !== undefined) run.failedCount = counters.failedCount;

  if (metadata && Object.keys(metadata).length > 0) {
    run.metadata = { ...(run.metadata || {}), ...metadata };
  }

  await run.save();

  // Update source failure metadata
  await OpportunitySource.findByIdAndUpdate(run.sourceId, {
    $set: {
      lastFailureAt: completedAt,
      lastError: cleanError,
    },
  });

  return run;
}

/**
 * Mark an ingestion run as partially completed.
 * Records status as 'partial' and does not mark source as fully successful.
 *
 * @param {string|ObjectId} runId - Ingestion run ID
 * @param {string} [errorMessage] - Summary of partial issues
 * @param {Object} [counters] - Operational metrics
 * @param {Object} [metadata] - Additional metadata
 * @returns {Promise<OpportunityIngestionRun>} Updated run document
 */
export async function markRunPartial(runId, errorMessage, counters = {}, metadata = {}) {
  const run = await OpportunityIngestionRun.findById(runId);
  if (!run) {
    throw new Error('Opportunity ingestion run not found');
  }

  const completedAt = new Date();
  run.status = 'partial';
  run.completedAt = completedAt;
  if (errorMessage) {
    run.errorMessage = String(errorMessage).trim();
  }

  if (counters.fetchedCount !== undefined) run.fetchedCount = counters.fetchedCount;
  if (counters.createdCount !== undefined) run.createdCount = counters.createdCount;
  if (counters.updatedCount !== undefined) run.updatedCount = counters.updatedCount;
  if (counters.skippedCount !== undefined) run.skippedCount = counters.skippedCount;
  if (counters.failedCount !== undefined) run.failedCount = counters.failedCount;

  if (metadata && Object.keys(metadata).length > 0) {
    run.metadata = { ...(run.metadata || {}), ...metadata };
  }

  await run.save();
  return run;
}

/**
 * Atomically acquire a lock on an OpportunitySource.
 * Allows acquisition if unlocked OR if the previous lock is older than staleThresholdMinutes.
 * 
 * @param {string|ObjectId} sourceId - OpportunitySource ID
 * @param {string} workerId - Unique UUID identifying the worker acquiring the lock
 * @param {number} staleThresholdMinutes - Minutes before a lock is considered stale and can be reclaimed
 * @returns {Promise<boolean>} true if lock successfully acquired, false otherwise
 */
export async function acquireSourceLock(sourceId, workerId, staleThresholdMinutes = 30) {
  const staleDate = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

  const updatedSource = await OpportunitySource.findOneAndUpdate(
    {
      _id: sourceId,
      enabled: true,
      $or: [
        { isLocked: false },
        { isLocked: { $exists: false } },
        { lockedAt: { $lt: staleDate } }
      ]
    },
    {
      $set: {
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: workerId
      }
    },
    { new: true }
  );

  return !!updatedSource;
}

/**
 * Atomically release a lock on an OpportunitySource.
 * ONLY releases if the current lockedBy matches the provided workerId.
 * 
 * @param {string|ObjectId} sourceId - OpportunitySource ID
 * @param {string} workerId - Unique UUID identifying the worker releasing the lock
 * @returns {Promise<boolean>} true if lock was successfully released, false otherwise
 */
export async function releaseSourceLock(sourceId, workerId) {
  const updatedSource = await OpportunitySource.findOneAndUpdate(
    {
      _id: sourceId,
      isLocked: true,
      lockedBy: workerId
    },
    {
      $set: {
        isLocked: false,
        lockedAt: null,
        lockedBy: null
      }
    },
    { new: true }
  );

  return !!updatedSource;
}
