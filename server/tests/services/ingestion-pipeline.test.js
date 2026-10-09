import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../src/models/OpportunityIngestionRun.js';
import { processOpportunityItem } from '../../src/services/ingestion/pipeline.service.js';
import {
  getEnabledSources,
  createIngestionRun,
  markRunSuccess,
  markRunFailure,
  markRunPartial,
} from '../../src/services/ingestion/ingestion.service.js';

describe('Ingestion Pipeline & Ingestion Service (MongoMemoryReplSet)', () => {
  let mockSourceDoc;
  let mockRunDoc;

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

    mockSourceDoc = await OpportunitySource.create({
      name: 'Test Source',
      slug: 'test-source',
      type: 'api',
      baseUrl: 'https://source.test/api',
      enabled: true,
      priority: 10,
    });

    mockRunDoc = await OpportunityIngestionRun.create({
      sourceId: mockSourceDoc._id,
      status: 'running',
      startedAt: new Date(),
    });
  });

  describe('1. Gate A Validation Rejections', () => {
    it('rejects item missing title', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          organization: 'Org',
          description: 'Very long description 12345',
          applicationUrl: 'https://test.com',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.action).toBe('skipped');
      expect(res.warnings).toBeDefined();
      expect(res.warnings.some((w) => w.includes('Missing title'))).toBe(true);
    });

    it('rejects item with title shorter than 3 characters', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'AB',
          organization: 'Valid Org',
          description: 'A sufficiently long description with more than 20 chars',
          applicationUrl: 'https://test.com',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.warnings.some((w) => w.includes('at least 3 characters'))).toBe(true);
    });

    it('rejects item missing organization', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'Valid Title',
          description: 'Very long description 12345',
          applicationUrl: 'https://test.com',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.action).toBe('skipped');
      expect(res.warnings.some((w) => w.includes('Missing organization'))).toBe(true);
    });

    it('rejects item with organization shorter than 2 characters', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'Valid Title',
          organization: 'A',
          description: 'A sufficiently long description with more than 20 chars',
          applicationUrl: 'https://test.com',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.warnings.some((w) => w.includes('at least 2 characters'))).toBe(true);
    });

    it('rejects item with description shorter than 20 characters', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'Valid Title',
          organization: 'Org',
          description: 'Too short',
          applicationUrl: 'https://test.com',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.warnings.some((w) => w.includes('20 characters'))).toBe(true);
    });

    it('rejects item with invalid URL scheme (javascript:)', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'Valid Title',
          organization: 'Org',
          description: 'Very long description 123456',
          applicationUrl: 'javascript:alert(1)',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.warnings.some((w) => w.includes('valid HTTP'))).toBe(true);
    });

    it('rejects item with missing rawItem or missing source', async () => {
      const resMissingItem = await processOpportunityItem({
        rawItem: null,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });
      expect(resMissingItem.status).toBe('invalid');
      expect(resMissingItem.reason).toContain('Missing rawItem');

      const resMissingSource = await processOpportunityItem({
        rawItem: { title: 'Valid Title' },
        source: null,
        ingestionRunId: mockRunDoc._id,
      });
      expect(resMissingSource.status).toBe('invalid');
      expect(resMissingSource.reason).toContain('Missing source');
    });

    it('rejects item missing both applicationUrl and registrationUrl', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'Valid Title',
          organization: 'Valid Org',
          type: 'internship',
          description: 'A sufficiently long description with more than 20 chars',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.warnings.some((w) => w.includes('applicationUrl or registrationUrl'))).toBe(true);
    });

    it('rejects unmapped opportunity type when attempting persistence', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'Valid Title',
          organization: 'Valid Org',
          description: 'A sufficiently long description with more than 20 chars',
          applicationUrl: 'https://test.com',
          type: 'completely_unrecognized_type_xyz',
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      // Normalizer drops unmapped type to undefined, leading to Mongoose required type failure
      expect(res.status).toBe('failed');
      expect(res.reason).toContain('type');
    });

    it('rejects item where endDate is before eventDate', async () => {
      const res = await processOpportunityItem({
        rawItem: {
          title: 'Valid Title',
          organization: 'Valid Org',
          type: 'internship',
          description: 'A sufficiently long description with more than 20 chars',
          applicationUrl: 'https://test.com',
          eventDate: new Date('2026-06-15'),
          endDate: new Date('2026-06-10'),
        },
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.warnings.some((w) => w.includes('endDate cannot be before eventDate'))).toBe(true);
    });
  });

  describe('2. Normalization & Sanitization', () => {
    it('normalizes dirty item fields, removes noise/scripts, maps types, and creates draft document', async () => {
      const dirtyItem = {
        title: '   [URGENT] 🔥 Awesome Intern   ',
        organization: '  Google LLC ',
        description: '<script>alert(1)</script><p>Clean HTML</p><a href="javascript:foo">Bad Link</a>',
        type: 'summer student',
        workMode: 'WFH',
        skills: ['reactJS', 'node.js', '  Vue '],
        stipend: { amount: 500, currency: 'usd ' },
        applicationUrl: 'https://app.test/?utm_source=bad',
        externalId: 'ext-123',
      };

      const res = await processOpportunityItem({
        rawItem: dirtyItem,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('success');
      expect(res.action).toBe('created');
      expect(res.opportunityId).toBeDefined();

      const created = await Opportunity.findById(res.opportunityId);
      expect(created).not.toBeNull();
      expect(created.title).toBe('Awesome Intern');
      expect(created.organization).toBe('Google');
      expect(created.description).not.toContain('<script>');
      expect(created.type).toBe('internship');
      expect(created.workMode).toBe('remote');
      expect(created.skills).toContain('react');
      expect(created.skills).toContain('nodejs');
      expect(created.stipend.amount).toBe(500);
      expect(created.stipend.currency).toBe('USD');
      expect(created.applicationUrl).toBe('https://app.test/');
      expect(created.status).toBe('draft');
      expect(created.verified).toBe(false);
      expect(created.canonicalUrl).toBe('https://app.test/');
      expect(created.contentFingerprint).toBeDefined();
      expect(created.completenessScore).toBeGreaterThanOrEqual(0);
      expect(created.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(created.qualityScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3. Three-Tier Deduplication', () => {
    it('Tier 1: same source identity (sourceRef + externalId) leads to update and preserves verified status', async () => {
      // Create initial opportunity manually with verified = true
      const existingOpp = await Opportunity.create({
        title: 'Old Title',
        organization: 'Google',
        type: 'internship',
        description: 'Existing long description for this opportunity doc 12345',
        sourceRef: mockSourceDoc._id,
        externalId: 'ext-tier1',
        applicationUrl: 'https://app.test/existing',
        canonicalUrl: 'https://app.test/existing',
        contentFingerprint: 'existing-fp-tier1',
        verified: true,
        status: 'published',
      });

      const updatedRaw = {
        title: 'Updated Newer Title',
        organization: 'Google Inc',
        type: 'internship',
        description: 'Brand new updated description with plenty of characters 12345',
        applicationUrl: 'https://app.test/updated',
        externalId: 'ext-tier1',
      };

      const res = await processOpportunityItem({
        rawItem: updatedRaw,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('success');
      expect(res.action).toBe('updated');
      expect(res.opportunityId.toString()).toBe(existingOpp._id.toString());

      const updated = await Opportunity.findById(existingOpp._id);
      expect(updated.title).toBe('Updated Newer Title');
      expect(updated.verified).toBe(true); // verified status protected from overwrite!
      expect(updated.status).toBe('published'); // status not overwritten back to draft
    });

    it('Tier 2: canonical URL match across different sources leads to cross_source_duplicate', async () => {
      // Create existing opportunity from another source
      const otherSourceId = new mongoose.Types.ObjectId();
      await Opportunity.create({
        title: 'Original Opportunity',
        organization: 'Microsoft',
        type: 'internship',
        description: 'Original long description for this opportunity doc 12345',
        sourceRef: otherSourceId,
        externalId: 'msft-100',
        applicationUrl: 'https://app.test/canonical-shared',
        canonicalUrl: 'https://app.test/canonical-shared',
        contentFingerprint: 'original-fp-100',
      });

      const duplicateItem = {
        title: 'Duplicate Opportunity',
        organization: 'Microsoft Corp',
        type: 'internship',
        description: 'Different description for same canonical application URL 12345',
        applicationUrl: 'https://app.test/canonical-shared',
        externalId: 'new-ext-200',
      };

      const countBefore = await Opportunity.countDocuments();
      const res = await processOpportunityItem({
        rawItem: duplicateItem,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('duplicate');
      expect(res.action).toBe('cross_source_duplicate');
      const countAfter = await Opportunity.countDocuments();
      expect(countAfter).toBe(countBefore); // No new doc created
    });

    it('Tier 3: content fingerprint match leads to fingerprint_duplicate', async () => {
      // Create initial opportunity
      const initialItem = {
        title: 'Cloud DevOps Intern',
        organization: 'Stripe',
        type: 'internship',
        description: 'Long description about cloud devops internship Stripe 12345',
        applicationUrl: 'https://stripe.com/jobs/1',
        externalId: 'stripe-1',
      };

      const firstRes = await processOpportunityItem({
        rawItem: initialItem,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });
      expect(firstRes.status).toBe('success');
      expect(firstRes.action).toBe('created');

      // Second item with same title + org (generating identical fingerprint), but different URL & externalId
      const fingerprintMatchItem = {
        title: 'Cloud DevOps Intern',
        organization: 'Stripe',
        type: 'internship',
        description: 'Completely different description text but same title & org 12345',
        applicationUrl: 'https://syndicate.io/stripe-jobs/1',
        externalId: 'syndicate-stripe-1',
      };

      const countBefore = await Opportunity.countDocuments();
      const secondRes = await processOpportunityItem({
        rawItem: fingerprintMatchItem,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(secondRes.status).toBe('duplicate');
      expect(secondRes.action).toBe('fingerprint_duplicate');
      const countAfter = await Opportunity.countDocuments();
      expect(countAfter).toBe(countBefore); // No doc created
    });
  });

  describe('4. Safe Upsert / Race Condition Error Recovery', () => {
    it('recovers safely when E11000 duplicate key error is encountered', async () => {
      const originalCreate = Opportunity.create;
      const originalFindOne = Opportunity.findOne;
      try {
        const raceWinnerId = new mongoose.Types.ObjectId();
        let findOneCount = 0;

        Opportunity.findOne = async function (query) {
          findOneCount++;
          // Step 3 (Tier 1 check): returns null (simulate document not yet present)
          if (findOneCount === 1) return null;
          // Step 4 & 5 checks: return null
          if (query.canonicalUrl || query.contentFingerprint) return null;
          // Step 6 race recovery check: returns the concurrent race winner
          if (query.sourceRef && query.externalId) {
            return { _id: raceWinnerId };
          }
          return null;
        };

        // Mock Opportunity.create to simulate race condition throwing E11000
        Opportunity.create = async function () {
          const err = new Error('E11000 duplicate key error collection: opportunities index: sourceRef_1_externalId_1 dup key');
          err.code = 11000;
          throw err;
        };

        const raceItem = {
          title: 'Race Runner Up Opportunity',
          organization: 'RaceOrg',
          type: 'internship',
          description: 'Description by race runner up trying to insert duplicate key',
          sourceRef: mockSourceDoc._id,
          externalId: 'race-ext-999',
          applicationUrl: 'https://race.org/jobs/999',
        };

        const res = await processOpportunityItem({
          rawItem: raceItem,
          source: mockSourceDoc,
          ingestionRunId: mockRunDoc._id,
        });

        expect(res.status).toBe('success');
        expect(res.action).toBe('updated');
        expect(res.opportunityId.toString()).toBe(raceWinnerId.toString());
        expect(res.reason).toContain('Recovered from duplicate-key race condition');
      } finally {
        Opportunity.create = originalCreate;
        Opportunity.findOne = originalFindOne;
      }
    });

    it('returns failed status if unexpected error occurs', async () => {
      const originalCreate = Opportunity.create;
      try {
        Opportunity.create = async function () {
          throw new Error('Database connection exploded');
        };

        const item = {
          title: 'Exploding Opp',
          organization: 'Exploding Org',
          description: 'A sufficiently long description with more than 20 chars',
          applicationUrl: 'https://explode.org',
          externalId: 'explode-1',
        };

        const res = await processOpportunityItem({
          rawItem: item,
          source: mockSourceDoc,
          ingestionRunId: mockRunDoc._id,
        });

        expect(res.status).toBe('failed');
        expect(res.action).toBe('skipped');
        expect(res.reason).toBe('Database connection exploded');
      } finally {
        Opportunity.create = originalCreate;
      }
    });
  });

  describe('5. Ingestion Service Lifecycle & Counters', () => {
    it('getEnabledSources returns enabled sources ordered by priority descending', async () => {
      await OpportunitySource.create({
        name: 'Disabled Source',
        slug: 'disabled-source',
        type: 'api',
        baseUrl: 'https://disabled.test',
        enabled: false,
        priority: 100,
      });

      await OpportunitySource.create({
        name: 'High Priority Source',
        slug: 'high-priority-source',
        type: 'api',
        baseUrl: 'https://high.test',
        enabled: true,
        priority: 50,
      });

      const enabledSources = await getEnabledSources();
      expect(enabledSources.length).toBe(2);
      expect(enabledSources[0].priority).toBe(50);
      expect(enabledSources[1].priority).toBe(10);
      expect(enabledSources.some((s) => s.name === 'Disabled Source')).toBe(false);
    });

    it('createIngestionRun creates a running record and updates source lastRunAt', async () => {
      const run = await createIngestionRun(mockSourceDoc._id, { trigger: 'test' });
      expect(run.status).toBe('running');
      expect(run.sourceId.toString()).toBe(mockSourceDoc._id.toString());
      expect(run.metadata.trigger).toBe('test');

      const updatedSource = await OpportunitySource.findById(mockSourceDoc._id);
      expect(updatedSource.lastRunAt).toBeDefined();
    });

    it('createIngestionRun throws if source not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(createIngestionRun(nonExistentId)).rejects.toThrow('Opportunity source not found');
    });

    it('markRunSuccess marks run completed, records metrics, and updates source lastSuccessAt', async () => {
      const run = await createIngestionRun(mockSourceDoc._id);
      const updatedRun = await markRunSuccess(run._id, {
        fetchedCount: 10,
        createdCount: 6,
        updatedCount: 2,
        skippedCount: 1,
        failedCount: 1,
      });

      expect(updatedRun.status).toBe('completed');
      expect(updatedRun.completedAt).toBeDefined();
      expect(updatedRun.fetchedCount).toBe(10);
      expect(updatedRun.createdCount).toBe(6);
      expect(updatedRun.updatedCount).toBe(2);
      expect(updatedRun.skippedCount).toBe(1);
      expect(updatedRun.failedCount).toBe(1);

      const updatedSource = await OpportunitySource.findById(mockSourceDoc._id);
      expect(updatedSource.lastSuccessAt).toBeDefined();
    });

    it('markRunFailure marks run failed, records error and failure metadata', async () => {
      const run = await createIngestionRun(mockSourceDoc._id);
      const updatedRun = await markRunFailure(
        run._id,
        'Upstream HTTP 503 Service Unavailable',
        { fetchedCount: 0, failedCount: 1 }
      );

      expect(updatedRun.status).toBe('failed');
      expect(updatedRun.errorMessage).toBe('Upstream HTTP 503 Service Unavailable');
      expect(updatedRun.failedCount).toBe(1);

      const updatedSource = await OpportunitySource.findById(mockSourceDoc._id);
      expect(updatedSource.lastFailureAt).toBeDefined();
      expect(updatedSource.lastError).toBe('Upstream HTTP 503 Service Unavailable');
    });

    it('markRunPartial marks run partial without marking source fully successful', async () => {
      const run = await createIngestionRun(mockSourceDoc._id);
      const updatedRun = await markRunPartial(
        run._id,
        'Partial rate limit hit',
        { fetchedCount: 5, createdCount: 3, failedCount: 2 }
      );

      expect(updatedRun.status).toBe('partial');
      expect(updatedRun.errorMessage).toBe('Partial rate limit hit');
      expect(updatedRun.createdCount).toBe(3);
    });
  });
});
