import mongoose from 'mongoose';
import { HasjobAdapter } from '../src/services/ingestion/adapters/hasjob.adapter.js';
import { BaseOpportunityAdapter } from '../src/services/ingestion/adapter.interface.js';
import { processOpportunityItem } from '../src/services/ingestion/pipeline.service.js';

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

const originalFetch = global.fetch;

const mockSourceConfig = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Hasjob',
  slug: 'hasjob',
  type: 'api'
};

async function runTests() {
  console.log('\n====================================================');
  console.log('CAREEROS PHASE 8H-1 — HASJOB ADAPTER VERIFICATION');
  console.log('====================================================\n');

  try {
    const adapter = new HasjobAdapter(mockSourceConfig);

    console.log('--- 1. Adapter Contract & Definition ---');
    assert(adapter instanceof BaseOpportunityAdapter, 'Adapter inherits from BaseOpportunityAdapter');
    assert(typeof adapter.fetchOpportunities === 'function', 'Implements fetchOpportunities');
    assert(typeof adapter.normalize === 'function', 'Implements normalize');
    assert(adapter.getSourceDefinition().slug === 'hasjob', 'Provides correct source definition metadata');

    console.log('\n--- 2. Fixture Extraction (Normalization) ---');
    const validFixture = {
      id: "hasjob-12345",
      title: "Software Engineer Intern",
      company: "Tech Corp",
      description: "Looking for an intern...",
      url: "https://hasjob.co/view/12345",
      logo: "https://hasjob.co/logo.png",
      date: "2024-05-01T10:00:00Z",
      location: "Bengaluru, India",
      type: "internship",
      workMode: "hybrid",
      skills: ["python", "react"]
    };

    const norm = adapter.normalize(validFixture);
    
    assert(norm.externalId === 'hasjob-12345', 'Extracts stable externalId correctly');
    assert(norm.title === 'Software Engineer Intern', 'Extracts title correctly');
    assert(norm.organization === 'Tech Corp', 'Extracts organization correctly');
    assert(norm.description === 'Looking for an intern...', 'Passes HTML description untouched to pipeline');
    assert(norm.applicationUrl === 'https://hasjob.co/view/12345', 'Extracts applicationUrl correctly');
    assert(norm.organizationLogo === 'https://hasjob.co/logo.png', 'Extracts organizationLogo correctly');
    assert(Array.isArray(norm.skills) && norm.skills.includes('react'), 'Extracts skills correctly');
    assert(norm.location && norm.location.city === 'Bengaluru, India', 'Extracts location explicitly');
    assert(norm.workMode === 'hybrid', 'Extracts workMode correctly');
    assert(norm.type === 'internship', 'Maps recognized job_type reliably');
    assert(norm.postedAt instanceof Date, 'Extracts publication date safely to postedAt');
    assert(norm.eventDate === undefined && norm.deadline === undefined, 'Does not misuse publication date as event/deadline');
    assert(norm.stipend === undefined, 'Does not invent structured salary from free-form text');

    console.log('\n--- 3. Edge Cases & Ambiguity ---');
    const ambiguousFixture = {
      id: "ambiguous-999",
      title: "Marketing Manager",
      company: "Sales Co",
      content: "Sales role anywhere", 
      location: "Anywhere",
      published: "2023-01-01T00:00:00Z" 
    };

    const normAmbiguous = adapter.normalize(ambiguousFixture);
    assert(normAmbiguous.workMode === 'remote', 'Correctly asserts remote workMode from location string "Anywhere"');
    assert(normAmbiguous.type === undefined, 'Does not force unsupported types (Marketing Manager left undefined)');
    assert(normAmbiguous.description === 'Sales role anywhere', 'Falls back to content for description if available');
    assert(normAmbiguous.postedAt instanceof Date, 'Correctly handles alternate date keys (published)');

    const missingFixture = adapter.normalize({ id: '1' });
    assert(missingFixture.title === undefined && missingFixture.description === undefined, 'Handles missing fields without throwing errors');
    
    const fakeSalaryFixture = adapter.normalize({ id: '2', title: 'A', stipend: '₹50,000 / month' });
    assert(fakeSalaryFixture.stipend === undefined, 'Safely ignores free-form text salary to prevent invalid stipend structure');

    const validSalaryFixture = adapter.normalize({ id: '3', title: 'B', stipend: { amount: 5000, currency: 'INR', period: 'monthly' }});
    assert(validSalaryFixture.stipend !== undefined && validSalaryFixture.stipend.amount === 5000, 'Accepts properly structured stipend');

    console.log('\n--- 4. Fetch Contract & Error Handling ---');
    
    global.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-length', '1000']]),
        text: async () => JSON.stringify({ jobs: [validFixture] })
      };
    };
    let items = await adapter.fetchOpportunities({ limit: 5 });
    assert(items.length === 1 && items[0].id === 'hasjob-12345', 'Fetches and parses valid API JSON payload');

    global.fetch = async (url) => {
      const arr = new Array(200).fill(validFixture);
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        text: async () => JSON.stringify({ jobs: arr })
      };
    };
    items = await adapter.fetchOpportunities({ limit: 10 });
    assert(items.length === 10, 'Bounded limit cuts off excessive array sizes safely');

    global.fetch = async (url) => {
      return { ok: false, status: 500 };
    };
    try {
      await adapter.fetchOpportunities();
      assert(false, 'Should throw on HTTP 500');
    } catch (e) {
      assert(e.message.includes('500'), 'Properly throws on HTTP 500');
    }

    global.fetch = async (url) => {
      return { ok: false, status: 429 };
    };
    try {
      await adapter.fetchOpportunities();
      assert(false, 'Should throw on HTTP 429');
    } catch (e) {
      assert(e.message.includes('429'), 'Properly identifies rate limiting');
    }

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

    global.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        text: async () => JSON.stringify({ items: [validFixture] }) // Alternate structure
      };
    };
    const altItems = await adapter.fetchOpportunities({ limit: 5 });
    assert(altItems.length === 1, 'Gracefully handles alternative payload structures (items array)');

    console.log('\n--- 5. Phase 8C Pipeline Compatibility ---');
    
    const { Opportunity } = await import('../src/models/Opportunity.js');
    const originalFindOne = Opportunity.findOne;
    const originalCreate = Opportunity.create;
    
    let dbCreated = false;
    let gateAPassed = false;
    let externalIdCaptured = null;

    Opportunity.findOne = async (query) => null; 
    Opportunity.create = async (doc) => {
      dbCreated = true;
      externalIdCaptured = doc.externalId;
      return { _id: new mongoose.Types.ObjectId(), ...doc };
    };

    const runId = new mongoose.Types.ObjectId();
    const result = await processOpportunityItem({
      rawItem: adapter.normalize(validFixture), 
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
    assert(externalIdCaptured === 'hasjob-12345', 'External ID survived normalization to persistence');

    Opportunity.findOne = originalFindOne;
    Opportunity.create = originalCreate;

  } catch (error) {
    console.error('Fatal error in adapter test suite:', error);
    process.exitCode = 1;
  } finally {
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
