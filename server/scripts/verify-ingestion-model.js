import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { OpportunitySource, SOURCE_TYPES } from '../src/models/OpportunitySource.js';
import { OpportunityIngestionRun, INGESTION_RUN_STATUSES } from '../src/models/OpportunityIngestionRun.js';
import {
  BaseOpportunityAdapter,
  NORMALIZED_OPPORTUNITY_FIELDS,
  DEDUPLICATION_IDENTITY_PRIORITY,
} from '../src/services/ingestion/adapter.interface.js';
import {
  getEnabledSources,
  createIngestionRun,
  markRunSuccess,
  markRunFailure,
  markRunPartial,
} from '../src/services/ingestion/ingestion.service.js';
import {
  validateOpportunitySource,
  validateIngestionRunStatus,
  validateIngestionCounters,
} from '../src/validators/ingestion.validator.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 4.8.1 OPPORTUNITY INGESTION ARCHITECTURE VERIFICATION ---');

  await connectDatabase();
  try {
    await OpportunitySource.collection.dropIndex('slug_1');
  } catch (e) {}
  await OpportunitySource.syncIndexes();
  await OpportunityIngestionRun.syncIndexes();

  let createdSourceIds = [];
  let createdRunIds = [];

  try {
    const timestamp = Date.now();

    // ----------------------------------------------------
    // TEST 1: OpportunitySource creation
    // ----------------------------------------------------
    console.log('\n--- Test 1: OpportunitySource creation ---');
    const source1 = await OpportunitySource.create({
      name: 'GitHub Jobs API',
      slug: `github-${timestamp}`,
      type: 'api',
      baseUrl: 'https://api.github.com',
      priority: 10,
    });
    createdSourceIds.push(source1._id);
    assert(source1._id, 'Source should be created with an _id');
    assert(source1.name === 'GitHub Jobs API', 'Name should match');
    assert(source1.type === 'api', 'Type should match');
    console.log('✅ Test 1 passed');

    // ----------------------------------------------------
    // TEST 2: Required name validation
    // ----------------------------------------------------
    console.log('\n--- Test 2: Required name validation ---');
    let nameErrCaught = false;
    try {
      await OpportunitySource.create({
        slug: `no-name-${timestamp}`,
        type: 'scraper',
      });
    } catch (e) {
      nameErrCaught = true;
    }
    assert(nameErrCaught, 'Missing name must fail validation');
    const valName = validateOpportunitySource({ slug: 'test', type: 'api' });
    assert(valName.error && valName.error.includes('name'), 'Validator rejects missing name');
    console.log('✅ Test 2 passed');

    // ----------------------------------------------------
    // TEST 3: Slug validation (letters, numbers, hyphens only)
    // ----------------------------------------------------
    console.log('\n--- Test 3: Slug validation ---');
    let badSlugErr = false;
    try {
      await OpportunitySource.create({
        name: 'Bad Slug',
        slug: 'Invalid Slug With Spaces!',
        type: 'api',
      });
    } catch (e) {
      badSlugErr = true;
    }
    assert(badSlugErr, 'Schema rejects invalid slug with spaces and special chars');
    const valSlug = validateOpportunitySource({ name: 'Valid', slug: 'Bad Slug!', type: 'api' });
    assert(valSlug.error && valSlug.error.includes('slug'), 'Validator rejects invalid slug');
    console.log('✅ Test 3 passed');

    // ----------------------------------------------------
    // TEST 4: Lowercase slug normalization
    // ----------------------------------------------------
    console.log('\n--- Test 4: Lowercase slug normalization ---');
    const upperSlug = `DEVPOST-SOURCE-${timestamp}`;
    const source2 = await OpportunitySource.create({
      name: 'Devpost Hackathons',
      slug: upperSlug,
      type: 'scraper',
    });
    createdSourceIds.push(source2._id);
    assert(source2.slug === upperSlug.toLowerCase(), 'Slug must be lowercased');
    console.log('✅ Test 4 passed');

    // ----------------------------------------------------
    // TEST 5: Duplicate slug rejected
    // ----------------------------------------------------
    console.log('\n--- Test 5: Duplicate slug rejected ---');
    let dupSlugCaught = false;
    try {
      await OpportunitySource.create({
        name: 'Duplicate Source',
        slug: source1.slug,
        type: 'api',
      });
    } catch (e) {
      if (e.code === 11000) dupSlugCaught = true;
    }
    assert(dupSlugCaught, 'Duplicate slug must trigger unique index E11000 error');
    console.log('✅ Test 5 passed');

    // ----------------------------------------------------
    // TEST 6: Valid source types accepted
    // ----------------------------------------------------
    console.log('\n--- Test 6: Valid source types accepted ---');
    for (const t of ['api', 'rss', 'feed', 'scraper']) {
      assert(SOURCE_TYPES.includes(t), `Type ${t} must be valid`);
      const valT = validateOpportunitySource({ name: `Test ${t}`, slug: `test-${t}-${timestamp}`, type: t });
      assert(!valT.error, `Validator should accept ${t}`);
    }
    console.log('✅ Test 6 passed');

    // ----------------------------------------------------
    // TEST 7: Invalid source type rejected
    // ----------------------------------------------------
    console.log('\n--- Test 7: Invalid source type rejected ---');
    let badTypeCaught = false;
    try {
      await OpportunitySource.create({
        name: 'Bad Type Source',
        slug: `bad-type-${timestamp}`,
        type: 'invalid_type',
      });
    } catch (e) {
      badTypeCaught = true;
    }
    assert(badTypeCaught, 'Schema rejects invalid source type');
    const valBadType = validateOpportunitySource({ name: 'Test', slug: 'slug-t', type: 'ftp_scraper' });
    assert(valBadType.error && valBadType.error.includes('type'), 'Validator rejects invalid source type');
    console.log('✅ Test 7 passed');

    // ----------------------------------------------------
    // TEST 8 & 9: Valid HTTP and HTTPS URLs accepted
    // ----------------------------------------------------
    console.log('\n--- Test 8 & 9: Valid HTTP and HTTPS URLs accepted ---');
    const httpSource = await OpportunitySource.create({
      name: 'HTTP Source',
      slug: `http-src-${timestamp}`,
      type: 'rss',
      baseUrl: 'http://example.com/rss',
    });
    createdSourceIds.push(httpSource._id);
    assert(httpSource.baseUrl === 'http://example.com/rss', 'HTTP URL accepted');

    const httpsSource = await OpportunitySource.create({
      name: 'HTTPS Source',
      slug: `https-src-${timestamp}`,
      type: 'api',
      baseUrl: 'https://example.com/api',
    });
    createdSourceIds.push(httpsSource._id);
    assert(httpsSource.baseUrl === 'https://example.com/api', 'HTTPS URL accepted');
    console.log('✅ Test 8 & 9 passed');

    // ----------------------------------------------------
    // TEST 10: Unsafe URL rejected (javascript:, file:, ftp:, etc.)
    // ----------------------------------------------------
    console.log('\n--- Test 10: Unsafe URL rejected ---');
    const unsafeUrls = [
      'javascript:alert(1)',
      'data:text/html,test',
      'file:///etc/passwd',
      'ftp://ftp.example.com',
      'not a url',
    ];
    for (const u of unsafeUrls) {
      let unsafeCaught = false;
      try {
        await OpportunitySource.create({
          name: 'Unsafe URL Test',
          slug: `unsafe-${Date.now()}`,
          type: 'api',
          baseUrl: u,
        });
      } catch (e) {
        unsafeCaught = true;
      }
      assert(unsafeCaught, `Schema must reject unsafe URL '${u}'`);
      const valU = validateOpportunitySource({ name: 'Test', slug: 'test-u', type: 'api', baseUrl: u });
      assert(valU.error, `Validator must reject unsafe URL '${u}'`);
    }
    console.log('✅ Test 10 passed');

    // ----------------------------------------------------
    // TEST 11: Enabled defaults true
    // ----------------------------------------------------
    console.log('\n--- Test 11: Enabled defaults true ---');
    assert(source1.enabled === true, 'enabled should default to true');
    console.log('✅ Test 11 passed');

    // ----------------------------------------------------
    // TEST 12: Priority defaults 0
    // ----------------------------------------------------
    console.log('\n--- Test 12: Priority defaults 0 ---');
    const defaultPriSource = await OpportunitySource.create({
      name: 'Default Priority',
      slug: `def-pri-${timestamp}`,
      type: 'feed',
    });
    createdSourceIds.push(defaultPriSource._id);
    assert(defaultPriSource.priority === 0, 'priority should default to 0');
    console.log('✅ Test 12 passed');

    // ----------------------------------------------------
    // TEST 13: Negative priority rejected
    // ----------------------------------------------------
    console.log('\n--- Test 13: Negative priority rejected ---');
    let negPriCaught = false;
    try {
      await OpportunitySource.create({
        name: 'Neg Priority',
        slug: `neg-pri-${timestamp}`,
        type: 'api',
        priority: -5,
      });
    } catch (e) {
      negPriCaught = true;
    }
    assert(negPriCaught, 'Schema must reject negative priority');
    const valPri = validateOpportunitySource({ name: 'Test', slug: 'pri-t', type: 'api', priority: -1 });
    assert(valPri.error && valPri.error.includes('Priority'), 'Validator rejects negative priority');
    console.log('✅ Test 13 passed');

    // ----------------------------------------------------
    // TEST 14: lastRun metadata updates
    // ----------------------------------------------------
    console.log('\n--- Test 14: lastRun metadata updates ---');
    const runDate = new Date();
    source1.lastRunAt = runDate;
    source1.lastSuccessAt = runDate;
    source1.lastFailureAt = runDate;
    source1.lastError = 'Operational network timeout';
    await source1.save();

    const fetchedSource1 = await OpportunitySource.findById(source1._id);
    assert(fetchedSource1.lastRunAt, 'lastRunAt should be set');
    assert(fetchedSource1.lastSuccessAt, 'lastSuccessAt should be set');
    assert(fetchedSource1.lastFailureAt, 'lastFailureAt should be set');
    assert(fetchedSource1.lastError === 'Operational network timeout', 'lastError matches');
    console.log('✅ Test 14 passed');

    // ----------------------------------------------------
    // TEST 15 & 16: OpportunityIngestionRun creation & sourceId reference
    // ----------------------------------------------------
    console.log('\n--- Test 15 & 16: OpportunityIngestionRun creation & sourceId reference ---');
    const run1 = await OpportunityIngestionRun.create({
      sourceId: source1._id,
      startedAt: new Date(),
    });
    createdRunIds.push(run1._id);
    assert(run1._id, 'Run should be created with _id');
    assert(run1.sourceId.toString() === source1._id.toString(), 'sourceId should match');
    assert(run1.status === 'running', 'Default status must be running');
    console.log('✅ Test 15 & 16 passed');

    // ----------------------------------------------------
    // TEST 17: Valid statuses accepted
    // ----------------------------------------------------
    console.log('\n--- Test 17: Valid statuses accepted ---');
    for (const s of ['running', 'completed', 'failed', 'partial']) {
      assert(INGESTION_RUN_STATUSES.includes(s), `Status ${s} is in allowed list`);
      const valS = validateIngestionRunStatus(s);
      assert(!valS.error, `Validator accepts ${s}`);
    }
    console.log('✅ Test 17 passed');

    // ----------------------------------------------------
    // TEST 18: Invalid status rejected
    // ----------------------------------------------------
    console.log('\n--- Test 18: Invalid status rejected ---');
    let badStatusCaught = false;
    try {
      await OpportunityIngestionRun.create({
        sourceId: source1._id,
        status: 'unknown_status',
        startedAt: new Date(),
      });
    } catch (e) {
      badStatusCaught = true;
    }
    assert(badStatusCaught, 'Schema rejects invalid status');
    const valBadStatus = validateIngestionRunStatus('finished');
    assert(valBadStatus.error, 'Validator rejects invalid status');
    console.log('✅ Test 18 passed');

    // ----------------------------------------------------
    // TEST 19: Counters default 0
    // ----------------------------------------------------
    console.log('\n--- Test 19: Counters default 0 ---');
    assert(run1.fetchedCount === 0, 'fetchedCount defaults 0');
    assert(run1.createdCount === 0, 'createdCount defaults 0');
    assert(run1.updatedCount === 0, 'updatedCount defaults 0');
    assert(run1.skippedCount === 0, 'skippedCount defaults 0');
    assert(run1.failedCount === 0, 'failedCount defaults 0');
    console.log('✅ Test 19 passed');

    // ----------------------------------------------------
    // TEST 20: Negative counter rejected
    // ----------------------------------------------------
    console.log('\n--- Test 20: Negative counter rejected ---');
    let negCountCaught = false;
    try {
      await OpportunityIngestionRun.create({
        sourceId: source1._id,
        startedAt: new Date(),
        fetchedCount: -10,
      });
    } catch (e) {
      negCountCaught = true;
    }
    assert(negCountCaught, 'Schema rejects negative counter');
    const valCounters = validateIngestionCounters({ fetchedCount: -1 });
    assert(valCounters.error, 'Validator rejects negative counter');
    console.log('✅ Test 20 passed');

    // ----------------------------------------------------
    // TEST 21: startedAt required
    // ----------------------------------------------------
    console.log('\n--- Test 21: startedAt required ---');
    let noStartedCaught = false;
    try {
      await OpportunityIngestionRun.create({
        sourceId: source1._id,
      });
    } catch (e) {
      noStartedCaught = true;
    }
    assert(noStartedCaught, 'Schema requires startedAt');
    console.log('✅ Test 21 passed');

    // ----------------------------------------------------
    // TEST 22: completedAt ordering enforced (completedAt >= startedAt)
    // ----------------------------------------------------
    console.log('\n--- Test 22: completedAt ordering enforced ---');
    let orderingCaught = false;
    try {
      await OpportunityIngestionRun.create({
        sourceId: source1._id,
        startedAt: new Date('2026-10-15T12:00:00Z'),
        completedAt: new Date('2026-10-15T11:00:00Z'), // 1 hour earlier
      });
    } catch (e) {
      orderingCaught = true;
    }
    assert(orderingCaught, 'completedAt earlier than startedAt must be rejected');
    console.log('✅ Test 22 passed');

    // ----------------------------------------------------
    // TEST 23: Source indexes exist
    // ----------------------------------------------------
    console.log('\n--- Test 23: Source indexes exist ---');
    const sourceIndexes = await OpportunitySource.collection.indexes();
    const hasSlugIndex = sourceIndexes.some((i) => i.key.slug === 1 && i.unique);
    const hasEnabledPriorityIndex = sourceIndexes.some((i) => i.key.enabled === 1 && i.key.priority === -1);
    assert(hasSlugIndex, 'Slug unique index must exist on OpportunitySource');
    assert(hasEnabledPriorityIndex, 'Enabled + priority index must exist on OpportunitySource');
    console.log('✅ Test 23 passed');

    // ----------------------------------------------------
    // TEST 24: Ingestion run indexes exist
    // ----------------------------------------------------
    console.log('\n--- Test 24: Ingestion run indexes exist ---');
    const runIndexes = await OpportunityIngestionRun.collection.indexes();
    const hasSourceStartIndex = runIndexes.some((i) => i.key.sourceId === 1 && i.key.startedAt === -1);
    const hasStatusStartIndex = runIndexes.some((i) => i.key.status === 1 && i.key.startedAt === -1);
    assert(hasSourceStartIndex, 'sourceId + startedAt index must exist on OpportunityIngestionRun');
    assert(hasStatusStartIndex, 'status + startedAt index must exist on OpportunityIngestionRun');
    console.log('✅ Test 24 passed');

    // ----------------------------------------------------
    // TEST 25: Enabled source retrieval sorted by priority
    // ----------------------------------------------------
    console.log('\n--- Test 25: Enabled source retrieval sorted by priority ---');
    const disabledSource = await OpportunitySource.create({
      name: 'Disabled Source',
      slug: `disabled-${timestamp}`,
      type: 'feed',
      enabled: false,
      priority: 999,
    });
    createdSourceIds.push(disabledSource._id);

    const highPriSource = await OpportunitySource.create({
      name: 'High Priority Source',
      slug: `high-pri-${timestamp}`,
      type: 'api',
      enabled: true,
      priority: 100,
    });
    createdSourceIds.push(highPriSource._id);

    const enabledSources = await getEnabledSources();
    assert(!enabledSources.some((s) => s.slug === disabledSource.slug), 'Disabled sources must be excluded');

    // Verify ordering: highPriSource should appear before defaultPriSource
    const highPriIdx = enabledSources.findIndex((s) => s.slug === highPriSource.slug);
    const defPriIdx = enabledSources.findIndex((s) => s.slug === defaultPriSource.slug);
    assert(highPriIdx >= 0 && defPriIdx >= 0 && highPriIdx < defPriIdx, 'Enabled sources must be sorted by priority descending');
    console.log('✅ Test 25 passed');

    // ----------------------------------------------------
    // TEST 26: createIngestionRun updates lastRunAt
    // ----------------------------------------------------
    console.log('\n--- Test 26: createIngestionRun updates lastRunAt ---');
    const freshSource = await OpportunitySource.create({
      name: 'Run Test Source',
      slug: `run-test-${timestamp}`,
      type: 'scraper',
    });
    createdSourceIds.push(freshSource._id);
    assert(!freshSource.lastRunAt, 'Fresh source has no lastRunAt');

    const createdRun = await createIngestionRun(freshSource._id, { version: '1.0' });
    createdRunIds.push(createdRun._id);
    assert(createdRun.status === 'running', 'Status is running');

    const freshSourceUpdated = await OpportunitySource.findById(freshSource._id);
    assert(freshSourceUpdated.lastRunAt, 'Source lastRunAt was updated upon run creation');
    console.log('✅ Test 26 passed');

    // ----------------------------------------------------
    // TEST 27: markRunSuccess updates lastSuccessAt
    // ----------------------------------------------------
    console.log('\n--- Test 27: markRunSuccess updates lastSuccessAt ---');
    const successRun = await markRunSuccess(createdRun._id, {
      fetchedCount: 50,
      createdCount: 45,
      skippedCount: 5,
    });
    assert(successRun.status === 'completed', 'Run status updated to completed');
    assert(successRun.completedAt, 'completedAt is set');
    assert(successRun.fetchedCount === 50, 'fetchedCount updated');
    assert(successRun.createdCount === 45, 'createdCount updated');

    const freshSourceSuccess = await OpportunitySource.findById(freshSource._id);
    assert(freshSourceSuccess.lastSuccessAt, 'lastSuccessAt updated on source');
    console.log('✅ Test 27 passed');

    // ----------------------------------------------------
    // TEST 28: markRunFailure updates lastFailureAt / lastError
    // ----------------------------------------------------
    console.log('\n--- Test 28: markRunFailure updates lastFailureAt / lastError ---');
    const failRunInitial = await createIngestionRun(freshSource._id);
    createdRunIds.push(failRunInitial._id);

    const failRun = await markRunFailure(
      failRunInitial._id,
      'Connection timed out after 30s',
      { failedCount: 1 }
    );
    assert(failRun.status === 'failed', 'Run status updated to failed');
    assert(failRun.errorMessage === 'Connection timed out after 30s', 'errorMessage stored');
    assert(failRun.completedAt, 'completedAt is set');

    const freshSourceFailed = await OpportunitySource.findById(freshSource._id);
    assert(freshSourceFailed.lastFailureAt, 'lastFailureAt updated on source');
    assert(freshSourceFailed.lastError === 'Connection timed out after 30s', 'lastError updated on source');
    console.log('✅ Test 28 passed');

    // ----------------------------------------------------
    // TEST 29: markRunPartial works
    // ----------------------------------------------------
    console.log('\n--- Test 29: markRunPartial works ---');
    const partialRunInitial = await createIngestionRun(freshSource._id);
    createdRunIds.push(partialRunInitial._id);

    const partialRun = await markRunPartial(
      partialRunInitial._id,
      'Page 2 rate-limited',
      { fetchedCount: 20, createdCount: 20, failedCount: 5 }
    );
    assert(partialRun.status === 'partial', 'Run status updated to partial');
    assert(partialRun.errorMessage === 'Page 2 rate-limited', 'errorMessage stored');
    assert(partialRun.completedAt, 'completedAt is set');
    console.log('✅ Test 29 passed');

    // ----------------------------------------------------
    // TEST 30: Adapter contract exists and enforces subclass implementation
    // ----------------------------------------------------
    console.log('\n--- Test 30: Adapter contract exists ---');
    const adapter = new BaseOpportunityAdapter({ name: 'Generic Adapter', slug: 'generic', type: 'api' });
    const def = adapter.getSourceDefinition();
    assert(def.name === 'Generic Adapter', 'getSourceDefinition works');

    let fetchThrows = false;
    try {
      await adapter.fetchOpportunities();
    } catch (e) {
      fetchThrows = true;
    }
    assert(fetchThrows, 'BaseOpportunityAdapter fetchOpportunities must throw');

    let normThrows = false;
    try {
      adapter.normalize({});
    } catch (e) {
      normThrows = true;
    }
    assert(normThrows, 'BaseOpportunityAdapter normalize must throw');
    console.log('✅ Test 30 passed');

    // ----------------------------------------------------
    // TEST 31: Normalized opportunity contract documented
    // ----------------------------------------------------
    console.log('\n--- Test 31: Normalized opportunity contract documented ---');
    assert(NORMALIZED_OPPORTUNITY_FIELDS.includes('title'), 'Contract includes title');
    assert(NORMALIZED_OPPORTUNITY_FIELDS.includes('organization'), 'Contract includes organization');
    assert(NORMALIZED_OPPORTUNITY_FIELDS.includes('sourceType'), 'Contract includes sourceType');
    assert(NORMALIZED_OPPORTUNITY_FIELDS.includes('sourceId'), 'Contract includes sourceId');
    assert(DEDUPLICATION_IDENTITY_PRIORITY.length === 3, 'Deduplication identity has 3 tiers');
    console.log('✅ Test 31 passed');

    // ----------------------------------------------------
    // TEST 32: Metadata remains non-sensitive (no secrets)
    // ----------------------------------------------------
    console.log('\n--- Test 32: Metadata remains non-sensitive ---');
    const safeMetaSource = await OpportunitySource.create({
      name: 'Safe Meta Source',
      slug: `safe-meta-${timestamp}`,
      type: 'feed',
      metadata: { feedFormat: 'atom', pollRate: 'hourly' },
    });
    createdSourceIds.push(safeMetaSource._id);
    assert(safeMetaSource.metadata.feedFormat === 'atom', 'Non-sensitive metadata preserved');
    console.log('✅ Test 32 passed');

    // ----------------------------------------------------
    // TEST 33: Cleanup succeeds
    // ----------------------------------------------------
    console.log('\n--- Test 33: Cleanup succeeds ---');
    await OpportunityIngestionRun.deleteMany({ _id: { $in: createdRunIds } });
    await OpportunitySource.deleteMany({ _id: { $in: createdSourceIds } });
    console.log('✅ Test 33 passed: Temporary test data cleaned up');

    console.log('\n🎉 ALL 33 INGESTION ARCHITECTURE TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILURE:', err);
    throw err;
  } finally {
    try {
      await OpportunityIngestionRun.deleteMany({ _id: { $in: createdRunIds } });
      await OpportunitySource.deleteMany({ _id: { $in: createdSourceIds } });
    } catch (cleanupErr) {
      console.error('Cleanup in finally block error:', cleanupErr);
    }
    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
