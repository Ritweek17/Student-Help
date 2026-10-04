import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { OpportunitySource } from '../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../src/models/OpportunityIngestionRun.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { User } from '../src/models/User.js';
import * as ingestionService from '../src/services/ingestion/ingestion.service.js';

async function runTests() {
  console.log('--- STARTING ADMIN INGESTION TESTS (PHASE 8F) ---');
  let exitCode = 0;
  
  try {
    await connectDatabase();
    
    // Setup test data
    await OpportunitySource.deleteMany({ slug: /^test-admin-/ });
    await OpportunityIngestionRun.deleteMany({ 'metadata.test': true });
    await Opportunity.deleteMany({ 'organization': 'Test Admin Org' });
    await User.deleteMany({ email: 'test-admin-curator@careeros.com' });

    const { default: bcrypt } = await import('bcrypt');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'Curator',
      email: 'test-admin-curator@careeros.com',
      passwordHash: passwordHash,
      role: 'admin',
    });

    const source = await OpportunitySource.create({
      name: 'Test Admin Source',
      slug: 'test-admin-source-1',
      type: 'api',
      baseUrl: 'https://test.com',
      enabled: true,
      priority: 5,
      isLocked: false
    });

    const run = await ingestionService.createIngestionRun(source._id, { test: true });
    await ingestionService.markRunSuccess(run._id, { fetchedCount: 10, createdCount: 2 });

    const draft1 = await Opportunity.create({
      title: 'Admin Draft 1',
      organization: 'Test Admin Org',
      description: 'Desc',
      type: 'internship',
      status: 'draft',
      verified: false,
      sourceRef: source._id,
      externalId: 'test-admin-draft-1',
      ingestionRunId: run._id
    });

    const draft2 = await Opportunity.create({
      title: 'Admin Draft 2',
      organization: 'Test Admin Org',
      description: 'Desc',
      type: 'internship',
      status: 'draft',
      verified: false,
      sourceRef: source._id,
      externalId: 'test-admin-draft-2',
      ingestionRunId: run._id
    });

    // We simulate the Express request objects directly against the controller functions
    // since we want to avoid standing up a full HTTP server in the verify script if possible.
    // Alternatively, we can just test the logic or mock req/res.
    // However, the best way is to test the controller logic by mocking req, res, next.

    const mockRes = () => {
      const res = {};
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.data = data;
        return res;
      };
      return res;
    };
    
    const mockNext = () => (err) => { throw err; };

    const { 
      listSources, updateSource, listIngestionRuns, getIngestionRunById, bulkCurateOpportunities
    } = await import('../src/controllers/admin.ingestion.controller.js');

    console.log('1. SOURCE API - List sources');
    const reqListSources = { query: {} };
    const resListSources = mockRes();
    await listSources(reqListSources, resListSources, mockNext());
    if (resListSources.statusCode !== 200 || !resListSources.data.success) throw new Error('Failed to list sources');
    if (resListSources.data.sources.some(s => 'lockedBy' in s)) throw new Error('lockedBy leaked in source list');
    console.log('✅ SOURCE API - Safe projection verified');

    console.log('2. SOURCE API - Update source');
    const reqUpdateSource = { params: { id: source._id.toString() }, body: { enabled: false, priority: 10, lockedBy: 'hacker' } };
    const resUpdateSource = mockRes();
    await updateSource(reqUpdateSource, resUpdateSource, mockNext());
    if (resUpdateSource.statusCode !== 200 || !resUpdateSource.data.success) throw new Error('Failed to update source');
    if (resUpdateSource.data.source.enabled !== false || resUpdateSource.data.source.priority !== 10) throw new Error('Source update fields not applied');
    
    // Verify protected fields not modified
    const checkSource = await OpportunitySource.findById(source._id);
    if (checkSource.lockedBy === 'hacker') throw new Error('Protected field modified');
    console.log('✅ SOURCE API - Update and protected fields verified');

    console.log('3. RUN API - List runs');
    const reqListRuns = { query: { sourceId: source._id.toString(), limit: '10', page: '1' } };
    const resListRuns = mockRes();
    await listIngestionRuns(reqListRuns, resListRuns, mockNext());
    if (resListRuns.statusCode !== 200 || !resListRuns.data.success || resListRuns.data.runs.length === 0) throw new Error('Failed to list runs');
    console.log('✅ RUN API - List with pagination/filtering verified');

    console.log('4. BULK CURATION - Approve');
    const reqBulkApprove = { 
      auth: { userId: adminUser._id },
      body: { action: 'approve', ids: [draft1._id.toString(), 'invalid-id-format'] }
    };
    const resBulkApprove = mockRes();
    await bulkCurateOpportunities(reqBulkApprove, resBulkApprove, mockNext());
    if (resBulkApprove.statusCode !== 200) throw new Error('Bulk approve failed: ' + JSON.stringify(resBulkApprove.data));
    if (resBulkApprove.data.results.successful !== 1) throw new Error('Bulk approve expected 1 success');
    
    const checkApprove = await Opportunity.findById(draft1._id);
    if (checkApprove.status !== 'published' || !checkApprove.verified || checkApprove.verifiedBy.toString() !== adminUser._id.toString()) {
      throw new Error('Bulk approve state invalid');
    }
    console.log('✅ BULK CURATION - Approve verified');

    console.log('5. BULK CURATION - Archive');
    const reqBulkArchive = {
      auth: { userId: adminUser._id },
      body: { action: 'archive', ids: [draft2._id.toString()] }
    };
    const resBulkArchive = mockRes();
    await bulkCurateOpportunities(reqBulkArchive, resBulkArchive, mockNext());
    if (resBulkArchive.statusCode !== 200 || resBulkArchive.data.results.successful !== 1) throw new Error('Bulk archive failed');
    
    const checkArchive = await Opportunity.findById(draft2._id);
    if (checkArchive.status !== 'archived') throw new Error('Bulk archive state invalid');
    console.log('✅ BULK CURATION - Archive verified');

    console.log('6. BULK CURATION - Batch limits');
    const largeBatchIds = Array(60).fill(draft1._id.toString());
    const reqLargeBatch = { body: { action: 'approve', ids: largeBatchIds } };
    const resLargeBatch = mockRes();
    await bulkCurateOpportunities(reqLargeBatch, resLargeBatch, mockNext());
    if (resLargeBatch.statusCode !== 400) throw new Error('Failed to reject large batch');
    console.log('✅ BULK CURATION - Batch limit verified');
    
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    exitCode = 1;
  } finally {
    // Cleanup
    try {
      await OpportunitySource.deleteMany({ slug: /^test-admin-/ });
      await OpportunityIngestionRun.deleteMany({ 'metadata.test': true });
      await Opportunity.deleteMany({ 'organization': 'Test Admin Org' });
      await User.deleteMany({ email: 'test-admin-curator@careeros.com' });
      await disconnectDatabase();
    } catch (e) {
      console.error('Cleanup failed:', e.message);
    }
    console.log('--- ADMIN INGESTION TESTS COMPLETE ---');
    process.exit(exitCode);
  }
}

runTests();
