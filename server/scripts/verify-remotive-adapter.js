import { RemotiveAdapter } from '../src/services/ingestion/adapters/remotive.adapter.js';
import { BaseOpportunityAdapter } from '../src/services/ingestion/adapter.interface.js';
import { processOpportunityItem } from '../src/services/ingestion/pipeline.service.js';
import mongoose from 'mongoose';

// Zero-dependency mock framework
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

// Global original fetch reference for mocking
const originalFetch = global.fetch;

// Mock Source document
const mockSourceConfig = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Remotive',
  type: 'api',
  slug: 'remotive'
};

async function runTests() {
  console.log('\n====================================================');
  console.log('CAREEROS PHASE 8D — REMOTIVE ADAPTER VERIFICATION');
  console.log('====================================================\n');

  try {
    const adapter = new RemotiveAdapter(mockSourceConfig);

    console.log('--- 1. Adapter Contract & Definition ---');
    assert(adapter instanceof BaseOpportunityAdapter, 'Adapter inherits from BaseOpportunityAdapter');
    const def = adapter.getSourceDefinition();
    assert(def.name === 'Remotive' && def.slug === 'remotive' && def.type === 'api', 'Provides correct source definition metadata');
    assert(typeof adapter.fetchOpportunities === 'function', 'Implements fetchOpportunities');
    assert(typeof adapter.normalize === 'function', 'Implements normalize');

    console.log('\n--- 2. Fixture Extraction (Normalization) ---');
    const validFixture = {
      id: 1042456,
      url: 'https://remotive.com/remote-jobs/software-dev/senior-frontend-engineer-1042456',
      title: 'Senior Frontend Engineer (React)',
      company_name: 'Awesome Startup Inc.',
      company_logo: 'https://remotive.com/job/1042456/logo',
      category: 'software-dev',
      tags: ['react', 'javascript', 'frontend'],
      job_type: 'internship', // testing mapping
      publication_date: '2026-09-01T12:00:00Z',
      candidate_required_location: 'Worldwide',
      salary: '$60,000 - $80,000',
      description: '<p>Great job here with an incredibly long description that easily exceeds the twenty character minimum requirement of Phase 8C Gate A Validation.</p>'
    };

    const norm = adapter.normalize(validFixture);
    
    assert(norm.externalId === '1042456', 'Extracts stable externalId correctly');
    assert(norm.title === 'Senior Frontend Engineer (React)', 'Extracts title correctly');
    assert(norm.organization === 'Awesome Startup Inc.', 'Extracts organization correctly');
    assert(norm.description === validFixture.description, 'Passes HTML description untouched to pipeline');
    assert(norm.applicationUrl === validFixture.url, 'Extracts applicationUrl correctly');
    assert(norm.organizationLogo === validFixture.company_logo, 'Extracts organizationLogo correctly');
    assert(norm.tags.length === 3 && norm.tags.includes('react'), 'Extracts tags array cleanly');
    assert(norm.location.country === 'Worldwide', 'Extracts location explicitly');
    assert(norm.workMode === 'remote', 'Correctly asserts workMode is remote');
    assert(norm.type === 'internship', 'Maps recognized job_type reliably');
    assert(norm.eventDate === undefined && norm.deadline === undefined, 'Does not misuse publication date as event/deadline');
    assert(norm.stipend === undefined, 'Does not invent structured salary from free-form text');

    console.log('\n--- 3. Fetch Contract & Error Handling ---');
    
    // Mock HTTP 200 Valid
    global.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-length', '1000']]),
        text: async () => JSON.stringify({ 'job-count': 1, jobs: [validFixture] })
      };
    };
    let items = await adapter.fetchOpportunities({ limit: 5 });
    assert(items.length === 1 && items[0].id === 1042456, 'Fetches and parses valid API JSON payload');

    // Mock Limit boundary
    global.fetch = async (url) => {
      const arr = new Array(200).fill(validFixture);
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        text: async () => JSON.stringify({ 'job-count': 200, jobs: arr })
      };
    };
    items = await adapter.fetchOpportunities({ limit: 10 });
    assert(items.length === 10, 'Bounded limit cuts off excessive array sizes safely');

    // Mock HTTP 500
    global.fetch = async (url) => {
      return { ok: false, status: 500 };
    };
    try {
      await adapter.fetchOpportunities();
      assert(false, 'Should throw on HTTP 500');
    } catch (e) {
      assert(e.message.includes('500'), 'Properly throws on HTTP 500');
    }

    // Mock HTTP 429
    global.fetch = async (url) => {
      return { ok: false, status: 429 };
    };
    try {
      await adapter.fetchOpportunities();
      assert(false, 'Should throw on HTTP 429');
    } catch (e) {
      assert(e.message.includes('429'), 'Properly identifies rate limiting');
    }

    // Mock Malformed JSON
    global.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-length', '50']]),
        text: async () => '<html>Not JSON</html>'
      };
    };
    try {
      await adapter.fetchOpportunities();
      assert(false, 'Should throw on malformed JSON');
    } catch (e) {
      assert(e.message.includes('Malformed JSON'), 'Properly throws on malformed JSON payload');
    }

    console.log('\n--- 4. Phase 8C Pipeline Compatibility ---');
    
    // Test the integration between adapter.normalize and pipeline.processOpportunityItem
    // We mock MongoDB inside processOpportunityItem just to ensure it hits the right logic paths

    // Import the pipeline module and mock the DB
    const { Opportunity } = await import('../src/models/Opportunity.js');
    const originalFindOne = Opportunity.findOne;
    const originalCreate = Opportunity.create;
    
    let dbCreated = false;
    let gateAPassed = false;
    let externalIdCaptured = null;

    Opportunity.findOne = async (query) => null; // Always pretend new
    Opportunity.create = async (doc) => {
      dbCreated = true;
      externalIdCaptured = doc.externalId;
      return { _id: new mongoose.Types.ObjectId(), ...doc };
    };

    const runId = new mongoose.Types.ObjectId();
    const result = await processOpportunityItem({
      rawItem: norm, // Result of adapter.normalize(validFixture)
      source: mockSourceConfig,
      ingestionRunId: runId
    });

    if (result.status !== 'success') {
      console.error('Pipeline rejected item:', result);
    }

    gateAPassed = result.status === 'success';

    assert(gateAPassed, 'Adapter fixture successfully passes Gate-A validation');
    assert(result.action === 'created', 'Pipeline correctly routes new item to creation');
    assert(dbCreated, 'Database create was triggered safely');
    assert(externalIdCaptured === '1042456', 'External ID survived normalization to persistence');

    // Restore Mongo mocks
    Opportunity.findOne = originalFindOne;
    Opportunity.create = originalCreate;
    
    console.log('\n--- 5. Security & Isolation Controls ---');
    assert(adapter.fetchOpportunities.toString().includes('AbortController'), 'Uses AbortSignal for timeouts');
    assert(adapter.fetchOpportunities.toString().includes('5 * 1024 * 1024'), 'Enforces 5MB maximum response size constraint');
    assert(!adapter.normalize.toString().includes('save(') && !adapter.normalize.toString().includes('create('), 'Adapter strictly performs no database mutations');

  } catch (error) {
    console.error('Fatal error in adapter test suite:', error);
    process.exitCode = 1;
  } finally {
    // Restore global fetch
    global.fetch = originalFetch;
  }

  console.log('\n====================================================');
  if (process.exitCode === 1) {
    console.error(`❌ VERIFICATION FAILED: ${passedCount}/${totalCount} TEST SUITES PASSED`);
  } else {
    console.log(`✅ VERIFICATION COMPLETE: ALL ${totalCount} TEST SUITES PASSED!`);
  }
  console.log('====================================================\n');
}

runTests();
