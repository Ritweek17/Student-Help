import mongoose from 'mongoose';
import { DevpostAdapter } from '../src/services/ingestion/adapters/devpost.adapter.js';
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
  name: 'Devpost',
  slug: 'devpost',
  type: 'api'
};

async function runTests() {
  console.log('\n====================================================');
  console.log('CAREEROS PHASE 8H-2 — DEVPOST ADAPTER VERIFICATION');
  console.log('====================================================\n');

  try {
    const adapter = new DevpostAdapter(mockSourceConfig);

    console.log('--- 1. Adapter Contract & Definition ---');
    assert(adapter instanceof BaseOpportunityAdapter, 'Adapter inherits from BaseOpportunityAdapter');
    assert(typeof adapter.fetchOpportunities === 'function', 'Implements fetchOpportunities');
    assert(typeof adapter.normalize === 'function', 'Implements normalize');
    assert(adapter.getSourceDefinition().slug === 'devpost', 'Provides correct source definition metadata');

    console.log('\n--- 2. Fixture Extraction (Normalization) ---');
    const validFixture = {
      id: 29969,
      title: "RevenueCat Shipaton 2026",
      displayed_location: {
        icon: "globe",
        location: "Online"
      },
      thumbnail_url: "https://d112y698adiu2z.cloudfront.net/photos/medium_square.jpg",
      url: "https://revenuecat-shipaton-2026.devpost.com/",
      submission_period_dates: "Jul 31 - Oct 01, 2026",
      themes: [
        { id: 18, name: "Design" },
        { id: 4, name: "Gaming" }
      ],
      prize_amount: "$<span data-currency-value>740,000</span>",
      organization_name: "RevenueCat",
      start_a_submission_url: "https://revenuecat-shipaton-2026.devpost.com/challenges/start_a_submission",
      invite_only: false,
      start_date: "2026-07-31T00:00:00Z",
      end_date: "2026-10-01T23:59:59Z"
    };

    const norm = adapter.normalize(validFixture);
    
    assert(norm.externalId === '29969', 'Extracts stable externalId correctly');
    assert(norm.title === 'RevenueCat Shipaton 2026', 'Extracts title correctly');
    assert(norm.organization === 'RevenueCat', 'Extracts organization correctly');
    assert(norm.description === undefined, 'Does not fabricate description when unavailable');
    assert(norm.applicationUrl === 'https://revenuecat-shipaton-2026.devpost.com/', 'Extracts applicationUrl correctly');
    assert(norm.registrationUrl === 'https://revenuecat-shipaton-2026.devpost.com/challenges/start_a_submission', 'Extracts registrationUrl correctly');
    assert(norm.organizationLogo === 'https://d112y698adiu2z.cloudfront.net/photos/medium_square.jpg', 'Extracts organizationLogo correctly');
    assert(Array.isArray(norm.tags) && norm.tags.includes('Design'), 'Extracts tags/themes correctly');
    assert(norm.workMode === 'remote', 'Correctly asserts remote workMode from online');
    assert(norm.type === 'hackathon', 'Maps hackathon type reliably');
    assert(norm.eventDate instanceof Date, 'Extracts explicit start_date correctly');
    assert(norm.deadline instanceof Date, 'Extracts explicit end_date correctly');
    assert(norm.postedAt === undefined, 'Does not invent a postedAt from absent data');
    assert(norm.prize === undefined, 'Does not invent structured prize from free-form text');
    assert(norm.stipend === undefined, 'Does not fabricate stipend');

    console.log('\n--- 3. Edge Cases & Ambiguity ---');
    const physicalFixture = {
      id: 111,
      title: "Local Hack",
      organization_name: "Local",
      displayed_location: { location: "San Francisco, CA" },
      invite_only: true,
      themes: ["Hardware"],
      prize: { amount: 5000, currency: "USD" },
      published_at: "2026-01-01T00:00:00Z"
    };

    const normPhysical = adapter.normalize(physicalFixture);
    assert(normPhysical.workMode === 'onsite', 'Correctly asserts onsite workMode from physical string');
    assert(normPhysical.location && normPhysical.location.city === 'San Francisco, CA', 'Extracts city location');
    assert(normPhysical.eligibility === 'invite_only', 'Maps invite_only eligibility securely');
    assert(normPhysical.postedAt instanceof Date, 'Maps published_at when explicitly present');
    assert(normPhysical.prize && normPhysical.prize.amount === 5000, 'Maps safe structured prize');
    assert(normPhysical.tags && normPhysical.tags.includes('Hardware'), 'Maps string array themes');

    const missingFixture = adapter.normalize({});
    assert(missingFixture.title === undefined && missingFixture.externalId === undefined, 'Handles missing fields without throwing errors');
    
    console.log('\n--- 4. Fetch Contract & Error Handling ---');
    
    global.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-length', '1000']]),
        text: async () => JSON.stringify({ hackathons: [validFixture] })
      };
    };
    let items = await adapter.fetchOpportunities({ limit: 5 });
    assert(items.length === 1 && items[0].id === 29969, 'Fetches and parses valid API JSON payload');

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

    if (result.status === 'invalid') {
      console.log('Pipeline correctly rejected item:', result.warnings);
    }

    gateAPassed = result.status === 'success';

    assert(!gateAPassed && result.status === 'invalid', 'Adapter fixture safely and correctly fails Gate-A validation due to unresolvable missing description');
    assert(result.warnings && result.warnings.includes('Missing description'), 'Pipeline correctly identifies the Missing description');
    assert(result.action === 'skipped', 'Pipeline correctly safely skips item creation');
    assert(!dbCreated, 'Database create was appropriately blocked by data quality gates');

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
