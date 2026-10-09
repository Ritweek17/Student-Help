import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../src/models/OpportunityIngestionRun.js';
import {
  acquireSourceLock,
  releaseSourceLock,
} from '../../src/services/ingestion/ingestion.service.js';
import {
  runIngestionCycle,
  getPollIntervalMs,
  ADAPTER_REGISTRY,
  MAX_ITEMS_PER_SOURCE,
} from '../../src/workers/ingestion.worker.js';

describe('Ingestion Worker Test Suite (MongoMemoryReplSet)', () => {
  let setTimeoutSpy;
  const activeTimers = [];

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      Opportunity.init(),
      OpportunitySource.init(),
      OpportunityIngestionRun.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // Prevent worker poll loop from scheduling persistent real timers
    const originalSetTimeout = global.setTimeout;
    setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((fn, ms, ...args) => {
      if (typeof ms === 'number' && ms >= 60000) {
        return 999999;
      }
      const id = originalSetTimeout(fn, ms, ...args);
      activeTimers.push(id);
      return id;
    });
  });

  afterEach(() => {
    if (setTimeoutSpy) {
      setTimeoutSpy.mockRestore();
    }
    activeTimers.forEach((id) => clearTimeout(id));
    activeTimers.length = 0;
  });

  describe('1. Polling Interval Configuration (getPollIntervalMs)', () => {
    it('defaults to 60 minutes (3,600,000 ms) for undefined, null, or empty string', () => {
      expect(getPollIntervalMs(undefined)).toBe(60 * 60 * 1000);
      expect(getPollIntervalMs(null)).toBe(60 * 60 * 1000);
      expect(getPollIntervalMs('')).toBe(60 * 60 * 1000);
    });

    it('parses valid numeric and string minutes correctly', () => {
      expect(getPollIntervalMs('10')).toBe(10 * 60 * 1000);
      expect(getPollIntervalMs(15)).toBe(15 * 60 * 1000);
    });

    it('clamps values below 5 minutes to the 5-minute minimum (300,000 ms)', () => {
      expect(getPollIntervalMs('2')).toBe(5 * 60 * 1000);
      expect(getPollIntervalMs(0)).toBe(5 * 60 * 1000);
      expect(getPollIntervalMs('-10')).toBe(5 * 60 * 1000);
    });

    it('falls back safely to 60 minutes for invalid non-numeric inputs', () => {
      expect(getPollIntervalMs('invalid_str')).toBe(60 * 60 * 1000);
      expect(getPollIntervalMs('NaN')).toBe(60 * 60 * 1000);
      expect(getPollIntervalMs(Infinity)).toBe(60 * 60 * 1000);
    });
  });

  describe('2. Distributed Source Lock Acquisition, Ownership & Reclamation', () => {
    it('allows a worker to acquire an unlocked source and records ownership', async () => {
      const source = await OpportunitySource.create({
        name: 'Lock Source A',
        slug: 'lock-source-a',
        type: 'api',
        baseUrl: 'https://lock-a.test',
        enabled: true,
      });

      const workerA = randomUUID();
      const acquired = await acquireSourceLock(source._id, workerA, 30);
      expect(acquired).toBe(true);

      const refreshed = await OpportunitySource.findById(source._id);
      expect(refreshed.isLocked).toBe(true);
      expect(refreshed.lockedBy).toBe(workerA);
      expect(refreshed.lockedAt).toBeInstanceOf(Date);
    });

    it('prevents another worker from acquiring an actively locked source', async () => {
      const source = await OpportunitySource.create({
        name: 'Lock Source B',
        slug: 'lock-source-b',
        type: 'api',
        baseUrl: 'https://lock-b.test',
        enabled: true,
      });

      const workerA = randomUUID();
      const workerB = randomUUID();

      await acquireSourceLock(source._id, workerA, 30);
      const acquiredByB = await acquireSourceLock(source._id, workerB, 30);

      expect(acquiredByB).toBe(false);

      const refreshed = await OpportunitySource.findById(source._id);
      expect(refreshed.lockedBy).toBe(workerA);
    });

    it('prevents unauthorized worker from releasing a lock owned by another worker', async () => {
      const source = await OpportunitySource.create({
        name: 'Lock Source C',
        slug: 'lock-source-c',
        type: 'api',
        baseUrl: 'https://lock-c.test',
        enabled: true,
      });

      const workerA = randomUUID();
      const workerB = randomUUID();

      await acquireSourceLock(source._id, workerA, 30);
      const releasedByB = await releaseSourceLock(source._id, workerB);

      expect(releasedByB).toBe(false);

      const refreshed = await OpportunitySource.findById(source._id);
      expect(refreshed.isLocked).toBe(true);
      expect(refreshed.lockedBy).toBe(workerA);
    });

    it('allows lock owner to release its own lock cleanly', async () => {
      const source = await OpportunitySource.create({
        name: 'Lock Source D',
        slug: 'lock-source-d',
        type: 'api',
        baseUrl: 'https://lock-d.test',
        enabled: true,
      });

      const workerA = randomUUID();
      await acquireSourceLock(source._id, workerA, 30);
      const releasedByA = await releaseSourceLock(source._id, workerA);

      expect(releasedByA).toBe(true);

      const refreshed = await OpportunitySource.findById(source._id);
      expect(refreshed.isLocked).toBe(false);
      expect(refreshed.lockedBy).toBeNull();
      expect(refreshed.lockedAt).toBeNull();
    });

    it('reclaims stale locks (>30m old) safely for a new worker', async () => {
      const source = await OpportunitySource.create({
        name: 'Lock Source E',
        slug: 'lock-source-e',
        type: 'api',
        baseUrl: 'https://lock-e.test',
        enabled: true,
        isLocked: true,
        lockedBy: 'stale-worker-id',
        lockedAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago (stale)
      });

      const workerB = randomUUID();
      const reclaimed = await acquireSourceLock(source._id, workerB, 30);

      expect(reclaimed).toBe(true);

      const refreshed = await OpportunitySource.findById(source._id);
      expect(refreshed.isLocked).toBe(true);
      expect(refreshed.lockedBy).toBe(workerB);

      // Clean release
      await releaseSourceLock(source._id, workerB);
    });
  });

  describe('3. Worker Orchestration & Ingestion Cycle Execution', () => {
    it('skips disabled sources, fails missing adapters safely, and processes registered adapters', async () => {
      const sourceDisabled = await OpportunitySource.create({
        name: 'Disabled Source',
        slug: 'remotive',
        type: 'api',
        baseUrl: 'https://remotive.test',
        enabled: false,
        priority: 10,
      });

      const sourceMissingAdapter = await OpportunitySource.create({
        name: 'Unknown API Source',
        slug: 'unknown-adapter-slug',
        type: 'api',
        baseUrl: 'https://unknown.test',
        enabled: true,
        priority: 5,
      });

      const sourceGood = await OpportunitySource.create({
        name: 'Mock Source Good',
        slug: 'test-mock-adapter',
        type: 'api',
        baseUrl: 'https://mock.test',
        enabled: true,
        priority: 1,
      });

      // Register temporary mock adapter in ADAPTER_REGISTRY
      class MockTestAdapter {
        constructor(config) {
          this.config = config;
        }
        async fetchOpportunities({ limit }) {
          return [
            {
              id: 'job-1',
              title: 'Worker Test Software Engineer',
              organization: 'Mock Corp',
              type: 'internship',
              description: 'Long description for worker test software engineer 12345',
              applicationUrl: 'https://mock.test/jobs/1',
            },
            {
              id: 'job-2',
              title: 'Worker Test Frontend Intern',
              organization: 'Mock Corp',
              type: 'internship',
              description: 'Long description for worker test frontend intern 12345',
              applicationUrl: 'https://mock.test/jobs/2',
            },
          ];
        }
        normalize(rawItem) {
          return {
            title: rawItem.title,
            organization: rawItem.organization,
            type: rawItem.type,
            description: rawItem.description,
            applicationUrl: rawItem.applicationUrl,
            externalId: rawItem.id,
          };
        }
      }

      ADAPTER_REGISTRY['test-mock-adapter'] = MockTestAdapter;

      try {
        await runIngestionCycle();

        // 1. Verify disabled source was untouched
        const disabledCheck = await OpportunitySource.findById(sourceDisabled._id);
        expect(disabledCheck.isLocked).toBe(false);
        const disabledRuns = await OpportunityIngestionRun.find({ sourceId: sourceDisabled._id });
        expect(disabledRuns.length).toBe(0);

        // 2. Verify missing adapter source created a failed run and released lock
        const missingRuns = await OpportunityIngestionRun.find({ sourceId: sourceMissingAdapter._id });
        expect(missingRuns.length).toBe(1);
        expect(missingRuns[0].status).toBe('failed');
        expect(missingRuns[0].errorMessage).toBe('No adapter registered for source');

        const missingSourceCheck = await OpportunitySource.findById(sourceMissingAdapter._id);
        expect(missingSourceCheck.isLocked).toBe(false);
        expect(missingSourceCheck.lockedBy).toBeNull();

        // 3. Verify good source completed run, processed items, released lock, updated lastSuccessAt
        const goodRuns = await OpportunityIngestionRun.find({ sourceId: sourceGood._id });
        expect(goodRuns.length).toBe(1);
        expect(goodRuns[0].status).toBe('completed');
        expect(goodRuns[0].createdCount).toBe(2);
        expect(goodRuns[0].fetchedCount).toBe(2);

        const goodSourceCheck = await OpportunitySource.findById(sourceGood._id);
        expect(goodSourceCheck.isLocked).toBe(false);
        expect(goodSourceCheck.lockedBy).toBeNull();
        expect(goodSourceCheck.lastSuccessAt).toBeInstanceOf(Date);

        // Verify items were persisted in DB
        const persistedItems = await Opportunity.find({ sourceRef: sourceGood._id });
        expect(persistedItems.length).toBe(2);
      } finally {
        delete ADAPTER_REGISTRY['test-mock-adapter'];
      }
    });

    it('handles partial failures when some items are invalid and marks run partial', async () => {
      const sourcePartial = await OpportunitySource.create({
        name: 'Partial Adapter Source',
        slug: 'partial-mock-adapter',
        type: 'api',
        baseUrl: 'https://partial.test',
        enabled: true,
        priority: 10,
      });

      class PartialTestAdapter {
        constructor(config) {}
        async fetchOpportunities() {
          return [
            {
              id: 'part-1',
              title: 'Valid Item',
              organization: 'Valid Org',
              type: 'internship',
              description: 'Sufficiently long description for valid item 12345',
              applicationUrl: 'https://partial.test/1',
            },
            {
              id: 'part-2',
              // Invalid item: missing title and short description
              description: 'Short',
            },
          ];
        }
        normalize(rawItem) {
          return rawItem;
        }
      }

      ADAPTER_REGISTRY['partial-mock-adapter'] = PartialTestAdapter;

      try {
        await runIngestionCycle();

        const runs = await OpportunityIngestionRun.find({ sourceId: sourcePartial._id });
        expect(runs.length).toBe(1);
        expect(runs[0].status).toBe('partial');
        expect(runs[0].createdCount).toBe(1);
        expect(runs[0].fetchedCount).toBe(2);
        expect(runs[0].errorMessage).toContain('invalid items');

        const sourceCheck = await OpportunitySource.findById(sourcePartial._id);
        expect(sourceCheck.isLocked).toBe(false);
      } finally {
        delete ADAPTER_REGISTRY['partial-mock-adapter'];
      }
    });

    it('handles adapter fetch exception gracefully and marks run failed without crashing cycle', async () => {
      const sourceCrashing = await OpportunitySource.create({
        name: 'Crashing Adapter Source',
        slug: 'crashing-mock-adapter',
        type: 'api',
        baseUrl: 'https://crashing.test',
        enabled: true,
        priority: 10,
      });

      class CrashingTestAdapter {
        constructor(config) {}
        async fetchOpportunities() {
          throw new Error('Network timeout reaching upstream API');
        }
        normalize(rawItem) {
          return rawItem;
        }
      }

      ADAPTER_REGISTRY['crashing-mock-adapter'] = CrashingTestAdapter;

      try {
        await runIngestionCycle();

        const runs = await OpportunityIngestionRun.find({ sourceId: sourceCrashing._id });
        expect(runs.length).toBe(1);
        expect(runs[0].status).toBe('failed');
        expect(runs[0].errorMessage).toContain('Network timeout reaching upstream API');

        const sourceCheck = await OpportunitySource.findById(sourceCrashing._id);
        expect(sourceCheck.isLocked).toBe(false);
      } finally {
        delete ADAPTER_REGISTRY['crashing-mock-adapter'];
      }
    });
  });
});
