import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { OpportunitySource } from '../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../src/models/OpportunityIngestionRun.js';
import { acquireSourceLock, releaseSourceLock, createIngestionRun } from '../src/services/ingestion/ingestion.service.js';
import { runIngestionCycle, ADAPTER_REGISTRY } from '../src/workers/ingestion.worker.js';
import * as ingestionService from '../src/services/ingestion/ingestion.service.js';
import * as pipelineService from '../src/services/ingestion/pipeline.service.js';

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`  ❌ [FAIL ${totalCount}] ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ [PASS ${totalCount}] ${message}`);
    passedCount++;
  }
}

async function runTests() {
  console.log('\n====================================================');
  console.log('CAREEROS PHASE 8E — INGESTION WORKER VERIFICATION');
  console.log('====================================================\n');

  try {
    // We mock the database models to avoid requiring a real connection
    // Let's implement an in-memory mock for OpportunitySource and OpportunityIngestionRun

    let sourcesDb = [];
    let runsDb = [];

    OpportunitySource.find = () => ({
      sort: () => ({
        lean: async () => sourcesDb.filter(s => s.enabled)
      })
    });

    OpportunitySource.findById = async (id) => {
      const doc = sourcesDb.find(s => s._id.toString() === id.toString());
      if (doc) {
        return {
          ...doc,
          save: async function() {
            const idx = sourcesDb.findIndex(s => s._id.toString() === this._id.toString());
            if (idx > -1) sourcesDb[idx] = { ...this };
          }
        };
      }
      return null;
    };
    
    OpportunitySource.findOneAndUpdate = async (query, update, options) => {
      const sourceIndex = sourcesDb.findIndex(s => {
        let match = true;
        if (query._id && s._id.toString() !== query._id.toString()) match = false;
        if (query.enabled !== undefined && s.enabled !== query.enabled) match = false;
        if (query.isLocked === true && s.isLocked !== true) match = false;
        if (query.lockedBy && s.lockedBy !== query.lockedBy) match = false;
        
        // Complex OR for locking
        if (query.$or) {
          const orMatch = query.$or.some(orClause => {
            if (orClause.isLocked === false && s.isLocked === false) return true;
            if (orClause.isLocked && orClause.isLocked.$exists === false && s.isLocked === undefined) return true;
            if (orClause.lockedAt && orClause.lockedAt.$lt && s.lockedAt < orClause.lockedAt.$lt) return true;
            return false;
          });
          if (!orMatch) match = false;
        }
        return match;
      });

      if (sourceIndex === -1) return null;

      const source = sourcesDb[sourceIndex];
      const updatedSource = { ...source };

      if (update.$set) {
        Object.assign(updatedSource, update.$set);
      }

      sourcesDb[sourceIndex] = updatedSource;
      return updatedSource;
    };

    OpportunitySource.findByIdAndUpdate = async (id, update) => {
      const sourceIndex = sourcesDb.findIndex(s => s._id.toString() === id.toString());
      if (sourceIndex > -1) {
        if (update.$set) Object.assign(sourcesDb[sourceIndex], update.$set);
        return sourcesDb[sourceIndex];
      }
      return null;
    };

    OpportunityIngestionRun.create = async (doc) => {
      const newDoc = { _id: new mongoose.Types.ObjectId(), ...doc };
      runsDb.push(newDoc);
      return {
        ...newDoc,
        save: async function() {
          const idx = runsDb.findIndex(r => r._id.toString() === this._id.toString());
          if (idx > -1) runsDb[idx] = { ...this };
        }
      };
    };

    OpportunityIngestionRun.findById = async (id) => {
      const doc = runsDb.find(r => r._id.toString() === id.toString());
      if (doc) {
        return {
          ...doc,
          save: async function() {
            const idx = runsDb.findIndex(r => r._id.toString() === this._id.toString());
            if (idx > -1) runsDb[idx] = { ...this };
          }
        };
      }
      return null;
    };

    console.log('--- 1. Lock Acquisition & Ownership ---');
    
    const testSourceId = new mongoose.Types.ObjectId();
    sourcesDb.push({
      _id: testSourceId,
      enabled: true,
      isLocked: false,
      lockedAt: null,
      lockedBy: null
    });

    const workerA = randomUUID();
    const workerB = randomUUID();

    let lockedByA = await acquireSourceLock(testSourceId, workerA, 30);
    assert(lockedByA, 'Worker A can acquire an unlocked source');
    assert(sourcesDb[0].isLocked === true && sourcesDb[0].lockedBy === workerA, 'Source reflects lock ownership of Worker A');

    let lockedByB = await acquireSourceLock(testSourceId, workerB, 30);
    assert(!lockedByB, 'Worker B cannot acquire the same active lock');

    let releasedByB = await releaseSourceLock(testSourceId, workerB);
    assert(!releasedByB, "Worker B cannot release Worker A's lock");
    assert(sourcesDb[0].isLocked === true && sourcesDb[0].lockedBy === workerA, 'Lock remains safely owned by Worker A');

    let releasedByA = await releaseSourceLock(testSourceId, workerA);
    assert(releasedByA, 'Worker A can release its own lock');
    assert(sourcesDb[0].isLocked === false && sourcesDb[0].lockedBy === null, 'Source lock state is cleanly cleared');

    // Stale lock reclamation
    sourcesDb[0].isLocked = true;
    sourcesDb[0].lockedBy = workerA;
    sourcesDb[0].lockedAt = new Date(Date.now() - 40 * 60 * 1000); // 40 minutes ago (stale)

    let reclaimedByB = await acquireSourceLock(testSourceId, workerB, 30);
    assert(reclaimedByB, 'Worker B safely reclaims a stale lock (>30m old)');
    assert(sourcesDb[0].isLocked === true && sourcesDb[0].lockedBy === workerB, 'Worker B now owns the lock');
    
    await releaseSourceLock(testSourceId, workerB);

    console.log('\n--- 2. Worker Orchestration & Missing Adapter Handling ---');
    
    const sourceGood = new mongoose.Types.ObjectId();
    const sourceMissingAdapter = new mongoose.Types.ObjectId();
    const sourceDisabled = new mongoose.Types.ObjectId();

    sourcesDb = [
      { _id: sourceDisabled, slug: 'remotive', enabled: false, priority: 10, isLocked: false },
      { _id: sourceMissingAdapter, slug: 'unknown-api', enabled: true, priority: 5, isLocked: false },
      { _id: sourceGood, slug: 'remotive-mock', enabled: true, priority: 1, isLocked: false }
    ];
    runsDb = [];

    // Mock an adapter for 'remotive-mock'
    class MockAdapter {
      constructor(config) {}
      async fetchOpportunities() {
        return [
          { id: 1, title: 'Valid Job 1', organization: 'Org A', description: 'Long description over 20 chars', applicationUrl: 'https://example.com/1' },
          { id: 2, title: 'Valid Job 2', organization: 'Org B', description: 'Long description over 20 chars', applicationUrl: 'https://example.com/2' }
        ];
      }
      normalize(rawItem) {
        return rawItem;
      }
    }
    ADAPTER_REGISTRY['remotive-mock'] = MockAdapter;

    // Mock the pipeline processor by mocking Opportunity model
    const { Opportunity } = await import('../src/models/Opportunity.js');
    const originalFindOne = Opportunity.findOne;
    const originalCreate = Opportunity.create;

    Opportunity.findOne = async () => null; // Always pretend new
    Opportunity.create = async (doc) => {
      return { _id: new mongoose.Types.ObjectId(), ...doc };
    };

    // Run the cycle
    await runIngestionCycle();

    // Restore Mongo mocks
    Opportunity.findOne = originalFindOne;
    Opportunity.create = originalCreate;

    assert(sourcesDb[0].isLocked === false, 'Disabled source was completely skipped (not locked)');
    
    // Check missing adapter behavior
    const missingRun = runsDb.find(r => r.sourceId.toString() === sourceMissingAdapter.toString());
    assert(missingRun, 'Run was created for unsupported source before adapter resolution');
    assert(missingRun && missingRun.status === 'failed', 'Missing adapter run marked as failed');
    assert(missingRun && missingRun.errorMessage === 'No adapter registered for source', 'Missing adapter reason explicitly logged');
    assert(sourcesDb[1].isLocked === false && sourcesDb[1].lockedBy === null, 'Missing adapter safely releases lock');
    
    // Check successful adapter behavior (proves cycle continued)
    const goodRun = runsDb.find(r => r.sourceId.toString() === sourceGood.toString());
    assert(goodRun, 'Subsequent source processed successfully after a missing adapter');
    assert(goodRun && goodRun.status === 'completed', 'Good source run marked as completed');
    assert(goodRun && goodRun.createdCount === 2, 'Metrics aggregated correctly (2 created)');
    assert(sourcesDb[2].isLocked === false && sourcesDb[2].lockedBy === null, 'Good source safely releases lock');
    assert(sourcesDb[2].lastSuccessAt instanceof Date, 'Source telemetry updated (lastSuccessAt)');

  } catch (error) {
    console.error('Fatal error in worker test suite:', error);
    process.exitCode = 1;
  }

  console.log('\n====================================================');
  if (process.exitCode === 1) {
    console.error(`❌ VERIFICATION FAILED: ${passedCount}/${totalCount} TEST SUITES PASSED`);
  } else {
    console.log(`✅ VERIFICATION COMPLETE: ALL ${totalCount} TEST SUITES PASSED!`);
  }
  console.log('====================================================\n');
}

runTests().then(() => {
  process.exit(process.exitCode || 0);
});
