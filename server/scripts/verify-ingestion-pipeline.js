import { Opportunity } from '../src/models/Opportunity.js';
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

// Global Mocks
let mockFindOneReturns = null;
let mockCreateThrows = null;
let mockCreateReturns = null;
let createdDocuments = [];
let savedDocuments = [];

// Stub Mongoose Model methods
const originalFindOne = Opportunity.findOne;
const originalCreate = Opportunity.create;

Opportunity.findOne = async function(query) {
  if (mockFindOneReturns) {
    if (typeof mockFindOneReturns === 'function') {
      return mockFindOneReturns(query);
    }
    return mockFindOneReturns;
  }
  return null;
};

Opportunity.create = async function(data) {
  if (mockCreateThrows) throw mockCreateThrows;
  const doc = { ...data, _id: new mongoose.Types.ObjectId() };
  createdDocuments.push(doc);
  return mockCreateReturns || doc;
};

function resetMocks() {
  mockFindOneReturns = null;
  mockCreateThrows = null;
  mockCreateReturns = null;
  createdDocuments = [];
  savedDocuments = [];
}

const mockSource = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Mock Source',
  type: 'api',
  url: 'https://source.test'
};
const mockRunId = new mongoose.Types.ObjectId();

async function runTests() {
  console.log('\n====================================================');
  console.log('CAREEROS PHASE 8C — INGESTION PIPELINE VERIFICATION');
  console.log('====================================================\n');

  try {
    console.log('--- 1. Gate A Validation Rejections ---');
    
    // 1. Missing Title
    let res = await processOpportunityItem({ rawItem: { organization: 'Org', description: 'Very long description 12345', applicationUrl: 'https://test.com' }, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'invalid' && res.warnings.some(w => w.includes('Missing title')), 'Missing title rejected');
    
    // 2. Missing Org
    res = await processOpportunityItem({ rawItem: { title: 'Valid Title', description: 'Very long description 12345', applicationUrl: 'https://test.com' }, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'invalid' && res.warnings.some(w => w.includes('Missing organization')), 'Missing organization rejected');
    
    // 3. Short description
    res = await processOpportunityItem({ rawItem: { title: 'Valid Title', organization: 'Org', description: 'Too short', applicationUrl: 'https://test.com' }, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'invalid' && res.warnings.some(w => w.includes('20 characters')), 'Short description rejected');
    
    // 4. Invalid URL
    res = await processOpportunityItem({ rawItem: { title: 'Valid Title', organization: 'Org', description: 'Very long description 123456', applicationUrl: 'javascript:alert(1)' }, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'invalid' && res.warnings.some(w => w.includes('valid HTTP')), 'Invalid URL rejected');

    console.log('\n--- 2. Normalization & Sanitization ---');
    const dirtyItem = {
      title: '   [URGENT] 🔥 Awesome Intern   ',
      organization: '  Google LLC ',
      description: '<script>alert(1)</script><p>Clean HTML</p><a href="javascript:foo">Bad Link</a>',
      type: 'summer student',
      workMode: 'WFH',
      skills: ['reactJS', 'node.js', '  Vue '],
      stipend: { amount: 500, currency: 'usd '},
      applicationUrl: 'https://app.test/?utm_source=bad',
      externalId: 'ext-123'
    };
    resetMocks();
    res = await processOpportunityItem({ rawItem: dirtyItem, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'success' && res.action === 'created', 'Pipeline allows valid normalized item');
    const created = createdDocuments[0];
    assert(created.title === 'Awesome Intern', 'Title whitespace and noise removed');
    assert(created.organization === 'Google', 'Organization normalized and suffixes removed');
    assert(!created.description.includes('script'), 'HTML script removed');
    assert(created.type === 'internship', 'Type mapped successfully');
    assert(created.workMode === 'remote', 'WorkMode mapped successfully');
    assert(created.skills.includes('react') && created.skills.includes('nodejs'), 'Skills normalized');
    assert(created.stipend.amount === 500 && created.stipend.currency === 'USD', 'Stipend normalized');
    assert(created.applicationUrl === 'https://app.test/', 'URL tracking params stripped');
    assert(created.status === 'draft', 'New records become draft');
    assert(created.verified === false, 'New records remain unverified');

    console.log('\n--- 3. Three-Tier Deduplication ---');
    
    // Tier 1: Source Identity
    resetMocks();
    const existingOpp = {
      _id: new mongoose.Types.ObjectId(),
      sourceRef: mockSource._id,
      externalId: 'ext-123',
      verified: true, // test verified protection
      title: 'Old Title',
      organization: 'Google',
      save: async function() { savedDocuments.push(this); }
    };
    mockFindOneReturns = (query) => {
      if (query.sourceRef === mockSource._id && query.externalId === 'ext-123') return existingOpp;
      return null;
    };
    res = await processOpportunityItem({ rawItem: dirtyItem, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'success' && res.action === 'updated', 'Same source match leads to update');
    assert(savedDocuments.length === 1 && savedDocuments[0].title === 'Awesome Intern', 'Source-owned fields updated on existing record');
    assert(savedDocuments[0].verified === true, 'Verified status is protected during update');
    
    // Tier 2: Canonical URL
    resetMocks();
    mockFindOneReturns = (query) => {
      if (query.canonicalUrl === 'https://app.test/') return { _id: new mongoose.Types.ObjectId() };
      return null;
    };
    res = await processOpportunityItem({ rawItem: dirtyItem, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'duplicate' && res.action === 'cross_source_duplicate', 'Canonical URL match leads to cross-source duplicate flag');
    assert(createdDocuments.length === 0, 'No document created for cross-source duplicate');

    // Tier 3: Fingerprint Match
    resetMocks();
    mockFindOneReturns = (query) => {
      if (query.contentFingerprint) return { _id: new mongoose.Types.ObjectId() };
      return null;
    };
    res = await processOpportunityItem({ rawItem: dirtyItem, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'duplicate' && res.action === 'fingerprint_duplicate', 'Fingerprint match leads to fingerprint duplicate flag');
    assert(createdDocuments.length === 0, 'No document created for fingerprint duplicate');

    console.log('\n--- 4. Safe Upsert / Error Recovery ---');
    resetMocks();
    mockCreateThrows = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    // Recover on race
    mockFindOneReturns = (query) => {
      if (query.sourceRef && query.externalId) {
        return {
          _id: new mongoose.Types.ObjectId(),
          save: async function() {}
        };
      }
      return null;
    };
    res = await processOpportunityItem({ rawItem: dirtyItem, source: mockSource, ingestionRunId: mockRunId });
    assert(res.status === 'success' && res.action === 'updated', 'Pipeline recovers from duplicate-key race condition safely');

  } catch (error) {
    console.error('Fatal error in test suite:', error);
    process.exitCode = 1;
  } finally {
    // Restore stubs
    Opportunity.findOne = originalFindOne;
    Opportunity.create = originalCreate;
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
